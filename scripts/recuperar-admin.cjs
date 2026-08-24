/**
 * Recupera o acesso de administrador quando ninguém mais consegue entrar.
 *
 * Existe porque o sistema não tem "esqueci minha senha" — por decisão de
 * projeto, já que redefinição por e-mail seria a porta mais fraca de um sistema
 * que guarda documento de conciliação. E a tela de Equipe altera papel e
 * ativo/inativo, mas nunca a senha de terceiro, nem o segundo fator, que é
 * obrigatório para ADMIN e OPERADOR (docs/04).
 *
 * Sobra a intervenção direta, feita aqui e sempre registrada em LogAuditoria.
 *
 * CommonJS de propósito, como o criar-admin.cjs: roda dentro do container de
 * produção, onde não há tsx nem dependência de desenvolvimento.
 *
 * ---------------------------------------------------------------------------
 * Uso 1 — descobrir qual é a conta (só lê, não altera nada):
 *
 *   node scripts/recuperar-admin.cjs
 *
 * Uso 2 — redefinir a senha da conta escolhida:
 *
 *   ADMIN_EMAIL="sergio@consensusone.com.br" \
 *   ADMIN_SENHA="uma senha longa e única" \
 *   node scripts/recuperar-admin.cjs
 *
 * A recuperação também zera o segundo fator, desbloqueia a conta e a reativa.
 * Zerar o segundo fator é o ponto do exercício: de nada adianta a senha nova se
 * o autenticador ficou no celular antigo. No próximo acesso o sistema pede o
 * cadastro do autenticador de novo, do zero.
 *
 * Se NÃO houver nenhum administrador no banco, este script não serve: use o
 * criar-admin.cjs, que volta a funcionar justamente nessa situação.
 */
const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const db = new PrismaClient();

/** Mesma política da tela de Equipe: senha curta é o elo fraco de tudo. */
function conferirSenha(senha) {
  const problemas = [];
  if (senha.length < 12) problemas.push("ao menos 12 caracteres");
  if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha)) problemas.push("maiúsculas e minúsculas");
  if (!/\d/.test(senha)) problemas.push("ao menos um número");

  if (problemas.length > 0) {
    console.error(`ERRO: a senha precisa de ${problemas.join(", ")}.`);
    process.exit(1);
  }
}

function quando(data) {
  if (!data) return "nunca";
  try {
    return data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return data.toISOString();
  }
}

/** Lista as contas ADMIN para a pessoa reconhecer qual é a dela. */
async function listar() {
  const admins = await db.usuario.findMany({
    where: { papel: "ADMIN" },
    orderBy: [{ ativo: "desc" }, { criadoEm: "asc" }],
    select: {
      nome: true,
      email: true,
      ativo: true,
      totpAtivo: true,
      tentativasFalhas: true,
      bloqueadoAte: true,
      ultimoLoginEm: true,
      criadoEm: true,
    },
  });

  if (admins.length === 0) {
    console.log("");
    console.log("Não há nenhuma conta de administrador no banco.");
    console.log("Use o criar-admin.cjs: ele volta a funcionar quando não existe admin ativo.");
    console.log("");
    return;
  }

  console.log("");
  console.log(`Contas de administrador (${admins.length}):`);
  console.log("");
  for (const a of admins) {
    const bloqueada = a.bloqueadoAte && a.bloqueadoAte > new Date();
    console.log(`  ${a.email}`);
    console.log(`    nome ............... ${a.nome}`);
    console.log(`    situação ........... ${a.ativo ? "ativa" : "INATIVA"}${bloqueada ? " · BLOQUEADA até " + quando(a.bloqueadoAte) : ""}`);
    console.log(`    segundo fator ...... ${a.totpAtivo ? "configurado" : "não configurado"}`);
    console.log(`    tentativas falhas .. ${a.tentativasFalhas}`);
    console.log(`    último acesso ...... ${quando(a.ultimoLoginEm)}`);
    console.log(`    criada em .......... ${quando(a.criadoEm)}`);
    console.log("");
  }
  console.log("Para redefinir, rode de novo com ADMIN_EMAIL e ADMIN_SENHA.");
  console.log("");
}

async function recuperar(email, senha) {
  conferirSenha(senha);

  const alvo = await db.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, email: true, papel: true },
  });

  if (!alvo) {
    console.error(`ERRO: não existe conta com o e-mail ${email}.`);
    console.error("Rode sem ADMIN_EMAIL para listar os administradores.");
    process.exit(1);
  }

  // Recuperar acesso não é promover ninguém: se a conta não é ADMIN, a troca de
  // papel tem lugar próprio (tela de Equipe), com quem promoveu registrado.
  if (alvo.papel !== "ADMIN") {
    console.error(`ERRO: ${alvo.email} tem perfil ${alvo.papel}, não ADMIN.`);
    console.error("Este script não promove conta. Use a tela de Equipe.");
    process.exit(1);
  }

  await db.usuario.update({
    where: { id: alvo.id },
    data: {
      senhaHash: await argon2.hash(senha, { type: argon2.argon2id }),
      // o autenticador antigo se perdeu junto com o acesso
      totpSecret: null,
      totpAtivo: false,
      // tentativas de adivinhar a senha esquecida não podem barrar a retomada
      tentativasFalhas: 0,
      bloqueadoAte: null,
      ativo: true,
    },
  });

  // Nunca registre a senha nem o hash: docs/04 e o cabeçalho de lib/auditoria.
  await db.logAuditoria.create({
    data: {
      usuarioId: alvo.id,
      acao: "RECUPEROU_ACESSO",
      entidade: "Usuario",
      entidadeId: alvo.id,
      metadados: {
        email: alvo.email,
        origem: "recuperar-admin.cjs",
        segundoFatorZerado: true,
      },
    },
  });

  console.log("");
  console.log(`Acesso recuperado: ${alvo.email}`);
  console.log("");
  console.log("O segundo fator foi zerado. No próximo acesso o sistema vai pedir");
  console.log("o cadastro do aplicativo autenticador de novo — tenha ele à mão.");
  console.log("");
  console.log("A recuperação ficou registrada na tela de Auditoria.");
  console.log("");
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA || "";

  if (!email && !senha) {
    await listar();
    return;
  }

  if (!email || !senha) {
    console.error("ERRO: informe ADMIN_EMAIL e ADMIN_SENHA juntos.");
    console.error("Sem nenhum dos dois, o script apenas lista os administradores.");
    process.exit(1);
  }

  await recuperar(email, senha);
}

main()
  .catch((erro) => {
    console.error("Falhou:", erro.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
