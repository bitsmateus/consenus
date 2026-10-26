/**
 * A ata só se lavra uma vez e não se regera: sem Conciliador vinculado ela
 * sairia sem o nome e sem a assinatura dele (relato do cliente em 26/10).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Papel, TipoPessoa } from "@prisma/client";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);

let sessao: { id: string; papel: Papel; subPapelOperador: null } | null = null;

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const emitirDocumento = vi.fn();
vi.mock("@/lib/emissao", () => ({ emitirDocumento }));

const { db } = await import("@/lib/db");
const { gerarAta } = await import("@/acoes/fluxo");

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };
let adminId: string;
let solicitanteId: string;
let convidadoId: string;
let conciliadorId: string;
let contador = 0;

async function pessoa(nome: string, documento: string) {
  const p = await db.pessoa.create({
    data: { tipo: TipoPessoa.FISICA, nome: `${nome} ${MARCA}`, documento },
  });
  criados.pessoas.push(p.id);
  return p.id;
}

async function sessaoRealizada(comConciliador: boolean) {
  contador++;
  const ato = await db.ato.create({
    data: {
      numero: `2096.${String(contador).padStart(4, "0")}`,
      criadoPorId: adminId,
      status: "SESSAO_REALIZADA",
      desfecho: "SESSAO_PREJUDICADA",
      motivoPrejudicada: "Ausência do Interessado Convidado",
      horaInicio: new Date(),
      horaEncerramento: new Date(),
      partes: {
        create: [
          { pessoaId: solicitanteId, papel: "SOLICITANTE" },
          { pessoaId: convidadoId, papel: "CONVIDADO" },
          ...(comConciliador ? [{ pessoaId: conciliadorId, papel: "CONCILIADOR" as const }] : []),
        ],
      },
    },
  });
  criados.atos.push(ato.id);
  return ato.id;
}

function formulario(atoId: string) {
  const dados = new FormData();
  dados.append("atoId", atoId);
  return dados;
}

beforeAll(async () => {
  const admin = await db.usuario.create({
    data: { nome: `Adm ${MARCA}`, email: `adm.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.ADMIN },
  });
  adminId = admin.id;
  criados.usuarios.push(admin.id);
  sessao = { id: adminId, papel: Papel.ADMIN, subPapelOperador: null };
  solicitanteId = await pessoa("Solicitante", `${MARCA}01`);
  convidadoId = await pessoa("Convidado", `${MARCA}02`);
  conciliadorId = await pessoa("Conciliador", `${MARCA}03`);
});

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("lavrar a ata exige Conciliador vinculado", () => {
  it("sem Conciliador: recusa, e a ata não é emitida", async () => {
    const atoId = await sessaoRealizada(false);
    await expect(gerarAta(formulario(atoId))).rejects.toThrow(/Vincule o Conciliador/);
    expect(emitirDocumento).not.toHaveBeenCalled();
  });

  it("com Conciliador: segue para a emissão, com o nome dele na ata", async () => {
    emitirDocumento.mockImplementation(async ({ montarHtml }) => {
      const html = montarHtml("CO-AT-TESTE");
      expect(html).toContain(`Conciliador ${MARCA}`);
      return { codigo: "CO-AT-TESTE" };
    });
    const atoId = await sessaoRealizada(true);
    await gerarAta(formulario(atoId));
    expect(emitirDocumento).toHaveBeenCalledTimes(1);
  });
});
