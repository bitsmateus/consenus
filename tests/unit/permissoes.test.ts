/**
 * Permissões por sub-perfil de OPERADOR — pedido do cliente em 15/09.
 */
import { describe, expect, it, vi } from "vitest";
import { Papel, SubPapelOperador } from "@prisma/client";
import { SemPermissao } from "@/lib/erros";
import type { Acao } from "@/lib/permissoes";

// `permissoes.ts` importa `sessao.ts` (por `exigirPermissao`), que importa
// `@/auth` — e isso arrasta `next-auth`/`next/server`, que não resolve fora
// do runtime do Next. Este teste só exercita as funções puras, mas o módulo
// inteiro precisa carregar; o mock evita a cadeia de import quebrar o teste.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

const { garantirPermissao, temPermissao } = await import("@/lib/permissoes");

const ACOES_CAMARA: Acao[] = [
  "CONFERIR_DOCUMENTO",
  "CONFIRMAR_DATA",
  "GERAR_CARTA_CONVIDADO",
  "ENVIAR_CARTA_CONVIDADO",
];

const ACOES_INTERESSADO: Acao[] = [
  "CADASTRAR_PARTE",
  "CADASTRAR_DEMANDA",
  "GERAR_CARTA_INTERESSADO",
  "ENVIAR_CARTA_INTERESSADO",
  "SUBIR_DOCUMENTO",
];

const TODAS_AS_ACOES = [...ACOES_CAMARA, ...ACOES_INTERESSADO];

describe("temPermissao", () => {
  it("ADMIN pode tudo, mesmo com um sub-perfil atribuído por engano", () => {
    for (const acao of TODAS_AS_ACOES) {
      expect(temPermissao({ papel: Papel.ADMIN, subPapelOperador: SubPapelOperador.CAMARA }, acao)).toBe(
        true
      );
    }
  });

  it("OPERADOR sem sub-perfil continua com acesso a todo o fluxo", () => {
    for (const acao of TODAS_AS_ACOES) {
      expect(temPermissao({ papel: Papel.OPERADOR, subPapelOperador: null }, acao)).toBe(true);
    }
  });

  it("Operador Câmara só pode as ações da Larissa", () => {
    const usuario = { papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.CAMARA };
    for (const acao of ACOES_CAMARA) {
      expect(temPermissao(usuario, acao)).toBe(true);
    }
    for (const acao of ACOES_INTERESSADO) {
      expect(temPermissao(usuario, acao)).toBe(false);
    }
  });

  it("Operador Consultoria/Procurador (Interessado) só pode cadastro, carta e upload", () => {
    const usuario = { papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.INTERESSADO };
    for (const acao of ACOES_INTERESSADO) {
      expect(temPermissao(usuario, acao)).toBe(true);
    }
    for (const acao of ACOES_CAMARA) {
      expect(temPermissao(usuario, acao)).toBe(false);
    }
  });
});

describe("garantirPermissao", () => {
  it("não lança nada quando a permissão existe", () => {
    expect(() =>
      garantirPermissao(
        { papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.CAMARA },
        "CONFIRMAR_DATA"
      )
    ).not.toThrow();
  });

  it("lança SemPermissao quando o sub-perfil não cobre a ação", () => {
    expect(() =>
      garantirPermissao(
        { papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.CAMARA },
        "SUBIR_DOCUMENTO"
      )
    ).toThrow(SemPermissao);
  });
});

describe("temAcessoCompleto", () => {
  it("administrador e operador sem sub-perfil têm; operador com sub-perfil não", async () => {
    const { temAcessoCompleto } = await import("@/lib/permissoes");
    expect(temAcessoCompleto({ papel: Papel.ADMIN, subPapelOperador: SubPapelOperador.CAMARA })).toBe(true);
    expect(temAcessoCompleto({ papel: Papel.OPERADOR, subPapelOperador: null })).toBe(true);
    expect(temAcessoCompleto({ papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.CAMARA })).toBe(false);
    expect(temAcessoCompleto({ papel: Papel.OPERADOR, subPapelOperador: SubPapelOperador.INTERESSADO })).toBe(false);
  });
});
