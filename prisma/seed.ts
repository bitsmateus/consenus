/**
 * Dados de demonstração para desenvolvimento e treinamento.
 *
 * Tudo aqui é fictício, conforme docs/04: dado de homologação nunca é cópia de
 * produção. Os nomes seguem os exemplos dos próprios modelos do cliente e de
 * docs/10, para a tela ficar parecida com o que ele já conhece.
 *
 * Idempotente: pode rodar quantas vezes precisar.
 */
import {
  ModalidadeSessao,
  Papel,
  PapelNoAto,
  PrismaClient,
  StatusAto,
  TipoEvento,
  TipoPessoa,
  TipoProcurador,
} from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

/** Completa os dois dígitos verificadores de um CPF a partir da base de 9. */
function cpf(base: string): string {
  const calcular = (parcial: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < parcial.length; i++) {
      soma += Number(parcial[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcular(base, 10);
  const d2 = calcular(base + d1, 11);
  return `${base}${d1}${d2}`;
}

/** Completa os dois dígitos verificadores de um CNPJ a partir da base de 12. */
function cnpj(base: string): string {
  const calcular = (parcial: string, pesos: number[]): number => {
    const soma = parcial
      .split("")
      .reduce((acc, digito, i) => acc + Number(digito) * (pesos[i] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calcular(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcular(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

function diasDeHoje(dias: number): Date {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(14, 0, 0, 0);
  return data;
}

type DadosDePessoa = {
  chave: string;
  tipo: TipoPessoa;
  nome: string;
  documento: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  tipoProcurador?: TipoProcurador;
  oab?: string;
  vinculadoA?: string;
};

const PESSOAS: DadosDePessoa[] = [
  {
    chave: "francisco",
    tipo: TipoPessoa.FISICA,
    nome: "Francisco Davi Coelho",
    documento: cpf("390533447"),
    email: "francisco.coelho@exemplo.com.br",
    telefone: "(11) 98812-4477",
    cidade: "Mogi das Cruzes",
    uf: "SP",
  },
  {
    chave: "fidc",
    tipo: TipoPessoa.JURIDICA,
    nome: "FIDC Creditas Tempus",
    documento: cnpj("111222330001"),
    email: "juridico@exemplo.com.br",
    cidade: "São Paulo",
    uf: "SP",
  },
  {
    chave: "beatriz",
    tipo: TipoPessoa.FISICA,
    nome: "Beatriz Andrade Lima",
    documento: cpf("529982247"),
    email: "beatriz.lima@exemplo.com.br",
    cidade: "Suzano",
    uf: "SP",
  },
  {
    chave: "horizonte",
    tipo: TipoPessoa.JURIDICA,
    nome: "Construtora Horizonte Sul Ltda",
    documento: cnpj("222333440001"),
    cidade: "Guarulhos",
    uf: "SP",
  },
  {
    chave: "marcos",
    tipo: TipoPessoa.FISICA,
    nome: "Marcos Vinícius Tavares",
    documento: cpf("714287938"),
    email: "marcos.tavares@exemplo.com.br",
    cidade: "Mogi das Cruzes",
    uf: "SP",
  },
  {
    chave: "meridional",
    tipo: TipoPessoa.JURIDICA,
    nome: "Banco Meridional S.A.",
    documento: cnpj("333444550001"),
    cidade: "São Paulo",
    uf: "SP",
  },
  {
    chave: "helena",
    tipo: TipoPessoa.FISICA,
    nome: "Helena Vasconcelos",
    documento: cpf("468913257"),
    email: "helena@exemplo.adv.br",
    tipoProcurador: TipoProcurador.ADVOGADO,
    oab: "OAB/SP 214.887",
    cidade: "São Paulo",
    uf: "SP",
  },
  {
    chave: "menezes",
    tipo: TipoPessoa.JURIDICA,
    nome: "Menezes Advogados Associados",
    documento: cnpj("444555660001"),
    tipoProcurador: TipoProcurador.ESCRITORIO_ADVOCACIA,
    oab: "OAB/SP 12.443",
    cidade: "São Paulo",
    uf: "SP",
  },
  {
    chave: "vertice",
    tipo: TipoPessoa.JURIDICA,
    nome: "Vértice Consultoria Empresarial Ltda",
    documento: cnpj("555666770001"),
    tipoProcurador: TipoProcurador.EMPRESA_CONSULTORIA,
    cidade: "Campinas",
    uf: "SP",
  },
  {
    chave: "rafael",
    tipo: TipoPessoa.FISICA,
    nome: "Rafael Nogueira Prado",
    documento: cpf("845102369"),
    tipoProcurador: TipoProcurador.REPRESENTANTE_EMPRESA,
    vinculadoA: "vertice",
    cidade: "Campinas",
    uf: "SP",
  },
];

type Vinculo = { chave: string; papel: PapelNoAto; representa?: string };
type DadosDeAto = {
  numero: string;
  status: StatusAto;
  objeto: string;
  diasAteSessao: number;
  prazoEmDias: number;
  confirmada: boolean;
  partes: Vinculo[];
  eventos: { tipo: TipoEvento; descricao: string }[];
};

const ATOS: DadosDeAto[] = [
  {
    numero: "2026.0001",
    status: StatusAto.AGUARDANDO_DOCUMENTACAO,
    objeto: "Revisão de cláusulas de contrato de financiamento",
    diasAteSessao: 12,
    prazoEmDias: 2,
    confirmada: false,
    partes: [
      { chave: "francisco", papel: PapelNoAto.SOLICITANTE },
      { chave: "fidc", papel: PapelNoAto.CONVIDADO },
      { chave: "helena", papel: PapelNoAto.PROCURADOR, representa: "francisco" },
    ],
    eventos: [
      { tipo: TipoEvento.ATO_CRIADO, descricao: "Procedimento 2026.0001 aberto." },
      {
        tipo: TipoEvento.PARTE_ADICIONADA,
        descricao: "Interessado Solicitante e Interessado Convidado vinculados.",
      },
      {
        tipo: TipoEvento.PARTE_ADICIONADA,
        descricao: "Helena Vasconcelos vinculada como procuradora.",
      },
      {
        tipo: TipoEvento.CARTA_SOLICITANTE_GERADA,
        descricao: "Carta-Convite ao Interessado Solicitante emitida.",
      },
      {
        tipo: TipoEvento.CARTA_SOLICITANTE_ENVIADA,
        descricao: "Carta-Convite enviada por AR digital.",
      },
    ],
  },
  {
    numero: "2026.0002",
    status: StatusAto.DATA_CONFIRMADA,
    objeto: "Controvérsia sobre execução de obra residencial",
    diasAteSessao: 6,
    prazoEmDias: -3,
    confirmada: true,
    partes: [
      { chave: "beatriz", papel: PapelNoAto.SOLICITANTE },
      { chave: "horizonte", papel: PapelNoAto.CONVIDADO },
      { chave: "vertice", papel: PapelNoAto.PROCURADOR, representa: "beatriz" },
      { chave: "rafael", papel: PapelNoAto.PROCURADOR, representa: "beatriz" },
    ],
    eventos: [
      { tipo: TipoEvento.ATO_CRIADO, descricao: "Procedimento 2026.0002 aberto." },
      {
        tipo: TipoEvento.PARTE_ADICIONADA,
        descricao: "Interessado Solicitante e Interessado Convidado vinculados.",
      },
      {
        tipo: TipoEvento.DOCUMENTO_RECEBIDO,
        descricao: "Documentação do Interessado Solicitante recebida.",
      },
      {
        tipo: TipoEvento.DOCUMENTACAO_CONFERIDA,
        descricao: "Documentação conferida item a item pelo operador.",
      },
      {
        tipo: TipoEvento.DATA_CONFIRMADA,
        descricao: "Data da sessão efetivada após conferência documental.",
      },
    ],
  },
  {
    numero: "2026.0003",
    status: StatusAto.COMPOSICAO_INTEGRAL,
    objeto: "Renegociação de dívida bancária",
    diasAteSessao: -8,
    prazoEmDias: -20,
    confirmada: true,
    partes: [
      { chave: "marcos", papel: PapelNoAto.SOLICITANTE },
      { chave: "meridional", papel: PapelNoAto.CONVIDADO },
      { chave: "menezes", papel: PapelNoAto.PROCURADOR, representa: "meridional" },
      { chave: "helena", papel: PapelNoAto.PROCURADOR, representa: "marcos" },
    ],
    eventos: [
      { tipo: TipoEvento.ATO_CRIADO, descricao: "Procedimento 2026.0003 aberto." },
      {
        tipo: TipoEvento.DATA_CONFIRMADA,
        descricao: "Data da sessão efetivada após conferência documental.",
      },
      {
        tipo: TipoEvento.CARTA_CONVIDADO_ENVIADA,
        descricao: "Carta-Convite ao Interessado Convidado enviada por AR digital.",
      },
      {
        tipo: TipoEvento.SESSAO_REALIZADA,
        descricao: "Sessão Privada de Conciliação realizada por videoconferência.",
      },
      {
        tipo: TipoEvento.ATA_GERADA,
        descricao: "Ata lavrada com desfecho de Composição Consensual Integral.",
      },
    ],
  },
  {
    numero: "2026.0004",
    status: StatusAto.RASCUNHO,
    objeto: "Divergência sobre prestação de serviços de consultoria",
    diasAteSessao: 20,
    prazoEmDias: 15,
    confirmada: false,
    partes: [
      { chave: "marcos", papel: PapelNoAto.SOLICITANTE },
      { chave: "horizonte", papel: PapelNoAto.CONVIDADO },
    ],
    eventos: [{ tipo: TipoEvento.ATO_CRIADO, descricao: "Procedimento 2026.0004 aberto." }],
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed não roda em produção.");
  }

  await db.configuracaoSistema.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nomeCamara: "Consensus One",
      prazoDocumentacaoDias: 15,
      diasAteSessao: 20,
      urlVerificacao: "http://localhost:3000/verificar",
    },
  });

  const senhaHash = await argon2.hash("Consensus@2026", { type: argon2.argon2id });

  const admin = await db.usuario.upsert({
    where: { email: "admin@consensusone.com.br" },
    update: {},
    create: {
      nome: "Sergio Ferreira",
      email: "admin@consensusone.com.br",
      senhaHash,
      papel: Papel.ADMIN,
    },
  });

  await db.usuario.upsert({
    where: { email: "operador@consensusone.com.br" },
    update: {},
    create: {
      nome: "Carolina Menezes",
      email: "operador@consensusone.com.br",
      senhaHash,
      papel: Papel.OPERADOR,
    },
  });

  const porChave = new Map<string, string>();

  const gravarPessoa = async (dados: DadosDePessoa) => {
    const pessoa = await db.pessoa.upsert({
      where: { documento: dados.documento },
      update: { nome: dados.nome },
      create: {
        tipo: dados.tipo,
        nome: dados.nome,
        documento: dados.documento,
        email: dados.email ?? null,
        telefone: dados.telefone ?? null,
        cidade: dados.cidade ?? null,
        uf: dados.uf ?? null,
        tipoProcurador: dados.tipoProcurador ?? null,
        oab: dados.oab ?? null,
        vinculadoAId: dados.vinculadoA ? (porChave.get(dados.vinculadoA) ?? null) : null,
      },
    });
    porChave.set(dados.chave, pessoa.id);
  };

  // sem vínculo primeiro: quem é vinculado depende de a empresa já existir
  for (const dados of PESSOAS.filter((p) => !p.vinculadoA)) await gravarPessoa(dados);
  for (const dados of PESSOAS.filter((p) => p.vinculadoA)) await gravarPessoa(dados);

  const id = (chave: string): string => {
    const valor = porChave.get(chave);
    if (!valor) throw new Error(`pessoa não encontrada no seed: ${chave}`);
    return valor;
  };

  for (const dados of ATOS) {
    if (await db.ato.findUnique({ where: { numero: dados.numero } })) continue;

    const dataDaSessao = diasDeHoje(dados.diasAteSessao);

    const ato = await db.ato.create({
      data: {
        numero: dados.numero,
        status: dados.status,
        objeto: dados.objeto,
        modalidade: ModalidadeSessao.VIDEOCONFERENCIA,
        linkVideoconferencia: "https://zoom.us/j/00000000000",
        idReuniao: "000 0000 0000",
        senhaReuniao: "consensus",
        dataReservada: dataDaSessao,
        dataConfirmada: dados.confirmada ? dataDaSessao : null,
        prazoDocumentacaoAte: diasDeHoje(dados.prazoEmDias),
        criadoPorId: admin.id,
      },
    });

    // Interessados primeiro, para o procurador poder apontar para eles
    const criadas = new Map<string, string>();
    for (const vinculo of dados.partes.filter((p) => p.papel !== PapelNoAto.PROCURADOR)) {
      const parte = await db.parteDoAto.create({
        data: { atoId: ato.id, pessoaId: id(vinculo.chave), papel: vinculo.papel },
      });
      criadas.set(vinculo.chave, parte.id);
    }
    for (const vinculo of dados.partes.filter((p) => p.papel === PapelNoAto.PROCURADOR)) {
      await db.parteDoAto.create({
        data: {
          atoId: ato.id,
          pessoaId: id(vinculo.chave),
          papel: vinculo.papel,
          representaId: vinculo.representa ? (criadas.get(vinculo.representa) ?? null) : null,
        },
      });
    }

    let momento = -dados.eventos.length;
    for (const evento of dados.eventos) {
      await db.eventoAto.create({
        data: {
          atoId: ato.id,
          tipo: evento.tipo,
          descricao: evento.descricao,
          usuarioId: admin.id,
          criadoEm: diasDeHoje(momento),
        },
      });
      momento += 1;
    }
  }

  const [totalPessoas, totalAtos] = await Promise.all([db.pessoa.count(), db.ato.count()]);

  console.log("Dados de demonstração criados.");
  console.log(`  ${totalPessoas} pessoas · ${totalAtos} procedimentos`);
  console.log("");
  console.log("  Administrador: admin@consensusone.com.br / Consensus@2026");
  console.log("  Operador:      operador@consensusone.com.br / Consensus@2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
