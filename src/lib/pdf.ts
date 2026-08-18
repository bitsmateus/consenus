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

/** Margens do papel timbrado oficial, em milímetros. */
const MARGENS = { top: "26mm", bottom: "34mm", left: "20mm", right: "20mm" };

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

export async function gerarPdf(params: {
  html: string;
  cabecalho: string;
  rodape: string;
}): Promise<Buffer> {
  const nav = await obterNavegador();
  const contexto = await nav.newContext();

  try {
    const pagina = await contexto.newPage();
    // waitUntil networkidle não serve: o HTML é autocontido, sem rede
    await pagina.setContent(params.html, { waitUntil: "load" });

    return await pagina.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: params.cabecalho,
      footerTemplate: params.rodape,
      margin: MARGENS,
    });
  } finally {
    await contexto.close();
  }
}
