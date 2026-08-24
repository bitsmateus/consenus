/**
 * Cria uma conta de administrador pelo console do container.
 *
 * Existe por causa de um ovo e uma galinha: criar conta pela interface exige
 * estar logado como administrador, e o seed de demonstração se recusa a rodar
 * em produção. Sem este script, sobe o sistema e ninguém consegue entrar.
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
 * Por padrão só cria o PRIMEIRO administrador: havendo um admin ativo, o
 * caminho certo é a tela de Equipe, que registra quem criou a conta. Esse
 * registro é a razão da recusa — conta criada por fora nasce sem responsável.
 *
 * Quando não há como usar a tela — ninguém consegue mais entrar como admin —,
 * repita o comando com PERMITIR_SEGUNDO_ADMIN=sim. A criação continua indo
 * para o LogAuditoria, marcada como feita pelo console.
 *
 * Antes disso, considere o scripts/recuperar-admin.cjs: se o problema é senha
 * ou autenticador perdido, recuperar a conta existente preserva o histórico
 * dela e não deixa mais um administrador solto no sistema.
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
  const forcado = (process.env.PERMITIR_SEGUNDO_ADMIN || "").trim().toLowerCase() === "sim";

  if (jaExiste > 0 && !forcado) {
    console.error("ERRO: já existe administrador ativo.");
    console.error("");
    console.error("O caminho normal é a tela de Equipe, que registra quem criou a conta.");
    console.error("Se você perdeu o acesso ao admin existente, há duas saídas:");
    console.error("  recuperar aquela conta ..... node scripts/recuperar-admin.cjs");
    console.error("  criar outra assim mesmo .... repita com PERMITIR_SEGUNDO_ADMIN=sim");
    process.exit(1);
  }

  const repetido = await db.usuario.findUnique({
    where: { email },
    select: { papel: true, ativo: true },
  });
  if (repetido) {
    console.error(`ERRO: já existe conta com o e-mail ${email} (perfil ${repetido.papel}).`);
    if (repetido.papel === "ADMIN") {
      console.error("Para retomar essa conta, use o scripts/recuperar-admin.cjs.");
    }
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

  // Nunca registre a senha nem o hash: docs/04 e o cabeçalho de lib/auditoria.
  await db.logAuditoria.create({
    data: {
      usuarioId: usuario.id,
      acao: "CRIOU_USUARIO",
      entidade: "Usuario",
      entidadeId: usuario.id,
      metadados: {
        email: usuario.email,
        papel: "ADMIN",
        origem: "criar-admin.cjs",
        // conta nascida pelo console não tem criador identificado: fica o aviso
        // de que este registro não aponta responsável, ao contrário da tela.
        semResponsavelIdentificado: true,
        adminAdicional: forcado,
      },
    },
  });

  console.log("");
  console.log(`Administrador criado: ${usuario.email}`);
  if (forcado) {
    console.log("");
    console.log(`Atenção: o sistema já tinha ${jaExiste} administrador(es) ativo(s).`);
    console.log("Revise a tela de Equipe e desative o que não for mais usado.");
  }
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
