/**
 * Agenda de sessões contra o banco — pedido do cliente em 25/09: só dia útil,
 * 09:00 às 17:00 sem o almoço, 20 minutos por sessão, nunca duas ao mesmo tempo.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, ModalidadeSessao, SubPapelOperador, TipoPessoa } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);

let sessao: { id: string; papel: Papel; subPapelOperador: SubPapelOperador | null } | null = null;

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));

const { db } = await import("@/lib/db");
const { criarAto, alterarAgenda } = await import("@/acoes/atos");
const { adicionarDiaSemSessao, removerDiaSemSessao } = await import("@/acoes/calendario");
const { validarHorario, proximaVagaLivre } = await import("@/lib/agenda");
const { carregarContextoDaAgenda } = await import("@/lib/agenda-db");

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };
let adminId: string;
let operadorId: string;
let solicitanteId: string;
let convidadoId: string;
let contador = 0;

const sp = (texto: string) => fromZonedTime(`${texto}:00`, "America/Sao_Paulo");

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return dados;
}

/** Ato já com data, criado direto no banco: serve de "sessão marcada". */
async function atoMarcadoPara(quando: string) {
  contador++;
  const ato = await db.ato.create({
    data: {
      numero: `2097.${String(contador).padStart(4, "0")}`,
      criadoPorId: adminId,
      dataReservada: sp(quando),
      partes: { create: [{ pessoaId: solicitanteId, papel: "SOLICITANTE" }, { pessoaId: convidadoId, papel: "CONVIDADO" }] },
    },
  });
  criados.atos.push(ato.id);
  return ato;
}

async function criarPelaAcao(): Promise<string> {
  try {
    await criarAto({}, formulario({ solicitanteId, convidadoId }));
  } catch (erro) {
    const id = /REDIRECT:\/atos\/(.+)$/.exec((erro as Error).message)?.[1];
    if (!id) throw erro;
    criados.atos.push(id);
    return id;
  }
  throw new Error("criarAto não redirecionou");
}

async function pessoa(nome: string, documento: string) {
  const p = await db.pessoa.create({
    data: { tipo: TipoPessoa.FISICA, nome: `${nome} ${MARCA}`, documento },
  });
  criados.pessoas.push(p.id);
  return p.id;
}

beforeAll(async () => {
  const admin = await db.usuario.create({
    data: { nome: `Adm ${MARCA}`, email: `adm.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.ADMIN },
  });
  const operador = await db.usuario.create({
    data: { nome: `Op ${MARCA}`, email: `op.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.OPERADOR },
  });
  adminId = admin.id;
  operadorId = operador.id;
  criados.usuarios.push(admin.id, operador.id);
  solicitanteId = await pessoa("Solicitante", `${MARCA}01`);
  convidadoId = await pessoa("Convidado", `${MARCA}02`);
});

beforeEach(async () => {
  sessao = { id: adminId, papel: Papel.ADMIN, subPapelOperador: null };
  await db.diaSemSessao.deleteMany({});
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  criados.atos.length = 0;
});

afterAll(async () => {
  await db.diaSemSessao.deleteMany({});
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("abertura do procedimento: a data reservada respeita a agenda", () => {
  it("nasce em vaga válida: dia útil, dentro do expediente, fora do almoço", async () => {
    const id = await criarPelaAcao();
    const ato = await db.ato.findUniqueOrThrow({ where: { id } });
    const contexto = await carregarContextoDaAgenda(db, id);

    expect(validarHorario(ato.dataReservada!, contexto.regras, contexto.extras, contexto.marcadas)).toBeNull();
  });

  it("duas aberturas seguidas não caem no mesmo horário", async () => {
    const a = await db.ato.findUniqueOrThrow({ where: { id: await criarPelaAcao() } });
    const b = await db.ato.findUniqueOrThrow({ where: { id: await criarPelaAcao() } });

    const distancia = Math.abs(a.dataReservada!.getTime() - b.dataReservada!.getTime());
    expect(distancia).toBeGreaterThanOrEqual(20 * 60_000);
  });

  it("dia bloqueado pelo administrador é pulado", async () => {
    const primeiro = await db.ato.findUniqueOrThrow({ where: { id: await criarPelaAcao() } });
    const diaLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
      primeiro.dataReservada!
    );
    await db.ato.delete({ where: { id: primeiro.id } });

    await db.diaSemSessao.create({ data: { data: new Date(`${diaLocal}T00:00:00Z`), descricao: "Recesso" } });

    const novo = await db.ato.findUniqueOrThrow({ where: { id: await criarPelaAcao() } });
    const diaNovo = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
      novo.dataReservada!
    );
    expect(diaNovo).not.toBe(diaLocal);
  });
});

describe("alterar a agenda", () => {
  async function novoAto() {
    const id = await criarPelaAcao();
    return id;
  }
  const alterar = (atoId: string, dataDaSessao: string, extra: Record<string, string> = {}) =>
    alterarAgenda({}, formulario({ atoId, modalidade: ModalidadeSessao.VIDEOCONFERENCIA, dataDaSessao, ...extra }));

  it("aceita um horário válido e grava", async () => {
    const id = await novoAto();
    const resposta = await alterar(id, "2026-10-06T10:00");
    expect(resposta.erro).toBeUndefined();

    const ato = await db.ato.findUniqueOrThrow({ where: { id } });
    expect(ato.dataReservada?.getTime()).toBe(sp("2026-10-06T10:00").getTime());
  });

  it("recusa sábado, feriado, fora do expediente e almoço, sem gravar", async () => {
    const id = await novoAto();
    const antes = (await db.ato.findUniqueOrThrow({ where: { id } })).dataReservada!.getTime();

    for (const [quando, trecho] of [
      ["2026-10-10T10:00", /sábado/],
      ["2026-10-12T10:00", /feriado/],
      ["2026-10-06T08:40", /fora do expediente/],
      ["2026-10-06T17:00", /fora do expediente/],
      ["2026-10-06T12:00", /almoço/],
    ] as const) {
      const resposta = await alterar(id, quando);
      expect(resposta.erro, quando).toMatch(trecho);
    }

    expect((await db.ato.findUniqueOrThrow({ where: { id } })).dataReservada!.getTime()).toBe(antes);
  });

  it("recusa horário ocupado por outro procedimento e sugere a próxima vaga", async () => {
    await atoMarcadoPara("2026-10-06T14:00");
    const id = await novoAto();

    const resposta = await alterar(id, "2026-10-06T14:10");
    expect(resposta.erro).toMatch(/Já existe sessão neste horário/);
    expect(resposta.erro).toMatch(/Próxima vaga livre: 06\/10\/2026 às 14:20/);
  });

  it("aceita a vaga colada, 20 minutos depois", async () => {
    await atoMarcadoPara("2026-10-06T14:00");
    const id = await novoAto();
    expect((await alterar(id, "2026-10-06T14:20")).erro).toBeUndefined();
  });

  it("procedimento cancelado não ocupa mais a vaga", async () => {
    const ocupado = await atoMarcadoPara("2026-10-06T15:00");
    await db.ato.update({ where: { id: ocupado.id }, data: { status: "CANCELADO" } });
    const id = await novoAto();
    expect((await alterar(id, "2026-10-06T15:00")).erro).toBeUndefined();
  });

  it("o próprio horário do procedimento não conta como conflito", async () => {
    const id = await novoAto();
    expect((await alterar(id, "2026-10-06T10:00")).erro).toBeUndefined();
    expect((await alterar(id, "2026-10-06T10:00")).erro).toBeUndefined();
  });

  it("procedimento antigo, de antes das regras: trocar só a modalidade não é barrado", async () => {
    const legado = await atoMarcadoPara("2026-10-10T00:00"); // sábado, meia-noite
    const resposta = await alterarAgenda(
      {},
      formulario({
        atoId: legado.id,
        modalidade: ModalidadeSessao.PRESENCIAL,
        dataDaSessao: "2026-10-10T00:00",
        localPresencial: "Sala 411",
      })
    );
    expect(resposta.erro).toBeUndefined();
    const ato = await db.ato.findUniqueOrThrow({ where: { id: legado.id } });
    expect(ato.modalidade).toBe("PRESENCIAL");
    expect(ato.localPresencial).toBe("Sala 411");
  });

  it("operador com sub-perfil não altera a agenda", async () => {
    const id = await novoAto();
    sessao = { id: operadorId, papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.CAMARA };
    await expect(alterar(id, "2026-10-06T10:00")).rejects.toThrow(/permissão/);
  });

  it("operador sem sub-perfil altera normalmente", async () => {
    const id = await novoAto();
    sessao = { id: operadorId, papel: Papel.OPERADOR, subPapelOperador: null };
    expect((await alterar(id, "2026-10-06T10:00")).erro).toBeUndefined();
  });
});

describe("dias sem sessão cadastrados", () => {
  it("o administrador bloqueia um dia útil, e a agenda passa a recusá-lo", async () => {
    const resposta = await adicionarDiaSemSessao({}, formulario({ data: "2026-10-06", descricao: "Recesso" }));
    expect(resposta.erro).toBeUndefined();

    const contexto = await carregarContextoDaAgenda(db);
    expect(validarHorario(sp("2026-10-06T10:00"), contexto.regras, contexto.extras, contexto.marcadas)).toMatch(/dia sem sessão — Recesso/);
    expect(proximaVagaLivre(sp("2026-10-06T10:00"), contexto.regras, contexto.extras, contexto.marcadas).getTime()).toBe(
      sp("2026-10-07T09:00").getTime()
    );
  });

  it("avisa quantas sessões já estavam marcadas no dia bloqueado, sem movê-las", async () => {
    const marcada = await atoMarcadoPara("2026-10-06T10:00");
    const resposta = await adicionarDiaSemSessao({}, formulario({ data: "2026-10-06", descricao: "Recesso" }));

    expect(resposta.aviso).toMatch(/1 sessão/);
    expect((await db.ato.findUniqueOrThrow({ where: { id: marcada.id } })).dataReservada?.getTime()).toBe(
      sp("2026-10-06T10:00").getTime()
    );
  });

  it("não bloqueia o que já não tem sessão (fim de semana, feriado) nem repete o dia", async () => {
    expect((await adicionarDiaSemSessao({}, formulario({ data: "2026-10-10", descricao: "Teste" }))).erro).toMatch(/sábado/);
    expect((await adicionarDiaSemSessao({}, formulario({ data: "2026-10-12", descricao: "Teste" }))).erro).toMatch(/feriado/);

    await adicionarDiaSemSessao({}, formulario({ data: "2026-10-06", descricao: "Recesso" }));
    expect((await adicionarDiaSemSessao({}, formulario({ data: "2026-10-06", descricao: "Outra vez" }))).erro).toMatch(/já está bloqueado/);
  });

  it("liberar o dia devolve as vagas e fica na auditoria", async () => {
    await adicionarDiaSemSessao({}, formulario({ data: "2026-10-06", descricao: "Recesso" }));
    const dia = await db.diaSemSessao.findFirstOrThrow();
    await removerDiaSemSessao(formulario({ id: dia.id }));

    const contexto = await carregarContextoDaAgenda(db);
    expect(validarHorario(sp("2026-10-06T10:00"), contexto.regras, contexto.extras, contexto.marcadas)).toBeNull();
    expect(await db.logAuditoria.count({ where: { acao: "ALTEROU_CALENDARIO", usuarioId: adminId } })).toBe(2);
  });

  it("só administrador mexe nos dias sem sessão", async () => {
    sessao = { id: operadorId, papel: Papel.OPERADOR, subPapelOperador: null };
    await expect(
      adicionarDiaSemSessao({}, formulario({ data: "2026-10-06", descricao: "Recesso" }))
    ).rejects.toThrow();
    expect(await db.diaSemSessao.count()).toBe(0);
  });
});
