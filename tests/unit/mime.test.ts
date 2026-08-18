import { describe, expect, it } from "vitest";
import { detectarTipo, extensaoDoTipo, formatarTamanho, validarArquivo } from "@/lib/mime";
import { ErroDeNegocio } from "@/lib/erros";

const pdf = () => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20)]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const png = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

describe("validação de arquivo pelo conteúdo", () => {
  it("reconhece PDF, JPEG e PNG pela assinatura", () => {
    expect(detectarTipo(pdf())).toBe("application/pdf");
    expect(detectarTipo(jpeg())).toBe("image/jpeg");
    expect(detectarTipo(png())).toBe("image/png");
  });

  it("recusa conteúdo que não é dos formatos aceitos", () => {
    expect(detectarTipo(Buffer.from("MZ\x90\x00 executavel"))).toBeNull();
    expect(detectarTipo(Buffer.from("<?php echo 1; ?>"))).toBeNull();
    expect(detectarTipo(Buffer.from("PK\x03\x04 zip"))).toBeNull();
  });

  it("extensão mentirosa não engana: vale o conteúdo", () => {
    // executável renomeado para .pdf é exatamente o ataque que docs/04 cita
    const disfarcado = Buffer.from("MZ\x90\x00 conteudo executavel");
    expect(() => validarArquivo(disfarcado, "contrato.pdf")).toThrow(ErroDeNegocio);
  });

  it("aceita PDF de verdade e devolve o tipo real", () => {
    expect(validarArquivo(pdf(), "carta.pdf")).toBe("application/pdf");
  });

  it("recusa arquivo vazio", () => {
    expect(() => validarArquivo(Buffer.alloc(0), "vazio.pdf")).toThrow(/vazio/i);
  });

  it("recusa arquivo acima do limite", () => {
    const grande = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(21 * 1024 * 1024)]);
    expect(() => validarArquivo(grande, "enorme.pdf")).toThrow(/MB/);
  });

  it("mensagem de erro é apresentável e em português", () => {
    try {
      validarArquivo(Buffer.from("nada disso"), "planilha.xlsx");
      throw new Error("deveria ter lançado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeNegocio);
      expect((erro as Error).message).toMatch(/não é um PDF, JPEG ou PNG/);
    }
  });

  it("mapeia tipo para extensão", () => {
    expect(extensaoDoTipo("application/pdf")).toBe("pdf");
    expect(extensaoDoTipo("image/png")).toBe("png");
    expect(extensaoDoTipo("image/jpeg")).toBe("jpg");
  });

  it("formata tamanho de forma legível", () => {
    expect(formatarTamanho(500)).toBe("500 B");
    expect(formatarTamanho(2048)).toBe("2 KB");
    expect(formatarTamanho(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
