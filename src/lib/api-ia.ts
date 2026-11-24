/**
 * API do agente de IA (Clara, no WhatsApp). Máquina-a-máquina: quem chama é o
 * n8n da NX Digital, sem sessão de usuário. Ver docs/14-api-para-agente-de-ia.md.
 *
 * Princípios, na ordem em que importam:
 *  1. SOMENTE LEITURA. A IA não vende, não cadastra e não altera ato (briefing,
 *     seção 5). Nenhuma rota daqui escreve em tabela de negócio.
 *  2. MÍNIMO NECESSÁRIO. A resposta traz o que a Clara precisa para falar com a
 *     pessoa que está no WhatsApp — nunca CPF, e-mail, endereço, nome da outra
 *     parte, objeto do procedimento ou qualquer documento (regra 5 do CLAUDE.md).
 *  3. IDENTIFICAÇÃO FRACA É TRATADA COMO FRACA. Telefone não é único na base.
 *     Se mais de uma pessoa responde pelo mesmo número, a API não escolhe: pede
 *     o CPF/CNPJ para desempatar.
 *  4. TUDO AUDITADO, sem guardar telefone nem documento em claro (só o final).
 */
import { timingSafeEqual } from "node:crypto";
import { registrarAuditoria } from "./auditoria";
import { db } from "./db";

// ---------------------------------------------------------------- autenticação

/** Confere o `Authorization: Bearer <token>` contra IA_API_TOKEN, em tempo constante. */
export function tokenAutentico(cabecalho: string | null): boolean {
  const esperado = process.env.IA_API_TOKEN;
  // token curto ou ausente = API desligada. Recusar é o comportamento seguro.
  if (!esperado || esperado.length < 32 || !cabecalho) return false;

  const m = /^Bearer\s+(.+)$/i.exec(cabecalho.trim());
  if (!m) return false;

  const a = Buffer.from(m[1]!);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ----------------------------------------------------------------- limite de taxa

const JANELA_MS = 60_000;
export const LIMITE_POR_MINUTO = 60;
const chamadas: number[] = [];

/** Em memória, como o da verificação (ver limite-de-taxa.ts). Um VPS só. */
export function dentroDoLimite(agora = Date.now()): boolean {
  while (chamadas.length && agora - chamadas[0]! >= JANELA_MS) chamadas.shift();
  if (chamadas.length >= LIMITE_POR_MINUTO) return false;
  chamadas.push(agora);
  return true;
}

export function zerarLimite(): void {
  chamadas.length = 0;
}

// ------------------------------------------------------------ normalização

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Chave de comparação de telefone brasileiro: DDD + 8 últimos dígitos.
 *
 * Telefone vem do WhatsApp como 5511987654321, mas está cadastrado como
 * "(11) 98765-4321", "11 3333-4444", "+55 11 8765-4321"… e há números com e sem
 * o nono dígito para a mesma linha. Ignorar o prefixo 55 e o 9 extra resolve os
 * quatro casos sem juntar linhas diferentes (DDD + 8 dígitos identifica a linha).
 * Devolve null se não houver dígitos suficientes para identificar alguém.
 */
export function chaveDeTelefone(bruto: string): string | null {
  let d = somenteDigitos(bruto);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null; // sem DDD não dá para afirmar nada
  return d.slice(0, 2) + d.slice(-8);
}

/** Valida CPF (11) ou CNPJ (14) só pelo tamanho; o banco decide se existe. */
export function documentoValido(bruto: string): string | null {
  const d = somenteDigitos(bruto);
  return d.length === 11 || d.length === 14 ? d : null;
}

function mascarar(valor: string): string {
  return valor.length <= 4 ? "****" : `…${valor.slice(-4)}`;
}

// ------------------------------------------------------------ identificação

export type Identificacao =
  | { tipo: "encontrada"; pessoaId: string }
  | { tipo: "nao_encontrada" }
  | { tipo: "ambigua" }
  | { tipo: "invalida"; motivo: string };

export async function identificarPessoa(entrada: {
  telefone?: string | null;
  documento?: string | null;
}): Promise<Identificacao> {
  const doc = entrada.documento ? documentoValido(entrada.documento) : null;
  if (entrada.documento && !doc) {
    return { tipo: "invalida", motivo: "documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos" };
  }
  const chave = entrada.telefone ? chaveDeTelefone(entrada.telefone) : null;
  if (entrada.telefone && !chave) {
    return { tipo: "invalida", motivo: "telefone precisa ter DDD" };
  }
  if (!doc && !chave) {
    return { tipo: "invalida", motivo: "informe telefone ou documento" };
  }

  // documento é único: identifica sozinho. Se veio telefone junto, ele não
  // precisa bater (a pessoa pode estar escrevendo de outro aparelho) — o
  // documento é o fator forte e foi informado pela própria pessoa.
  if (doc) {
    const p = await db.pessoa.findUnique({ where: { documento: doc }, select: { id: true } });
    return p ? { tipo: "encontrada", pessoaId: p.id } : { tipo: "nao_encontrada" };
  }

  // o banco afunila pelos 8 últimos dígitos (telefone cadastrado com máscara,
  // por isso o regexp_replace); a decisão fina, com DDD, é em memória
  const final8 = chave!.slice(2);
  const candidatas = await db.$queryRaw<{ id: string; telefone: string }[]>`
    SELECT "id", "telefone" FROM "Pessoa"
    WHERE "telefone" IS NOT NULL
      AND regexp_replace("telefone", '\\D', '', 'g') LIKE ${"%" + final8 + "%"}
  `;
  const iguais = candidatas.filter((c) => chaveDeTelefone(c.telefone) === chave);

  if (iguais.length === 0) return { tipo: "nao_encontrada" };
  if (iguais.length > 1) return { tipo: "ambigua" };
  return { tipo: "encontrada", pessoaId: iguais[0]!.id };
}

// ------------------------------------------------------------------ cadastro

export type CadastroParaIA = {
  pessoaId: string;
  /** Só o primeiro nome (pessoa física) — para a Clara cumprimentar. */
  tratamento: string;
  tipo: "FISICA" | "JURIDICA";
  /** Em quais papéis aparece em algum procedimento. Vazio = cadastrada, sem ato. */
  papeis: Array<"SOLICITANTE" | "CONVIDADO" | "PROCURADOR">;
};

export async function obterCadastro(pessoaId: string): Promise<CadastroParaIA | null> {
  const p = await db.pessoa.findUnique({
    where: { id: pessoaId },
    select: {
      id: true,
      nome: true,
      tipo: true,
      participacoes: { select: { papel: true } },
    },
  });
  if (!p) return null;

  const papeis = [...new Set(p.participacoes.map((x) => x.papel))].filter(
    (x): x is "SOLICITANTE" | "CONVIDADO" | "PROCURADOR" => x !== "CONCILIADOR"
  );

  return {
    pessoaId: p.id,
    tratamento: p.tipo === "FISICA" ? (p.nome.trim().split(/\s+/)[0] ?? p.nome) : p.nome,
    tipo: p.tipo,
    papeis,
  };
}

// ------------------------------------------------------------------- sessões

/**
 * Quanto tempo depois do horário marcado a sessão ainda é "a de hoje".
 * Quem se atrasa e pede o link no WhatsApp precisa recebê-lo.
 */
export const TOLERANCIA_APOS_INICIO_MIN = 30;

/**
 * Em que etapa do procedimento cada lado já pode receber o link.
 *
 * - Solicitante: a 1ª Carta-Convite já leva o link, mas a data só é firme
 *   depois que a documentação é validada (DATA_CONFIRMADA).
 * - Convidado: só depois da 2ª Carta-Convite (CONVIDADO_CONVOCADO). Antes
 *   disso ele nem foi formalmente convidado; entregar a sala seria atropelar
 *   o fluxo (docs/02). REGRA A CONFIRMAR COM O CLIENTE — ver docs/14.
 */
const STATUS_QUE_LIBERAM_LINK: Record<"SOLICITANTE" | "CONVIDADO", string[]> = {
  SOLICITANTE: ["DATA_CONFIRMADA", "CONVIDADO_CONVOCADO"],
  CONVIDADO: ["CONVIDADO_CONVOCADO"],
};

export type SessaoParaIA = {
  numeroDoProcedimento: string;
  /** ISO 8601 em UTC. */
  dataHora: string;
  /** Pronto para a Clara dizer: "terça-feira, 25/11/2026, às 14:30 (horário de Brasília)". */
  dataHoraTexto: string;
  papel: "SOLICITANTE" | "CONVIDADO";
  /** true quando a pessoa participa como procuradora de alguém. */
  comoProcurador: boolean;
  modalidade: "VIDEOCONFERENCIA" | "PRESENCIAL" | "HIBRIDA";
  link: string | null;
  idReuniao: string | null;
  senha: string | null;
  localPresencial: string | null;
};

export function formatarDataHora(d: Date): string {
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${data}, às ${hora} (horário de Brasília)`;
}

export async function listarSessoes(
  pessoaId: string,
  agora = new Date()
): Promise<SessaoParaIA[]> {
  const desde = new Date(agora.getTime() - TOLERANCIA_APOS_INICIO_MIN * 60_000);

  const participacoes = await db.parteDoAto.findMany({
    where: {
      pessoaId,
      papel: { in: ["SOLICITANTE", "CONVIDADO", "PROCURADOR"] },
      ato: {
        dataConfirmada: { gte: desde },
        status: { in: ["DATA_CONFIRMADA", "CONVIDADO_CONVOCADO"] },
      },
    },
    select: {
      papel: true,
      representa: { select: { papel: true } },
      ato: {
        select: {
          numero: true,
          status: true,
          dataConfirmada: true,
          modalidade: true,
          linkVideoconferencia: true,
          idReuniao: true,
          senhaReuniao: true,
          localPresencial: true,
        },
      },
    },
  });

  const saida: SessaoParaIA[] = [];
  for (const x of participacoes) {
    const comoProcurador = x.papel === "PROCURADOR";
    // procurador sem a parte representada registrada: trata como Convidado,
    // o lado que libera menos. Errar para o lado restritivo.
    const papel = (comoProcurador ? x.representa?.papel : x.papel) ?? "CONVIDADO";
    if (papel !== "SOLICITANTE" && papel !== "CONVIDADO") continue;
    if (!STATUS_QUE_LIBERAM_LINK[papel].includes(x.ato.status)) continue;
    if (!x.ato.dataConfirmada) continue;

    const remota = x.ato.modalidade !== "PRESENCIAL";
    const presencial = x.ato.modalidade !== "VIDEOCONFERENCIA";
    saida.push({
      numeroDoProcedimento: x.ato.numero,
      dataHora: x.ato.dataConfirmada.toISOString(),
      dataHoraTexto: formatarDataHora(x.ato.dataConfirmada),
      papel,
      comoProcurador,
      modalidade: x.ato.modalidade,
      link: remota ? x.ato.linkVideoconferencia : null,
      idReuniao: remota ? x.ato.idReuniao : null,
      senha: remota ? x.ato.senhaReuniao : null,
      localPresencial: presencial ? x.ato.localPresencial : null,
    });
  }

  return saida.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
}

// ----------------------------------------------------------------- auditoria

export async function auditarConsultaIA(
  rota: string,
  entrada: { telefone?: string | null; documento?: string | null },
  resultado: string,
  pessoaId?: string
): Promise<void> {
  await registrarAuditoria({
    acao: "CONSULTOU_API_IA",
    entidade: "Pessoa",
    entidadeId: pessoaId ?? null,
    metadados: {
      rota,
      resultado,
      // nunca em claro: só o final, o bastante para investigar um caso
      telefone: entrada.telefone ? mascarar(somenteDigitos(entrada.telefone)) : null,
      documento: entrada.documento ? mascarar(somenteDigitos(entrada.documento)) : null,
    },
  });
}
