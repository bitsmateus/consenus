/**
 * Regras da agenda de sessões — pedido do cliente em 25/09.
 *
 *   - só em dia útil: nada de sábado, domingo, feriado nem ponto facultativo;
 *   - só das 09:00 às 17:00, com 12:00 às 13:00 fechado;
 *   - cada sessão ocupa 20 minutos, e duas não podem se sobrepor.
 *
 * Módulo puro, sem banco, na mesma linha de `prazos.ts`: o horário e a duração
 * vêm da configuração (CLAUDE.md, regra 12), e os dias sem sessão extras
 * (feriado municipal, recesso) vêm da tabela DiaSemSessao. Tudo em
 * America/Sao_Paulo (regra 12): a hora de parede é a da câmara, não a do servidor.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { FUSO } from "./prazos";

export type RegrasDaAgenda = {
  /** "HH:MM" — primeira sessão do dia. */
  inicio: string;
  /** "HH:MM" — nenhuma sessão termina depois disto. */
  fim: string;
  almocoInicio: string;
  almocoFim: string;
  /** Quanto cada sessão ocupa. */
  duracaoMinutos: number;
};

/** Dia sem sessão cadastrado à mão: data "AAAA-MM-DD" e o motivo. */
export type DiaExtra = { data: string; descricao: string };

/** Sessão já marcada: quando começa e como chamá-la na mensagem de conflito. */
export type SessaoMarcada = { inicio: Date; rotulo: string };

export type TipoDeDiaBloqueado = "FERIADO" | "PONTO_FACULTATIVO";

export type DiaBloqueado = { descricao: string; tipo: TipoDeDiaBloqueado };

// ---------------------------------------------------------------- calendário

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como { mes: 1-12, dia }. */
function pascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

function chave(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Soma dias a uma data civil, sem passar por fuso (meio-dia UTC evita virada). */
function somarDiasCivis(ano: number, mes: number, dia: number, dias: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias, 12));
  return chave(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const cacheDeFeriados = new Map<number, Map<string, DiaBloqueado>>();

/**
 * Feriados e pontos facultativos do ano, por "AAAA-MM-DD".
 *
 * Nacionais, mais o estadual de São Paulo (9 de julho), onde fica a câmara.
 * Feriado municipal e o que mais for específico entram pela tabela
 * DiaSemSessao, cadastrada pelo administrador — não dá para adivinhar aqui.
 */
export function diasBloqueadosDoAno(ano: number): Map<string, DiaBloqueado> {
  const guardado = cacheDeFeriados.get(ano);
  if (guardado) return guardado;

  const mapa = new Map<string, DiaBloqueado>();
  const feriado = (mes: number, dia: number, descricao: string) =>
    mapa.set(chave(ano, mes, dia), { descricao, tipo: "FERIADO" });
  const facultativo = (data: string, descricao: string) =>
    mapa.set(data, { descricao, tipo: "PONTO_FACULTATIVO" });

  feriado(1, 1, "Confraternização Universal");
  feriado(4, 21, "Tiradentes");
  feriado(5, 1, "Dia do Trabalho");
  feriado(7, 9, "Revolução Constitucionalista (SP)");
  feriado(9, 7, "Independência do Brasil");
  feriado(10, 12, "Nossa Senhora Aparecida");
  feriado(11, 2, "Finados");
  feriado(11, 15, "Proclamação da República");
  feriado(11, 20, "Consciência Negra");
  feriado(12, 25, "Natal");

  const { mes, dia } = pascoa(ano);
  mapa.set(somarDiasCivis(ano, mes, dia, -2), { descricao: "Sexta-feira Santa", tipo: "FERIADO" });
  facultativo(somarDiasCivis(ano, mes, dia, -48), "Carnaval (segunda-feira)");
  facultativo(somarDiasCivis(ano, mes, dia, -47), "Carnaval (terça-feira)");
  facultativo(somarDiasCivis(ano, mes, dia, -46), "Quarta-feira de Cinzas");
  facultativo(somarDiasCivis(ano, mes, dia, 60), "Corpus Christi");
  facultativo(chave(ano, 10, 28), "Dia do Servidor Público");
  facultativo(chave(ano, 12, 24), "Véspera de Natal");
  facultativo(chave(ano, 12, 31), "Véspera de Ano Novo");

  cacheDeFeriados.set(ano, mapa);
  return mapa;
}

/** O dia civil ("AAAA-MM-DD") de um instante, na hora de parede da câmara. */
export function diaCivil(instante: Date): string {
  return formatInTimeZone(instante, FUSO, "yyyy-MM-dd");
}

/** Minutos desde a meia-noite, na hora de parede da câmara. */
export function minutosDoDia(instante: Date): number {
  const [h, m] = formatInTimeZone(instante, FUSO, "HH:mm").split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function paraHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

const DIAS_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Por que a câmara não marca sessão neste dia, ou null se o dia serve. */
export function motivoDoDiaBloqueado(dia: string, extras: DiaExtra[] = []): string | null {
  const [ano, mes, dd] = dia.split("-").map(Number);
  const diaDaSemana = new Date(Date.UTC(ano!, mes! - 1, dd!, 12)).getUTCDay();
  if (diaDaSemana === 0 || diaDaSemana === 6) return DIAS_DA_SEMANA[diaDaSemana]!;

  const bloqueado = diasBloqueadosDoAno(ano!).get(dia);
  if (bloqueado) {
    return `${bloqueado.tipo === "FERIADO" ? "feriado" : "ponto facultativo"} — ${bloqueado.descricao}`;
  }

  const extra = extras.find((e) => e.data === dia);
  if (extra) return `dia sem sessão — ${extra.descricao}`;

  return null;
}

// ---------------------------------------------------------------- horário

/** Instante de um dia civil e de uma hora de parede da câmara. */
export function instanteDe(dia: string, minutos: number): Date {
  return fromZonedTime(`${dia}T${paraHora(minutos)}:00`, FUSO);
}

/** "06/10/2026 às 14:20", na hora de parede da câmara. */
export function formatarDiaHora(instante: Date): string {
  return formatInTimeZone(instante, FUSO, "dd/MM/yyyy 'às' HH:mm");
}

/**
 * Confere se uma sessão pode começar neste instante. Devolve a mensagem para o
 * operador, em português, ou null quando está tudo certo.
 */
export function validarHorario(
  inicio: Date,
  regras: RegrasDaAgenda,
  extras: DiaExtra[],
  marcadas: SessaoMarcada[]
): string | null {
  const motivo = motivoDoDiaBloqueado(diaCivil(inicio), extras);
  if (motivo) {
    return `Não há sessão neste dia: ${motivo}. As sessões são marcadas de segunda a sexta, exceto feriados e pontos facultativos.`;
  }

  const comeca = minutosDoDia(inicio);
  const termina = comeca + regras.duracaoMinutos;
  const abre = paraMinutos(regras.inicio);
  const fecha = paraMinutos(regras.fim);
  const almocoDe = paraMinutos(regras.almocoInicio);
  const almocoAte = paraMinutos(regras.almocoFim);

  if (comeca < abre || termina > fecha) {
    return (
      `Horário fora do expediente: as sessões são marcadas das ${regras.inicio} às ${regras.fim}, ` +
      `e cada uma ocupa ${regras.duracaoMinutos} minutos (a última começa às ${paraHora(fecha - regras.duracaoMinutos)}).`
    );
  }
  if (comeca < almocoAte && termina > almocoDe) {
    return `Horário no intervalo de almoço: não há sessão das ${regras.almocoInicio} às ${regras.almocoFim}.`;
  }

  const duracaoEmMs = regras.duracaoMinutos * 60_000;
  const conflito = marcadas.find(
    (s) => Math.abs(s.inicio.getTime() - inicio.getTime()) < duracaoEmMs
  );
  if (conflito) {
    return (
      `Já existe sessão neste horário (${formatarDiaHora(conflito.inicio)} — ${conflito.rotulo}). ` +
      `Cada sessão ocupa ${regras.duracaoMinutos} minutos e duas não podem acontecer ao mesmo tempo.`
    );
  }

  return null;
}

/**
 * A primeira vaga livre a partir de `desde`.
 *
 * Anda de 20 em 20 minutos a partir da abertura do dia, pulando o que
 * `validarHorario` recusa — dia bloqueado, almoço, sessão já marcada. A
 * sessão que nasce na abertura do procedimento cai aqui: D+30 às 14:00 é o
 * alvo, e se estiver ocupado ou for feriado ela vai para a próxima vaga.
 */
export function proximaVagaLivre(
  desde: Date,
  regras: RegrasDaAgenda,
  extras: DiaExtra[],
  marcadas: SessaoMarcada[],
  limiteDeDias = 400
): Date {
  const passo = regras.duracaoMinutos;
  const abre = paraMinutos(regras.inicio);
  const fecha = paraMinutos(regras.fim);

  let dia = diaCivil(desde);
  const minutoDeDesde = minutosDoDia(desde);
  let primeiroDia = true;

  for (let i = 0; i <= limiteDeDias; i++) {
    if (!motivoDoDiaBloqueado(dia, extras)) {
      for (let minuto = abre; minuto + passo <= fecha; minuto += passo) {
        if (primeiroDia && minuto < minutoDeDesde) continue;
        const candidato = instanteDe(dia, minuto);
        if (!validarHorario(candidato, regras, extras, marcadas)) return candidato;
      }
    }
    primeiroDia = false;
    const [ano, mes, dd] = dia.split("-").map(Number);
    dia = somarDiasCivis(ano!, mes!, dd!, 1);
  }

  throw new Error("Nenhuma vaga livre encontrada na agenda.");
}

/** A regra, numa frase, para aparecer ao lado de qualquer campo de data. */
export function resumoDasRegras(regras: RegrasDaAgenda): string {
  return (
    `Sessões de segunda a sexta, das ${regras.inicio} às ${regras.fim} ` +
    `(fechado das ${regras.almocoInicio} às ${regras.almocoFim}), ${regras.duracaoMinutos} minutos cada; ` +
    "não há sessão em feriados nem pontos facultativos e duas sessões não podem coincidir."
  );
}

// ---------------------------------------------------------------- mês

/** Interpreta "AAAA-MM"; qualquer outra coisa vira o mês de `hoje`. */
export function interpretarMes(texto: string | undefined, hoje: Date): { ano: number; mes: number } {
  const acerto = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(texto ?? "");
  if (acerto) return { ano: Number(acerto[1]), mes: Number(acerto[2]) };
  const [ano, mes] = diaCivil(hoje).split("-").map(Number);
  return { ano: ano!, mes: mes! };
}

export function textoDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function mesVizinho(ano: number, mes: number, deslocamento: number): { ano: number; mes: number } {
  const total = ano * 12 + (mes - 1) + deslocamento;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** O intervalo [de, ate) do mês inteiro, em instantes, na hora de parede da câmara. */
export function intervaloDoMes(ano: number, mes: number): { de: Date; ate: Date } {
  const proximo = mesVizinho(ano, mes, 1);
  return {
    de: instanteDe(`${textoDoMes(ano, mes)}-01`, 0),
    ate: instanteDe(`${textoDoMes(proximo.ano, proximo.mes)}-01`, 0),
  };
}

/** Todos os dias do mês, com o dia da semana (0 = domingo). */
export function diasDoMes(ano: number, mes: number): { dia: string; diaDaSemana: number }[] {
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => {
    const numero = i + 1;
    return {
      dia: `${textoDoMes(ano, mes)}-${String(numero).padStart(2, "0")}`,
      diaDaSemana: new Date(Date.UTC(ano, mes - 1, numero, 12)).getUTCDay(),
    };
  });
}
