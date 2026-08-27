"use client";

import { avisar } from "@/components/ui/avisos";

/**
 * Sala da videoconferência, com o link à mão para o operador copiar.
 *
 * O link já ia na Carta-Convite, mas ficava só lá dentro: para reenviar por
 * WhatsApp, ou para entrar na hora da sessão, o operador tinha de abrir o PDF.
 */
export function SalaDaVideoconferencia({
  link,
  idReuniao,
  senha,
  quando,
}: {
  link: string;
  idReuniao: string | null;
  senha: string | null;
  /** Data e hora já formatadas, para o texto do convite. */
  quando: string;
}) {
  async function copiar(texto: string, oQue: string) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(`${oQue} copiado.`);
    } catch {
      // navegador antigo, ou página sem HTTPS: o link continua selecionável
      avisar("Não foi possível copiar. Selecione o link e copie à mão.", "erro");
    }
  }

  const convite = [
    "Sessão Privada de Conciliação — Consensus One",
    quando && `Data: ${quando}`,
    `Link: ${link}`,
    idReuniao && `ID da reunião: ${idReuniao}`,
    senha && `Senha: ${senha}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mt-3 border-t border-carvao-100 pt-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-carvao-300">
        Sala da videoconferência
      </p>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block break-all text-xs text-dourado-600 hover:underline"
      >
        {link}
      </a>

      {(idReuniao || senha) && (
        <p className="mt-1.5 text-[11px] text-carvao-500">
          {idReuniao && <>ID {idReuniao}</>}
          {idReuniao && senha && " · "}
          {senha && <>Senha {senha}</>}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copiar(link, "Link")}
          className="rounded-md border border-carvao-100 px-2.5 py-1.5 text-[11px] font-medium text-carvao-700 hover:border-dourado-600 hover:text-dourado-600"
        >
          Copiar link
        </button>
        <button
          type="button"
          onClick={() => copiar(convite, "Convite")}
          className="rounded-md border border-carvao-100 px-2.5 py-1.5 text-[11px] font-medium text-carvao-700 hover:border-dourado-600 hover:text-dourado-600"
        >
          Copiar convite
        </button>
      </div>
    </div>
  );
}
