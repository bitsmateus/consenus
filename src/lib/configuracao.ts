/**
 * Configuração do sistema. Prazos e demais parâmetros vêm daqui, nunca fixos
 * no código (CLAUDE.md, regra 12).
 */
import { cache } from "react";
import { db } from "./db";

/** Valores usados só quando a linha ainda não existe no banco. */
const PADRAO = {
  nomeCamara: "Consensus One",
  prazoDocumentacaoDias: 15,
  horasAvisoModalidade: 48,
  diasAteSessao: 30,
  horaDaSessao: "14:00",
  duracaoSessaoMinutos: 20,
  agendaInicio: "09:00",
  agendaFim: "17:00",
  almocoInicio: "12:00",
  almocoFim: "13:00",
};

/**
 * Lê a configuração uma vez por requisição.
 * `cache` do React evita repetir a consulta a cada componente da página.
 */
export const configuracaoDoSistema = cache(async () => {
  const registro = await db.configuracaoSistema.findUnique({ where: { id: 1 } });
  return {
    nomeCamara: registro?.nomeCamara ?? PADRAO.nomeCamara,
    prazoDocumentacaoDias: registro?.prazoDocumentacaoDias ?? PADRAO.prazoDocumentacaoDias,
    horasAvisoModalidade: registro?.horasAvisoModalidade ?? PADRAO.horasAvisoModalidade,
    diasAteSessao: registro?.diasAteSessao ?? PADRAO.diasAteSessao,
    horaDaSessao: registro?.horaDaSessao ?? PADRAO.horaDaSessao,
    duracaoSessaoMinutos: registro?.duracaoSessaoMinutos ?? PADRAO.duracaoSessaoMinutos,
    agendaInicio: registro?.agendaInicio ?? PADRAO.agendaInicio,
    agendaFim: registro?.agendaFim ?? PADRAO.agendaFim,
    almocoInicio: registro?.almocoInicio ?? PADRAO.almocoInicio,
    almocoFim: registro?.almocoFim ?? PADRAO.almocoFim,
  };
});
