/**
 * Autorização — a regra mais sensível do sistema (CLAUDE.md, regra 3).
 * Cobre a lista de testes obrigatórios de docs/10-procuradores-e-representacao.md
 * no nível da regra. A prova contra o banco está em tests/integracao/autorizacao.test.ts
 */
import { describe, expect, it } from "vitest";
import { Papel, PapelNoAto, StatusAto } from "@prisma/client";
import { ESTADOS_LIBERADOS, montarFiltroDeAtos } from "@/lib/autorizacao";
import { SemPermissao } from "@/lib/erros";

const EQUIPE = [Papel.ADMIN, Papel.OPERADOR] as const;

describe("filtro de atos visíveis", () => {
  it("não restringe nada para ADMIN e OPERADOR", () => {
    for (const papel of EQUIPE) {
      expect(montarFiltroDeAtos({ papel, pessoaId: null })).toEqual({});
    }
  });

  it("exige vínculo com pessoa para perfil externo", () => {
    expect(() => montarFiltroDeAtos({ papel: Papel.PARTE, pessoaId: null })).toThrow(SemPermissao);
    expect(() => montarFiltroDeAtos({ papel: Papel.PROCURADOR, pessoaId: null })).toThrow(
      SemPermissao
    );
  });

  it("PARTE só enxerga vínculo como Interessado, nunca como procurador ou conciliador", () => {
    const filtro = montarFiltroDeAtos({ papel: Papel.PARTE, pessoaId: "pessoa-1" });
    const papeis = filtro.partes?.some?.papel;

    expect(filtro.partes?.some?.pessoaId).toBe("pessoa-1");
    expect(papeis).toEqual({ in: [PapelNoAto.SOLICITANTE, PapelNoAto.CONVIDADO] });
    expect(papeis).not.toHaveProperty("in", expect.arrayContaining([PapelNoAto.CONCILIADOR]));
  });

  it("PROCURADOR só enxerga vínculo com papel PROCURADOR (docs/10: se e somente se)", () => {
    const filtro = montarFiltroDeAtos({ papel: Papel.PROCURADOR, pessoaId: "proc-A" });

    expect(filtro.partes?.some?.pessoaId).toBe("proc-A");
    expect(filtro.partes?.some?.papel).toEqual({ in: [PapelNoAto.PROCURADOR] });
  });

  it("filtro de um procurador aponta para a própria pessoa, não para outro", () => {
    const a = montarFiltroDeAtos({ papel: Papel.PROCURADOR, pessoaId: "proc-A" });
    const b = montarFiltroDeAtos({ papel: Papel.PROCURADOR, pessoaId: "proc-B" });

    expect(a.partes?.some?.pessoaId).not.toBe(b.partes?.some?.pessoaId);
  });

  it("perfil externo só vê procedimento com sessão realizada", () => {
    for (const papel of [Papel.PARTE, Papel.PROCURADOR] as const) {
      const filtro = montarFiltroDeAtos({ papel, pessoaId: "pessoa-1" });
      expect(filtro.status).toEqual({ in: ESTADOS_LIBERADOS });
    }
  });

  it("nenhum estado anterior à sessão está liberado para perfil externo", () => {
    const bloqueados = [
      StatusAto.RASCUNHO,
      StatusAto.AGUARDANDO_DOCUMENTACAO,
      StatusAto.DOCUMENTACAO_EM_ANALISE,
      StatusAto.DATA_CONFIRMADA,
      StatusAto.CONVIDADO_CONVOCADO,
      StatusAto.CANCELADO,
    ];

    for (const status of bloqueados) {
      expect(ESTADOS_LIBERADOS).not.toContain(status);
    }
    expect(ESTADOS_LIBERADOS).toContain(StatusAto.SESSAO_REALIZADA);
  });
});
