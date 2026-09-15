"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { desvincularPessoas } from "@/acoes/pessoas";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Etiqueta } from "@/components/ui/etiqueta";
import type { listarPessoas } from "@/lib/consultas";
import { formatarDocumento } from "@/lib/documentos";
import { ROTULO_TIPO_PROCURADOR } from "@/lib/formato";

type Pessoa = Awaited<ReturnType<typeof listarPessoas>>[number];

/**
 * Lista de interessados e procuradores, com seleção múltipla para desvincular
 * em lote quem foi indevidamente associado a um escritório/empresa.
 */
export function ListaDePessoas({ pessoas }: { pessoas: Pessoa[] }) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [emAndamento, iniciarTransicao] = useTransition();

  const vinculadas = useMemo(() => pessoas.filter((p) => p.vinculadoA), [pessoas]);
  const todasSelecionadas =
    vinculadas.length > 0 && vinculadas.every((p) => selecionados.has(p.id));

  function alternar(id: string) {
    setSelecionados((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function alternarTodas() {
    setSelecionados(todasSelecionadas ? new Set() : new Set(vinculadas.map((p) => p.id)));
  }

  function desvincularSelecionadas() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;

    iniciarTransicao(async () => {
      const dados = new FormData();
      ids.forEach((id) => dados.append("id", id));
      await desvincularPessoas(dados);
      setSelecionados(new Set());
      avisar(ids.length === 1 ? "Vínculo removido." : `${ids.length} vínculos removidos.`);
      router.refresh();
    });
  }

  return (
    <>
      {vinculadas.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-carvao-100 bg-white px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm text-carvao-700">
            <input
              type="checkbox"
              checked={todasSelecionadas}
              onChange={alternarTodas}
              aria-label="Selecionar todos os vinculados"
            />
            Selecionar todos os vinculados ({vinculadas.length})
          </label>
          <Botao
            type="button"
            variante="perigo"
            className="ml-auto px-3 py-1.5 text-xs"
            disabled={selecionados.size === 0 || emAndamento}
            carregando={emAndamento}
            onClick={desvincularSelecionadas}
          >
            Desvincular selecionados{selecionados.size > 0 ? ` (${selecionados.size})` : ""}
          </Botao>
        </div>
      )}

      <ul className="space-y-2">
        {pessoas.map((pessoa) => (
          <li
            key={pessoa.id}
            className="rounded-lg border border-carvao-100 bg-white p-4 transition-colors hover:border-dourado-600"
          >
            <div className="flex flex-wrap items-start gap-3">
              {pessoa.vinculadoA && (
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={selecionados.has(pessoa.id)}
                  onChange={() => alternar(pessoa.id)}
                  aria-label={`Selecionar ${pessoa.nome}`}
                />
              )}

              <Link href={`/pessoas/${pessoa.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-carvao-700">{pessoa.nome}</p>
                    <p className="tabular mt-0.5 text-xs text-carvao-500">
                      {formatarDocumento(pessoa.documento)}
                      {pessoa.oab && ` · OAB ${pessoa.oab}`}
                      {pessoa.vinculadoA && ` · vinculado a ${pessoa.vinculadoA.nome}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pessoa.tipoProcurador && (
                      <Etiqueta tom="andamento">
                        {ROTULO_TIPO_PROCURADOR[pessoa.tipoProcurador]}
                      </Etiqueta>
                    )}
                    <Etiqueta>
                      {pessoa._count.participacoes === 1
                        ? "1 procedimento"
                        : `${pessoa._count.participacoes} procedimentos`}
                    </Etiqueta>
                  </div>
                </div>
              </Link>

              {pessoa.vinculadoA && (
                <form action={desvincularPessoas} className="shrink-0">
                  <input type="hidden" name="id" value={pessoa.id} />
                  <button className="text-[11px] text-erro hover:underline">Desvincular</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
