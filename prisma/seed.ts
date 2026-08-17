/**
 * Dados de demonstração para desenvolvimento e treinamento.
 * NUNCA rodar em produção com dados reais.
 */
import { PrismaClient, Papel, TipoPessoa } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

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

  await db.usuario.upsert({
    where: { email: "admin@consensusone.com.br" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@consensusone.com.br",
      senhaHash,
      papel: Papel.ADMIN,
    },
  });

  await db.usuario.upsert({
    where: { email: "operador@consensusone.com.br" },
    update: {},
    create: {
      nome: "Operador de Demonstração",
      email: "operador@consensusone.com.br",
      senhaHash,
      papel: Papel.OPERADOR,
    },
  });

  await db.pessoa.upsert({
    where: { documento: "39053344705" },
    update: {},
    create: {
      tipo: TipoPessoa.FISICA,
      nome: "Maria Aparecida de Souza",
      documento: "39053344705",
      email: "maria.demo@exemplo.com.br",
      cidade: "Mogi das Cruzes",
      uf: "SP",
    },
  });

  console.log("Dados de demonstração criados.");
  console.log("Login: admin@consensusone.com.br / Consensus@2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
