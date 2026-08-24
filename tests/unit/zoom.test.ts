import { describe, expect, it } from "vitest";
import { instanteParaZoom, topicoDaReuniao, videoconferenciaAtiva } from "@/lib/zoom";

describe("agendamento no Zoom", () => {
  it("manda hora de parede em São Paulo, sem sufixo de fuso", () => {
    // 12/09/2026 às 14:00 em São Paulo é 17:00 UTC
    const quando = new Date("2026-09-12T17:00:00Z");
    expect(instanteParaZoom(quando)).toBe("2026-09-12T14:00:00");
  });

  it("não muda o dia quando a conversão atravessa a meia-noite UTC", () => {
    // 01:00 UTC do dia 13 ainda é dia 12, às 22:00, em São Paulo
    const quando = new Date("2026-09-13T01:00:00Z");
    expect(instanteParaZoom(quando)).toBe("2026-09-12T22:00:00");
  });

  it("o assunto identifica o procedimento sem expor nome de parte", () => {
    const topico = topicoDaReuniao("2026.0007");
    expect(topico).toContain("2026.0007");
    expect(topico).toContain("Sessão Privada de Conciliação");
  });

  it("a integração fica desligada quando falta qualquer credencial", () => {
    const guardado = {
      conta: process.env.ZOOM_ACCOUNT_ID,
      cliente: process.env.ZOOM_CLIENT_ID,
      segredo: process.env.ZOOM_CLIENT_SECRET,
    };
    try {
      process.env.ZOOM_ACCOUNT_ID = "conta";
      process.env.ZOOM_CLIENT_ID = "cliente";
      delete process.env.ZOOM_CLIENT_SECRET;
      expect(videoconferenciaAtiva()).toBe(false);

      process.env.ZOOM_CLIENT_SECRET = "segredo";
      expect(videoconferenciaAtiva()).toBe(true);
    } finally {
      process.env.ZOOM_ACCOUNT_ID = guardado.conta;
      process.env.ZOOM_CLIENT_ID = guardado.cliente;
      process.env.ZOOM_CLIENT_SECRET = guardado.segredo;
    }
  });
});
