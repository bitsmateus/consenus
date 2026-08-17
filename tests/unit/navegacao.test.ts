import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/navegacao";

describe("destino de redirecionamento após o login", () => {
  it("aceita caminho interno", () => {
    expect(destinoSeguro("/atos/123")).toBe("/atos/123");
    expect(destinoSeguro("/painel")).toBe("/painel");
  });

  it("cai no padrão quando não há destino", () => {
    expect(destinoSeguro(undefined)).toBe("/painel");
    expect(destinoSeguro("")).toBe("/painel");
    expect(destinoSeguro(null)).toBe("/painel");
  });

  it("recusa endereço externo", () => {
    expect(destinoSeguro("https://exemplo.invalido")).toBe("/painel");
    expect(destinoSeguro("http://exemplo.invalido")).toBe("/painel");
  });

  it("recusa protocolo-relativo, que começa com barra mas sai do site", () => {
    expect(destinoSeguro("//exemplo.invalido")).toBe("/painel");
    expect(destinoSeguro("//exemplo.invalido/painel")).toBe("/painel");
  });

  it("recusa barra invertida, que alguns navegadores tratam como barra", () => {
    expect(destinoSeguro("/\\exemplo.invalido")).toBe("/painel");
  });

  it("recusa quebra de linha e caractere de controle", () => {
    expect(destinoSeguro("/painel\nLocation: https://exemplo.invalido")).toBe("/painel");
    expect(destinoSeguro("/painel\r\nSet-Cookie: a=b")).toBe("/painel");
  });

  it("respeita padrão informado", () => {
    expect(destinoSeguro("//exemplo.invalido", "/entrar")).toBe("/entrar");
  });
});
