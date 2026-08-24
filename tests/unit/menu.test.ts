import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { MENU_EQUIPE, montarMenu } from "@/lib/menu";

const enderecos = (papel: Papel) => montarMenu(papel).map((item) => item.href);

describe("menu por papel", () => {
  it("ADMIN vê tudo, inclusive Equipe e Auditoria", () => {
    expect(enderecos(Papel.ADMIN)).toEqual(MENU_EQUIPE.map((item) => item.href));
  });

  it("OPERADOR não vê Equipe nem Auditoria, que exigem ADMIN", () => {
    const visiveis = enderecos(Papel.OPERADOR);
    expect(visiveis).not.toContain("/equipe");
    expect(visiveis).not.toContain("/auditoria");
  });

  it("OPERADOR continua com o que é do trabalho dele", () => {
    const visiveis = enderecos(Papel.OPERADOR);
    expect(visiveis).toContain("/painel");
    expect(visiveis).toContain("/atos");
    expect(visiveis).toContain("/pessoas");
    expect(visiveis).toContain("/documentos");
  });

  it("PARTE e PROCURADOR não recebem nenhuma rota da equipe", () => {
    const internas = ["/atos", "/pessoas", "/equipe", "/auditoria"];
    for (const papel of [Papel.PARTE, Papel.PROCURADOR]) {
      const visiveis = enderecos(papel);
      for (const rota of internas) {
        expect(visiveis, `${papel} não pode ver ${rota}`).not.toContain(rota);
      }
      expect(visiveis).toContain("/meus-dados");
    }
  });

  it("todo item marcado como somenteAdmin some para quem não é ADMIN", () => {
    const restritos = MENU_EQUIPE.filter((item) => item.somenteAdmin).map((item) => item.href);
    expect(restritos.length).toBeGreaterThan(0);
    for (const rota of restritos) {
      expect(enderecos(Papel.OPERADOR)).not.toContain(rota);
    }
  });
});
