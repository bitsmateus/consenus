import { Papel, StatusAto } from "@prisma/client";
import { db } from "@/lib/db";
import { ESTADOS_FINAIS, exigirUsuario, filtroDeAtosVisiveis } from "@/lib/sessao";

export const metadata = { title: "Painel — Consensus One" };

export default async function Painel() {
  const usuario = await exigirUsuario();
  const filtro = await filtroDeAtosVisiveis();

  const [emAndamento, aguardando, total] = await Promise.all([
    db.ato.count({
      where: { AND: [filtro, { status: { notIn: ESTADOS_FINAIS } }] },
    }),
    db.ato.count({ where: { AND: [filtro, { status: StatusAto.AGUARDANDO_DOCUMENTACAO }] } }),
    db.ato.count({ where: filtro }),
  ]);

  const equipe = usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR;

  return (
    <>
      <header className="flex items-center justify-between border-b border-carvao-100 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-preto-900">
            {equipe ? "Painel" : "Meus procedimentos"}
          </h1>
          <p className="text-xs text-carvao-500">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Cartao numero={emAndamento} rotulo="Em andamento" />
          <Cartao numero={aguardando} rotulo="Aguardando documentação" destaque />
          <Cartao numero={total} rotulo="Total de procedimentos" />
        </div>

        <p className="mt-8 text-sm text-carvao-500">
          Sprint 0 concluída: autenticação, papéis e shell da aplicação.
          As listagens entram na Sprint 1.
        </p>
      </div>
    </>
  );
}

function Cartao({ numero, rotulo, destaque }: { numero: number; rotulo: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-carvao-100 bg-white p-4">
      <p className={`text-2xl font-semibold ${destaque ? "text-dourado-600" : "text-preto-900"}`}>
        {numero}
      </p>
      <p className="mt-0.5 text-[11px] text-carvao-500">{rotulo}</p>
    </div>
  );
}
