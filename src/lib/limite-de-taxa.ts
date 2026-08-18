/**
 * Limite de consultas por IP e tempo de resposta constante.
 *
 * Como o cliente recusou o dígito verificador (docs/09, item 3), o sequencial
 * do código é previsível e a página de verificação vira a ÚNICA barreira contra
 * varredura. As proteções de docs/03 deixaram de ser desejáveis e passaram a
 * ser obrigatórias.
 *
 * O contador é em memória: some quando o processo reinicia e não é compartilhado
 * entre réplicas. Para o VPS único de docs/07 isso basta. Se um dia o app rodar
 * replicado, este contador precisa migrar para Redis ou para o banco, senão o
 * limite passa a valer por réplica.
 */

export const LIMITES = {
  porMinuto: 10,
  porHora: 100,
  /** A partir daqui, exige confirmação humana antes de responder. */
  falhasAteDesafio: 20,
};

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

type Registro = { instantes: number[]; falhasSeguidas: number };

const porChave = new Map<string, Registro>();

/** Evita o mapa crescer sem limite num processo de vida longa. */
function limpar(agora: number): void {
  if (porChave.size < 5000) return;
  for (const [chave, registro] of porChave) {
    if (registro.instantes.every((t) => agora - t > HORA)) porChave.delete(chave);
  }
}

export type Veredito = {
  permitido: boolean;
  exigeDesafio: boolean;
  /** Segundos até poder tentar de novo, quando bloqueado. */
  esperarSegundos: number;
};

export function registrarConsulta(chave: string, agora = Date.now()): Veredito {
  limpar(agora);

  const registro = porChave.get(chave) ?? { instantes: [], falhasSeguidas: 0 };
  registro.instantes = registro.instantes.filter((t) => agora - t < HORA);

  const noMinuto = registro.instantes.filter((t) => agora - t < MINUTO).length;
  const naHora = registro.instantes.length;

  if (noMinuto >= LIMITES.porMinuto || naHora >= LIMITES.porHora) {
    porChave.set(chave, registro);
    const maisAntigoNoMinuto = registro.instantes.filter((t) => agora - t < MINUTO)[0] ?? agora;
    const espera =
      noMinuto >= LIMITES.porMinuto
        ? Math.ceil((MINUTO - (agora - maisAntigoNoMinuto)) / 1000)
        : Math.ceil((HORA - (agora - registro.instantes[0]!)) / 1000);

    return { permitido: false, exigeDesafio: false, esperarSegundos: Math.max(espera, 1) };
  }

  registro.instantes.push(agora);
  porChave.set(chave, registro);

  return {
    permitido: true,
    exigeDesafio: registro.falhasSeguidas >= LIMITES.falhasAteDesafio,
    esperarSegundos: 0,
  };
}

/** Consulta que não achou documento. Sequência disso é padrão de varredura. */
export function registrarFalha(chave: string): void {
  const registro = porChave.get(chave) ?? { instantes: [], falhasSeguidas: 0 };
  registro.falhasSeguidas += 1;
  porChave.set(chave, registro);
}

export function registrarAcerto(chave: string): void {
  const registro = porChave.get(chave);
  if (registro) {
    registro.falhasSeguidas = 0;
    porChave.set(chave, registro);
  }
}

export function exigeDesafio(chave: string): boolean {
  return (porChave.get(chave)?.falhasSeguidas ?? 0) >= LIMITES.falhasAteDesafio;
}

/** Só para os testes: zera o estado entre casos. */
export function limparTudo(): void {
  porChave.clear();
}

/**
 * Faz toda resposta levar o mesmo tempo mínimo.
 *
 * Sem isso, código existente e inexistente demoram diferente e a latência
 * entrega a existência do documento — exatamente o que docs/03 proíbe.
 */
export async function aguardarTempoConstante(inicio: number, minimoMs = 400): Promise<void> {
  const decorrido = Date.now() - inicio;
  if (decorrido < minimoMs) {
    await new Promise((resolver) => setTimeout(resolver, minimoMs - decorrido));
  }
}
