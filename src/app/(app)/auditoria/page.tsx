import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { db } from "@/lib/db";
import { formatarDataHora } from "@/lib/formato";
import { exigirAdmin } from "@/lib/sessao";

export const metadata = { title: "Auditoria — Consensus One" };

/** Rótulos legíveis das ações auditadas. */
const ROTULO: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGIN_FALHOU: "Tentativa de acesso recusada",
  LOGOUT: "Saiu do sistema",
  USUARIO_BLOQUEADO: "Conta bloqueada por tentativas",
  PREPAROU_SEGUNDO_FATOR: "Preparou verificação em duas etapas",
  ATIVOU_SEGUNDO_FATOR: "Ativou verificação em duas etapas",
  DESATIVOU_SEGUNDO_FATOR: "Desativou verificação em duas etapas",
  CRIOU_PESSOA: "Cadastrou pessoa",
  ALTEROU_PESSOA: "Alterou pessoa",
  CRIOU_ATO: "Abriu procedimento",
  ALTEROU_ATO: "Alterou procedimento",
  ADICIONOU_PARTE: "Vinculou parte",
  REMOVEU_PARTE: "Removeu vínculo",
  CONFIRMOU_DATA: "Confirmou a data da sessão",
  GEROU_DOCUMENTO: "Emitiu documento",
  ENVIOU_DOCUMENTO: "Registrou envio ou anexo",
  BAIXOU_DOCUMENTO: "Baixou documento",
  CONSULTOU_VERIFICACAO: "Consulta pública de verificação",
  VARREDURA_SUSPEITA: "Alerta de varredura de códigos",
  CRIOU_USUARIO: "Criou conta",
  ALTEROU_PERMISSAO: "Alterou permissões",
  RECUPEROU_ACESSO: "Recuperou acesso de administrador",
};

/** Ações que merecem destaque numa revisão de segurança. */
const SENSIVEIS = new Set([
  "LOGIN_FALHOU",
  "USUARIO_BLOQUEADO",
  "DESATIVOU_SEGUNDO_FATOR",
  "VARREDURA_SUSPEITA",
  "ALTEROU_PERMISSAO",
  "RECUPEROU_ACESSO",
]);

export default async function PaginaDeAuditoria({
  searchParams,
}: {
  searchParams: Promise<{ acao?: string }>;
}) {
  // a trilha inteira é do administrador; docs/04 pede revisão mensal
  await exigirAdmin();
  const { acao } = await searchParams;

  const [registros, porAcao] = await Promise.all([
    db.logAuditoria.findMany({
      where: acao ? { acao } : {},
      orderBy: { criadoEm: "desc" },
      take: 200,
      include: { usuario: { select: { nome: true, email: true } } },
    }),
    db.logAuditoria.groupBy({ by: ["acao"], _count: { _all: true } }),
  ]);

  const contagens = porAcao
    .map((l) => ({ acao: l.acao, total: l._count._all }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <CabecalhoDePagina
        titulo="Auditoria"
        descricao="Login, alteração de procedimento, emissão e download de documento"
      />

      <div className="flex-1 p-4 md:p-6">
        <div className="mb-5 flex flex-wrap gap-1.5">
          <a
            href="/auditoria"
            className={
              acao
                ? "rounded-full border border-carvao-100 bg-white px-3 py-1.5 text-[11px] text-carvao-500 hover:border-dourado-600"
                : "rounded-full bg-grafite-700 px-3 py-1.5 text-[11px] font-medium text-white"
            }
          >
            Tudo
          </a>
          {contagens.map((c) => (
            <a
              key={c.acao}
              href={`/auditoria?acao=${c.acao}`}
              className={
                acao === c.acao
                  ? "rounded-full bg-grafite-700 px-3 py-1.5 text-[11px] font-medium text-white"
                  : "rounded-full border border-carvao-100 bg-white px-3 py-1.5 text-[11px] text-carvao-500 hover:border-dourado-600"
              }
            >
              {ROTULO[c.acao] ?? c.acao} · {c.total}
            </a>
          ))}
        </div>

        {registros.length === 0 ? (
          <EstadoVazio titulo="Nenhum registro" />
        ) : (
          <ul className="space-y-1.5">
            {registros.map((registro) => (
              <li
                key={registro.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-carvao-100 bg-white px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-carvao-700">
                    {ROTULO[registro.acao] ?? registro.acao}
                    {SENSIVEIS.has(registro.acao) && (
                      <Etiqueta tom="atencao" className="ml-2">
                        atenção
                      </Etiqueta>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-carvao-300">
                    {registro.usuario?.nome ?? "—"}
                    {registro.entidade && ` · ${registro.entidade}`}
                    {registro.entidadeId && ` ${registro.entidadeId.slice(0, 18)}`}
                  </p>
                </div>
                <span className="tabular text-[11px] text-carvao-300">
                  {formatarDataHora(registro.criadoEm)}
                  {registro.ip && ` · ${registro.ip}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-carvao-300">
          Mostrando os 200 registros mais recentes. A consulta pública de
          verificação é registrada sem identificar quem consultou.
        </p>
      </div>
    </>
  );
}
