/**
 * Erro de negócio: mensagem em português, apresentável ao usuário.
 * Erro técnico nunca vaza para a tela.
 */
export class ErroDeNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeNegocio";
  }
}

export class SemPermissao extends ErroDeNegocio {
  constructor(mensagem = "Você não tem permissão para acessar este recurso.") {
    super(mensagem);
    this.name = "SemPermissao";
  }
}

export class FluxoInvalido extends ErroDeNegocio {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "FluxoInvalido";
  }
}
