/**
 * O cliente recusou o dígito verificador, então estas proteções deixaram de ser
 * desejáveis e viraram obrigatórias — docs/03. Se elas caírem, o sequencial
 * previsível do código fica exposto a varredura.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  LIMITES,
  aguardarTempoConstante,
  exigeDesafio,
  limparTudo,
  registrarAcerto,
  registrarConsulta,
  registrarFalha,
} from "@/lib/limite-de-taxa";

beforeEach(() => limparTudo());

describe("limite por IP", () => {
  it("permite até o limite por minuto", () => {
    for (let i = 0; i < LIMITES.porMinuto; i++) {
      expect(registrarConsulta("ip-a").permitido).toBe(true);
    }
  });

  it("bloqueia a partir da consulta seguinte", () => {
    for (let i = 0; i < LIMITES.porMinuto; i++) registrarConsulta("ip-a");
    const veredito = registrarConsulta("ip-a");

    expect(veredito.permitido).toBe(false);
    expect(veredito.esperarSegundos).toBeGreaterThan(0);
  });

  it("libera de novo depois que o minuto passa", () => {
    const inicio = 1_000_000;
    for (let i = 0; i < LIMITES.porMinuto; i++) registrarConsulta("ip-a", inicio);
    expect(registrarConsulta("ip-a", inicio + 1_000).permitido).toBe(false);
    expect(registrarConsulta("ip-a", inicio + 61_000).permitido).toBe(true);
  });

  it("aplica o teto por hora mesmo com as consultas espalhadas", () => {
    const inicio = 1_000_000;
    // uma a cada 20s: nunca estoura o minuto, mas chega ao teto da hora
    for (let i = 0; i < LIMITES.porHora; i++) registrarConsulta("ip-a", inicio + i * 20_000);
    const veredito = registrarConsulta("ip-a", inicio + LIMITES.porHora * 20_000);

    expect(veredito.permitido).toBe(false);
  });

  it("um IP não afeta o limite de outro", () => {
    for (let i = 0; i < LIMITES.porMinuto; i++) registrarConsulta("ip-a");

    expect(registrarConsulta("ip-a").permitido).toBe(false);
    expect(registrarConsulta("ip-b").permitido).toBe(true);
  });
});

describe("desafio após consultas sem resultado", () => {
  it("não exige desafio no uso normal", () => {
    registrarConsulta("ip-a");
    registrarFalha("ip-a");
    expect(exigeDesafio("ip-a")).toBe(false);
  });

  it("exige desafio ao cruzar o limiar de falhas seguidas", () => {
    for (let i = 0; i < LIMITES.falhasAteDesafio; i++) registrarFalha("ip-a");
    expect(exigeDesafio("ip-a")).toBe(true);
  });

  it("um acerto zera a contagem de falhas", () => {
    for (let i = 0; i < LIMITES.falhasAteDesafio; i++) registrarFalha("ip-a");
    registrarAcerto("ip-a");
    expect(exigeDesafio("ip-a")).toBe(false);
  });
});

describe("tempo de resposta constante", () => {
  it("espera até o mínimo quando a consulta foi rápida", async () => {
    const inicio = Date.now();
    await aguardarTempoConstante(inicio, 120);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(115);
  });

  it("não adia quando a consulta já demorou mais que o mínimo", async () => {
    const comecouAntes = Date.now() - 500;
    const antes = Date.now();
    await aguardarTempoConstante(comecouAntes, 120);
    expect(Date.now() - antes).toBeLessThan(60);
  });
});
