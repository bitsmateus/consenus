/**
 * Regras da agenda de sessões — pedido do cliente em 25/09: só em dia útil,
 * das 09:00 às 17:00, fechado das 12:00 às 13:00, 20 minutos por sessão e
 * nunca duas ao mesmo tempo.
 */
import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import {
  diasBloqueadosDoAno,
  diaCivil,
  motivoDoDiaBloqueado,
  proximaVagaLivre,
  validarHorario,
  type DiaExtra,
  type RegrasDaAgenda,
  type SessaoMarcada,
} from "@/lib/agenda";

const REGRAS: RegrasDaAgenda = {
  inicio: "09:00",
  fim: "17:00",
  almocoInicio: "12:00",
  almocoFim: "13:00",
  duracaoMinutos: 20,
};

/** Instante em hora de parede de São Paulo, "AAAA-MM-DDTHH:MM". */
const sp = (texto: string) => fromZonedTime(`${texto}:00`, "America/Sao_Paulo");
const ok = (texto: string, marcadas: SessaoMarcada[] = []) =>
  validarHorario(sp(texto), REGRAS, [], marcadas);

const diaHora = (d: Date) =>
  `${diaCivil(d)}T${new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d)}`;

describe("dias em que não há sessão", () => {
  it("sábado e domingo", () => {
    expect(motivoDoDiaBloqueado("2026-09-26")).toBe("sábado");
    expect(motivoDoDiaBloqueado("2026-09-27")).toBe("domingo");
    expect(motivoDoDiaBloqueado("2026-09-28")).toBeNull();
  });

  it("feriados nacionais e o estadual de São Paulo", () => {
    expect(motivoDoDiaBloqueado("2026-10-12")).toMatch(/feriado — Nossa Senhora Aparecida/);
    expect(motivoDoDiaBloqueado("2026-07-09")).toMatch(/feriado — Revolução Constitucionalista/);
    expect(motivoDoDiaBloqueado("2026-11-20")).toMatch(/Consciência Negra/);
    expect(motivoDoDiaBloqueado("2026-12-25")).toMatch(/Natal/);
  });

  it("feriados e pontos facultativos que dependem da Páscoa (2026: 5 de abril)", () => {
    expect(motivoDoDiaBloqueado("2026-04-03")).toMatch(/feriado — Sexta-feira Santa/);
    expect(motivoDoDiaBloqueado("2026-02-16")).toMatch(/ponto facultativo — Carnaval/);
    expect(motivoDoDiaBloqueado("2026-02-17")).toMatch(/ponto facultativo — Carnaval/);
    expect(motivoDoDiaBloqueado("2026-02-18")).toMatch(/Quarta-feira de Cinzas/);
    expect(motivoDoDiaBloqueado("2026-06-04")).toMatch(/ponto facultativo — Corpus Christi/);
  });

  it("a Páscoa muda de ano para ano (2027: 28 de março)", () => {
    expect(motivoDoDiaBloqueado("2027-03-26")).toMatch(/Sexta-feira Santa/);
    expect(motivoDoDiaBloqueado("2027-05-27")).toMatch(/Corpus Christi/);
  });

  it("pontos facultativos fixos", () => {
    expect(motivoDoDiaBloqueado("2026-10-28")).toMatch(/ponto facultativo — Dia do Servidor Público/);
    expect(motivoDoDiaBloqueado("2026-12-24")).toMatch(/Véspera de Natal/);
    expect(motivoDoDiaBloqueado("2026-12-31")).toMatch(/Véspera de Ano Novo/);
  });

  it("dia cadastrado pelo administrador (ex.: feriado municipal)", () => {
    const extras: DiaExtra[] = [{ data: "2026-09-01", descricao: "Aniversário da cidade" }];
    expect(motivoDoDiaBloqueado("2026-09-01", extras)).toBe("dia sem sessão — Aniversário da cidade");
    expect(motivoDoDiaBloqueado("2026-09-01")).toBeNull();
  });

  it("todo ano tem os 10 feriados fixos e mais a Sexta-feira Santa", () => {
    const feriados = [...diasBloqueadosDoAno(2026).values()].filter((d) => d.tipo === "FERIADO");
    expect(feriados).toHaveLength(11);
  });
});

describe("horário permitido", () => {
  it("aceita dentro do expediente, de segunda a sexta", () => {
    expect(ok("2026-09-28T09:00")).toBeNull();
    expect(ok("2026-09-30T14:00")).toBeNull();
    expect(ok("2026-10-02T16:40")).toBeNull();
  });

  it("recusa antes das 09:00 e depois da última vaga", () => {
    expect(ok("2026-09-28T08:40")).toMatch(/fora do expediente/);
    expect(ok("2026-09-28T16:50")).toMatch(/fora do expediente/);
    expect(ok("2026-09-28T17:00")).toMatch(/fora do expediente/);
  });

  it("recusa o intervalo de almoço, inclusive a sessão que invade o almoço", () => {
    expect(ok("2026-09-28T12:00")).toMatch(/almoço/);
    expect(ok("2026-09-28T12:30")).toMatch(/almoço/);
    expect(ok("2026-09-28T11:50")).toMatch(/almoço/);
    expect(ok("2026-09-28T12:50")).toMatch(/almoço/);
  });

  it("a sessão que termina exatamente às 12:00, ou começa às 13:00, é válida", () => {
    expect(ok("2026-09-28T11:40")).toBeNull();
    expect(ok("2026-09-28T13:00")).toBeNull();
  });

  it("recusa fim de semana e feriado, com o motivo", () => {
    expect(ok("2026-09-26T10:00")).toMatch(/sábado/);
    expect(ok("2026-09-27T10:00")).toMatch(/domingo/);
    expect(ok("2026-10-12T10:00")).toMatch(/feriado — Nossa Senhora Aparecida/);
  });

  it("a hora é a de São Paulo, não a do servidor", () => {
    expect(validarHorario(new Date("2026-09-28T12:00:00Z"), REGRAS, [], [])).toBeNull();
    expect(validarHorario(new Date("2026-09-28T20:00:00Z"), REGRAS, [], [])).toMatch(
      /fora do expediente/
    );
  });
});

describe("duas sessões nunca ao mesmo tempo", () => {
  const marcadas: SessaoMarcada[] = [
    { inicio: sp("2026-09-28T14:00"), rotulo: "procedimento 2026.0004" },
  ];

  it("recusa o mesmo horário e qualquer um que se sobreponha", () => {
    expect(ok("2026-09-28T14:00", marcadas)).toMatch(/Já existe sessão neste horário/);
    expect(ok("2026-09-28T14:10", marcadas)).toMatch(/Já existe sessão/);
    expect(ok("2026-09-28T13:50", marcadas)).toMatch(/Já existe sessão/);
  });

  it("a mensagem diz qual procedimento ocupa o horário", () => {
    expect(ok("2026-09-28T14:00", marcadas)).toContain("procedimento 2026.0004");
  });

  it("aceita a sessão colada, antes ou depois (20 minutos de distância)", () => {
    expect(ok("2026-09-28T14:20", marcadas)).toBeNull();
    expect(ok("2026-09-28T13:40", marcadas)).toBeNull();
  });

  it("em outro dia o mesmo horário está livre", () => {
    expect(ok("2026-09-29T14:00", marcadas)).toBeNull();
  });
});

describe("próxima vaga livre", () => {
  const proxima = (texto: string, marcadas: SessaoMarcada[] = [], extras: DiaExtra[] = []) =>
    diaHora(proximaVagaLivre(sp(texto), REGRAS, extras, marcadas));

  it("o horário pedido, quando está livre", () => {
    expect(proxima("2026-09-30T14:00")).toBe("2026-09-30T14:00");
  });

  it("sábado e domingo vão para a segunda-feira, na abertura", () => {
    expect(proxima("2026-09-26T14:00")).toBe("2026-09-28T09:00");
    expect(proxima("2026-09-27T14:00")).toBe("2026-09-28T09:00");
  });

  it("feriado vai para o próximo dia útil", () => {
    expect(proxima("2026-10-12T14:00")).toBe("2026-10-13T09:00");
  });

  it("dia cadastrado pelo administrador também é pulado", () => {
    const extras: DiaExtra[] = [{ data: "2026-09-30", descricao: "Recesso" }];
    expect(proxima("2026-09-30T14:00", [], extras)).toBe("2026-10-01T09:00");
  });

  it("horário ocupado vai para a vaga seguinte, colada", () => {
    const marcadas = [{ inicio: sp("2026-09-30T14:00"), rotulo: "x" }];
    expect(proxima("2026-09-30T14:00", marcadas)).toBe("2026-09-30T14:20");
  });

  it("no almoço, pula para as 13:00", () => {
    expect(proxima("2026-09-30T12:00")).toBe("2026-09-30T13:00");
  });

  it("depois do fim do expediente, vai para o dia útil seguinte", () => {
    expect(proxima("2026-09-30T16:50")).toBe("2026-10-01T09:00");
    expect(proxima("2026-10-02T17:00")).toBe("2026-10-05T09:00");
  });

  it("antes da abertura, começa às 09:00 do mesmo dia", () => {
    expect(proxima("2026-09-30T07:00")).toBe("2026-09-30T09:00");
  });

  it("dia inteiro lotado passa para o dia seguinte", () => {
    const marcadas: SessaoMarcada[] = [];
    for (let m = 9 * 60; m < 17 * 60; m += 20) {
      if (m >= 12 * 60 && m < 13 * 60) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      marcadas.push({ inicio: sp(`2026-09-30T${hh}:${mm}`), rotulo: "x" });
    }
    expect(proxima("2026-09-30T09:00", marcadas)).toBe("2026-10-01T09:00");
  });

  it("nunca devolve um horário que validarHorario recusaria", () => {
    for (const desde of ["2026-09-26T03:00", "2026-10-11T23:59", "2026-12-24T10:00", "2027-02-16T10:00"]) {
      const vaga = proximaVagaLivre(sp(desde), REGRAS, [], []);
      expect(validarHorario(vaga, REGRAS, [], [])).toBeNull();
    }
  });
});
