import { describe, expect, it } from "vitest";
import { cpfEhValido, cnpjEhValido, documentoEhValido, formatarDocumento } from "@/lib/documentos";

describe("validação de CPF e CNPJ", () => {
  it("aceita CNPJ real do cliente", () => {
    expect(cnpjEhValido("68.052.966/0001-06")).toBe(true);
  });

  it("aceita CNPJ real da NX", () => {
    expect(cnpjEhValido("59.935.008/0001-92")).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(cnpjEhValido("68.052.966/0001-07")).toBe(false);
  });

  it("rejeita sequência repetida", () => {
    expect(cpfEhValido("111.111.111-11")).toBe(false);
    expect(cnpjEhValido("11.111.111/1111-11")).toBe(false);
  });

  it("rejeita tamanho inválido", () => {
    expect(documentoEhValido("123")).toBe(false);
  });

  it("formata para exibição", () => {
    expect(formatarDocumento("68052966000106")).toBe("68.052.966/0001-06");
  });
});
