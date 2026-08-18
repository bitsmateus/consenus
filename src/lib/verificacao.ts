/**
 * Consulta da página pública de verificação.
 *
 * Regra 5 do CLAUDE.md e docs/03: a página devolve apenas existência, tipo,
 * código e data de emissão. Nunca o arquivo, nunca o nome das partes, nunca o
 * desfecho, nunca o número do procedimento.
 *
 * Como o cliente recusou o dígito verificador, esta é a única barreira contra
 * varredura sequencial. Todas as proteções abaixo são obrigatórias, não
 * desejáveis.
 */
import { TipoDocumento } from "@prisma/client";
import { registrarAuditoria } from "./auditoria";
import { codigoEhValido, normalizarCodigo } from "./codigo-documento";
import { db } from "./db";
import {
  LIMITES,
  aguardarTempoConstante,
  registrarAcerto,
  registrarConsulta,
  registrarFalha,
} from "./limite-de-taxa";
import { FUSO } from "./prazos";

/** Rótulos públicos. Só os tipos que a esteira emite aparecem aqui. */
const ROTULO_PUBLICO: Partial<Record<TipoDocumento, string>> = {
  CARTA_CONVITE_SOLICITANTE: "Carta-Convite",
  CARTA_CONVITE_CONVIDADO: "Carta-Convite",
  ATA: "Ata de Sessão",
  TERMO_ACORDO: "Termo de Acordo",
};

export type Resultado =
  | { situacao: "autentico"; tipo: string; codigo: string; emitidoEm: string }
  | { situacao: "nao_encontrado" }
  | { situacao: "limite"; esperarSegundos: number }
  | { situacao: "desafio" };

/**
 * Resposta idêntica para código inexistente e malformado.
 *
 * Distinguir "código inválido" de "não existe" entregaria informação: quem
 * varre saberia que acertou o formato e só precisa continuar tentando o
 * sequencial.
 */
const NAO_ENCONTRADO: Resultado = { situacao: "nao_encontrado" };

export async function verificarCodigo(entrada: string, chaveDoConsultante: string): Promise<Resultado> {
  const inicio = Date.now();

  const veredito = registrarConsulta(chaveDoConsultante);
  if (!veredito.permitido) {
    await aguardarTempoConstante(inicio);
    return { situacao: "limite", esperarSegundos: veredito.esperarSegundos };
  }
  if (veredito.exigeDesafio) {
    await aguardarTempoConstante(inicio);
    return { situacao: "desafio" };
  }

  const codigo = normalizarCodigo(entrada);

  // Malformado não sai por aqui com resposta diferente: cai no mesmo caminho
  // do inexistente, inclusive no tempo de resposta.
  const formatoOk = codigoEhValido(codigo);

  const documento = formatoOk
    ? await db.documento.findUnique({
        where: { codigoVerificacao: codigo },
        select: { tipo: true, codigoVerificacao: true, criadoEm: true, emitidoPelaCamara: true },
      })
    : null;

  await registrarAuditoria({
    acao: "CONSULTOU_VERIFICACAO",
    entidade: "Documento",
    entidadeId: formatoOk ? codigo : null,
    metadados: { encontrado: !!documento },
    semIdentificacao: true,
  });

  if (!documento || !documento.emitidoPelaCamara) {
    registrarFalha(chaveDoConsultante);
    await alertarSeVarredura(chaveDoConsultante);
    await aguardarTempoConstante(inicio);
    return NAO_ENCONTRADO;
  }

  registrarAcerto(chaveDoConsultante);
  await aguardarTempoConstante(inicio);

  return {
    situacao: "autentico",
    tipo: ROTULO_PUBLICO[documento.tipo] ?? "Documento",
    codigo: documento.codigoVerificacao!,
    emitidoEm: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeZone: FUSO,
    }).format(documento.criadoEm),
  };
}

/**
 * Sequência de consultas sem acerto é o padrão clássico de varredura.
 * Registra uma vez, ao cruzar o limiar, para não encher a trilha de auditoria.
 */
let jaAlertados = new Set<string>();

async function alertarSeVarredura(chave: string): Promise<void> {
  const { exigeDesafio } = await import("./limite-de-taxa");
  if (!exigeDesafio(chave) || jaAlertados.has(chave)) return;

  jaAlertados.add(chave);
  if (jaAlertados.size > 1000) jaAlertados = new Set([chave]);

  await registrarAuditoria({
    acao: "VARREDURA_SUSPEITA",
    entidade: "Documento",
    metadados: { consultasSemAcerto: LIMITES.falhasAteDesafio },
    semIdentificacao: true,
  });
}
