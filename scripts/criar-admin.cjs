/**
 * Cria o PRIMEIRO administrador do sistema.
 *
 * Existe porque há um ovo e uma galinha: criar conta pela interface exige estar
 * logado como administrador, e o seed de demonstração se recusa a rodar em
 * produção. Sem este script, sobe o sistema e ninguém consegue entrar.
 *
 * CommonJS de propósito: roda dentro do container de produção, onde não há tsx
 * nem as dependências de desenvolvimento.
 *
 * Uso (no console do container, no EasyPanel):
 *   ADMIN_NOME="Sergio Ferreira" \
 *   ADMIN_EMAIL="sergio@consensusone.com.br" \
 *   ADMIN_SENHA="uma senha longa e única" \
 *   node scripts/criar-admin.cjs
 *
 * Recusa criar um segundo administrador: depois do primeiro, contas saem da
 * tela de Equipe, com a criação registrada em LogAuditoria.
 */
const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const db = new PrismaClient();

function exigir(nome) {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    console.error(`ERRO: defina ${nome}.`);
    process.exit(1);
  }
  return valor.trim();
}

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

async function main() {
  const nome = exigir("ADMIN_NOME");
  const email = exigir("ADMIN_EMAIL").toLowerCase();
  const senha = exigir("ADMIN_SENHA");

  conferirSenha(senha);

  const jaExiste = await db.usuario.count({ where: { papel: "ADMIN", ativo: true } });
  if (jaExiste > 0) {
    console.error("ERRO: já existe administrador ativo.");
    console.error("Crie as demais contas pela tela de Equipe, que registra quem criou.");
    process.exit(1);
  }

  const usuario = await db.usuario.create({
    data: {
      nome,
      email,
      papel: "ADMIN",
      senhaHash: await argon2.hash(senha, { type: argon2.argon2id }),
    },
  });

  await db.logAuditoria.create({
    data: {
      usuarioId: usuario.id,
      acao: "CRIOU_USUARIO",
      entidade: "Usuario",
      entidadeId: usuario.id,
      metadados: { email: usuario.email, papel: "ADMIN", origem: "criar-admin.cjs" },
    },
  });

  console.log("");
  console.log(`Administrador criado: ${usuario.email}`);
  console.log("");
  console.log("No primeiro acesso o sistema vai exigir a verificação em duas etapas:");
  console.log("tenha um aplicativo autenticador à mão antes de entrar.");
  console.log("");
}

main()
  .catch((erro) => {
    console.error("Falhou:", erro.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
