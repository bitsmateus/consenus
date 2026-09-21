/**
 * Redefinição de senha: "esqueci minha senha" por e-mail e troca feita pelo
 * administrador na tela de Equipe — pedido do cliente em 21/09.
 */
import argon2 from "argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);

let sessao: { id: string; papel: Papel } | null = null;
const emailsEnviados: { para: string; texto: string }[] = [];

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
// fora de uma requisição Next real não há store de cache nem cabeçalhos
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
// redirect() sinaliza por exceção; o teste só precisa saber para onde iria
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
vi.mock("@/lib/email", () => ({
  emailAtivo: vi.fn(() => true),
  enviarEmail: vi.fn(async (m: { para: string; texto: string }) => {
    emailsEnviados.push(m);
  }),
}));

const { db } = await import("@/lib/db");
const { limparTudo } = await import("@/lib/limite-de-taxa");
const { solicitarRedefinicao, redefinirSenha } = await import("@/acoes/redefinicao-de-senha");
const { redefinirSenhaDeUsuario } = await import("@/acoes/usuarios");
const { hashDoToken } = await import("@/lib/redefinicao-de-senha");
const emailEmUso = vi.mocked((await import("@/lib/email")).emailAtivo);

const criados: string[] = [];
let adminId: string;
let contaId: string;
let emailDaConta: string;

const SENHA_ANTIGA = "SenhaAntiga2026x";
const SENHA_NOVA = "SenhaNovaSegura2026";

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return dados;
}

async function criarUsuario(nome: string, papel: Papel) {
  const usuario = await db.usuario.create({
    data: {
      nome: `${nome} ${MARCA}`,
      email: `${nome.toLowerCase()}.${MARCA}@exemplo.test`,
      senhaHash: await argon2.hash(SENHA_ANTIGA, { type: argon2.argon2id }),
      papel,
    },
  });
  criados.push(usuario.id);
  return usuario;
}

/** Extrai o token do último e-mail enviado, como a pessoa faria ao clicar no link. */
function tokenDoUltimoEmail(): string {
  const texto = emailsEnviados.at(-1)?.texto ?? "";
  const token = /token=([^\s]+)/.exec(texto)?.[1];
  if (!token) throw new Error("nenhum link no e-mail");
  return decodeURIComponent(token);
}

beforeAll(async () => {
  const admin = await criarUsuario("Admin", Papel.ADMIN);
  const conta = await criarUsuario("Conta", Papel.OPERADOR);
  adminId = admin.id;
  contaId = conta.id;
  emailDaConta = conta.email;
});

beforeEach(async () => {
  // cada caso começa com a janela de pedidos limpa; senão o freio contra
  // pedidos repetidos (3 por conta em 15 min) cala os casos seguintes
  await db.redefinicaoDeSenha.deleteMany({ where: { usuarioId: { in: criados } } });
  emailsEnviados.length = 0;
  limparTudo();
  emailEmUso.mockReturnValue(true);
  sessao = null;
});

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados } } });
  await db.usuario.deleteMany({ where: { id: { in: criados } } });
  await db.$disconnect();
});

describe("esqueci minha senha", () => {
  it("manda o link por e-mail e guarda só o hash do token", async () => {
    const resposta = await solicitarRedefinicao({}, formulario({ email: emailDaConta }));

    expect(resposta.aviso).toBeTruthy();
    expect(emailsEnviados).toHaveLength(1);
    expect(emailsEnviados[0]!.para).toBe(emailDaConta);

    const token = tokenDoUltimoEmail();
    const registro = await db.redefinicaoDeSenha.findUnique({
      where: { tokenHash: hashDoToken(token) },
    });
    expect(registro?.usuarioId).toBe(contaId);
    expect(registro?.tokenHash).not.toBe(token);
  });

  it("responde igual para e-mail que não existe, sem mandar nada", async () => {
    const existente = await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    emailsEnviados.length = 0;
    const inexistente = await solicitarRedefinicao(
      {},
      formulario({ email: `ninguem.${MARCA}@exemplo.test` })
    );

    expect(inexistente).toEqual(existente);
    expect(emailsEnviados).toHaveLength(0);
  });

  it("não manda link para conta inativa", async () => {
    const inativa = await criarUsuario("Inativa", Papel.OPERADOR);
    await db.usuario.update({ where: { id: inativa.id }, data: { ativo: false } });

    await solicitarRedefinicao({}, formulario({ email: inativa.email }));
    expect(emailsEnviados).toHaveLength(0);
  });

  it("avisa quando o e-mail do sistema não está configurado", async () => {
    emailEmUso.mockReturnValue(false);
    const resposta = await solicitarRedefinicao({}, formulario({ email: emailDaConta }));

    expect(resposta.erro).toMatch(/não está configurado/);
    expect(emailsEnviados).toHaveLength(0);
  });

  it("só o link mais recente vale", async () => {
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    const primeiro = tokenDoUltimoEmail();
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));

    const resposta = await redefinirSenha(
      {},
      formulario({ token: primeiro, novaSenha: SENHA_NOVA, confirmacao: SENHA_NOVA })
    );
    expect(resposta.erro).toMatch(/inválido ou expirou/);
  });

  it("freia a repetição de pedidos para a mesma conta", async () => {
    const conta = await criarUsuario("Alvo", Papel.OPERADOR);
    for (let i = 0; i < 6; i++) {
      await solicitarRedefinicao({}, formulario({ email: conta.email }));
    }
    expect(emailsEnviados.length).toBeLessThanOrEqual(3);
  });
});

describe("redefinir pela página do link", () => {
  it("troca a senha, desbloqueia a conta e gasta o link", async () => {
    await db.usuario.update({
      where: { id: contaId },
      data: { tentativasFalhas: 5, bloqueadoAte: new Date(Date.now() + 600_000) },
    });
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    const token = tokenDoUltimoEmail();

    await expect(
      redefinirSenha({}, formulario({ token, novaSenha: SENHA_NOVA, confirmacao: SENHA_NOVA }))
    ).rejects.toThrow("REDIRECT:/entrar?redefinida=1");

    const conta = await db.usuario.findUniqueOrThrow({ where: { id: contaId } });
    expect(await argon2.verify(conta.senhaHash, SENHA_NOVA)).toBe(true);
    expect(conta.tentativasFalhas).toBe(0);
    expect(conta.bloqueadoAte).toBeNull();

    const reuso = await redefinirSenha(
      {},
      formulario({ token, novaSenha: "OutraSenhaSegura2026", confirmacao: "OutraSenhaSegura2026" })
    );
    expect(reuso.erro).toMatch(/inválido ou expirou/);
  });

  it("não toca o segundo fator", async () => {
    await db.usuario.update({
      where: { id: contaId },
      data: { totpAtivo: true, totpSecret: "SEGREDO" },
    });
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    const token = tokenDoUltimoEmail();
    await expect(
      redefinirSenha({}, formulario({ token, novaSenha: SENHA_NOVA, confirmacao: SENHA_NOVA }))
    ).rejects.toThrow("REDIRECT");

    const conta = await db.usuario.findUniqueOrThrow({ where: { id: contaId } });
    expect(conta.totpAtivo).toBe(true);
    expect(conta.totpSecret).toBe("SEGREDO");
  });

  it("recusa link expirado", async () => {
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    const token = tokenDoUltimoEmail();
    await db.redefinicaoDeSenha.update({
      where: { tokenHash: hashDoToken(token) },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });

    const resposta = await redefinirSenha(
      {},
      formulario({ token, novaSenha: SENHA_NOVA, confirmacao: SENHA_NOVA })
    );
    expect(resposta.erro).toMatch(/inválido ou expirou/);
  });

  it("recusa token inventado", async () => {
    const resposta = await redefinirSenha(
      {},
      formulario({ token: "inventado", novaSenha: SENHA_NOVA, confirmacao: SENHA_NOVA })
    );
    expect(resposta.erro).toMatch(/inválido ou expirou/);
  });

  it("recusa senha fraca e confirmação diferente sem gastar o link", async () => {
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    const token = tokenDoUltimoEmail();

    const fraca = await redefinirSenha(
      {},
      formulario({ token, novaSenha: "curta", confirmacao: "curta" })
    );
    expect(fraca.erro).toBeTruthy();

    const diferente = await redefinirSenha(
      {},
      formulario({ token, novaSenha: SENHA_NOVA, confirmacao: `${SENHA_NOVA}x` })
    );
    expect(diferente.erro).toBe("As senhas não conferem.");

    const registro = await db.redefinicaoDeSenha.findUniqueOrThrow({
      where: { tokenHash: hashDoToken(token) },
    });
    expect(registro.usadoEm).toBeNull();
  });
});

describe("administrador troca a senha de outra conta", () => {
  it("troca a senha, desbloqueia e derruba links pendentes", async () => {
    await db.usuario.update({
      where: { id: contaId },
      data: { tentativasFalhas: 5, bloqueadoAte: new Date(Date.now() + 600_000) },
    });
    await solicitarRedefinicao({}, formulario({ email: emailDaConta }));
    const tokenPendente = tokenDoUltimoEmail();

    sessao = { id: adminId, papel: Papel.ADMIN };
    const resposta = await redefinirSenhaDeUsuario(
      {},
      formulario({ usuarioId: contaId, novaSenha: SENHA_NOVA })
    );
    expect(resposta.aviso).toBeTruthy();

    const conta = await db.usuario.findUniqueOrThrow({ where: { id: contaId } });
    expect(await argon2.verify(conta.senhaHash, SENHA_NOVA)).toBe(true);
    expect(conta.tentativasFalhas).toBe(0);
    expect(conta.bloqueadoAte).toBeNull();

    sessao = null;
    const link = await redefinirSenha(
      {},
      formulario({ token: tokenPendente, novaSenha: "OutraSenhaSegura2026", confirmacao: "OutraSenhaSegura2026" })
    );
    expect(link.erro).toMatch(/inválido ou expirou/);
  });

  it("registra na auditoria quem trocou e de quem", async () => {
    sessao = { id: adminId, papel: Papel.ADMIN };
    await redefinirSenhaDeUsuario({}, formulario({ usuarioId: contaId, novaSenha: SENHA_NOVA }));

    const log = await db.logAuditoria.findFirst({
      where: { acao: "REDEFINIU_SENHA", entidadeId: contaId, usuarioId: adminId },
    });
    expect(log).not.toBeNull();
    expect((log?.metadados as { origem?: string } | null)?.origem).toBe("administrador");
  });

  it("não permite a um administrador trocar a própria senha por aqui", async () => {
    sessao = { id: adminId, papel: Papel.ADMIN };
    const resposta = await redefinirSenhaDeUsuario(
      {},
      formulario({ usuarioId: adminId, novaSenha: SENHA_NOVA })
    );
    expect(resposta.erro).toMatch(/Esqueci minha senha/);
  });

  it("recusa senha fraca", async () => {
    sessao = { id: adminId, papel: Papel.ADMIN };
    const resposta = await redefinirSenhaDeUsuario(
      {},
      formulario({ usuarioId: contaId, novaSenha: "curta" })
    );
    expect(resposta.erro).toBeTruthy();
  });

  it("recusa quem não é administrador, inclusive operador", async () => {
    sessao = { id: contaId, papel: Papel.OPERADOR };
    await expect(
      redefinirSenhaDeUsuario({}, formulario({ usuarioId: adminId, novaSenha: SENHA_NOVA }))
    ).rejects.toThrow();

    const admin = await db.usuario.findUniqueOrThrow({ where: { id: adminId } });
    expect(await argon2.verify(admin.senhaHash, SENHA_ANTIGA)).toBe(true);
  });
});
