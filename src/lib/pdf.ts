/**
 * Motor de geração de PDF.
 *
 * Renderiza HTML no Chromium e imprime em PDF. O Chromium vem do sistema em
 * produção (o Dockerfile instala o pacote e aponta o caminho), e do navegador
 * do Playwright em desenvolvimento.
 *
 * Roda só no servidor: nunca importe este módulo de um Client Component.
 */
import { chromium, type Browser } from "playwright";

let navegador: Browser | null = null;

/**
 * Um navegador só, reaproveitado entre gerações. Subir Chromium custa segundos;
 * abrir uma aba custa milissegundos.
 */
async function obterNavegador(): Promise<Browser> {
  if (navegador?.isConnected()) return navegador;

  navegador = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return navegador;
}

export async function encerrarNavegador(): Promise<void> {
  await navegador?.close();
  navegador = null;
}

/**
 * Imprime o HTML em PDF A4, sem margem de página: o timbrado é sangrado (as
 * faixas encostam nas bordas da folha) e o espaço do texto é reservado pelo
 * próprio documento. Ver `timbrar` em src/documentos/timbrado.ts.
 */
export async function gerarPdf(params: { html: string }): Promise<Buffer> {
  const nav = await obterNavegador();
  const contexto = await nav.newContext();

  try {
    const pagina = await contexto.newPage();
    // waitUntil networkidle não serve: o HTML é autocontido, sem rede
    await pagina.setContent(params.html, { waitUntil: "load" });

    return await pagina.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await contexto.close();
  }
}
