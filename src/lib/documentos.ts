/**
 * Validação de CPF e CNPJ. Toda pessoa cadastrada passa por aqui.
 */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cpfEhValido(entrada: string): boolean {
  const cpf = apenasDigitos(entrada);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcular = (ateDigito: number): number => {
    let soma = 0;
    for (let i = 0; i < ateDigito; i++) {
      soma += Number(cpf[i]) * (ateDigito + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
}

export function cnpjEhValido(entrada: string): boolean {
  const cnpj = apenasDigitos(entrada);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcular = (base: string, pesos: number[]): number => {
    const soma = base.split("").reduce((acc, digito, i) => acc + Number(digito) * (pesos[i] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calcular(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcular(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

export function documentoEhValido(entrada: string): boolean {
  const digitos = apenasDigitos(entrada);
  if (digitos.length === 11) return cpfEhValido(digitos);
  if (digitos.length === 14) return cnpjEhValido(digitos);
  return false;
}

export function formatarDocumento(entrada: string): string {
  const d = apenasDigitos(entrada);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return entrada;
}
