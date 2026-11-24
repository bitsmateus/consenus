/**
 * Lista os documentos com envio ainda pendente na D4Sign — os que serão
 * reenviados pela ZapSign (decisão do escritório em 24/11/2026). Só leitura:
 * não fala com a D4Sign nem com a ZapSign e não muda nada no banco.
 *
 *   npm run assinatura:pendentes-d4sign
 *
 * O reenvio em si é pelo botão "Reenviar pela ZapSign", na página de cada
 * procedimento, e só aparece com a ZapSign ligada.
 */
import { PrismaClient, ProvedorAssinatura, StatusAssinatura } from "@prisma/client";

const db = new PrismaClient();

async function principal() {
  const pendentes = await db.operacaoAssinatura.findMany({
    where: {
      provedor: ProvedorAssinatura.D4SIGN,
      status: { in: [StatusAssinatura.AGUARDANDO, StatusAssinatura.PARCIAL] },
    },
    orderBy: { criadoEm: "asc" },
    select: {
      status: true,
      jaAssinaram: true,
      totalSignatarios: true,
      criadoEm: true,
      ato: { select: { numero: true } },
      documento: { select: { tipo: true, codigoVerificacao: true } },
    },
  });

  if (pendentes.length === 0) {
    console.log("Nenhum envio pendente na D4Sign.");
    return;
  }

  console.log(`${pendentes.length} envio(s) pendente(s) na D4Sign:\n`);
  for (const p of pendentes) {
    const enviado = p.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    console.log(
      `Procedimento ${p.ato.numero} · ${p.documento.tipo} ${p.documento.codigoVerificacao ?? ""} · ` +
        `${p.jaAssinaram} de ${p.totalSignatarios} assinaram · enviado em ${enviado}`
    );
  }
}

principal()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
