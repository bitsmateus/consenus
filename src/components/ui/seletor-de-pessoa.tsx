"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

const LIMITE_EXIBIDO = 30;

type Pessoa = { id: string; rotulo: string };

/**
 * Campo de busca para escolher uma pessoa já cadastrada.
 *
 * Substitui o `<select>` simples nas telas de procedimento — com a base de
 * Interessados crescendo, rolar uma lista longa para achar alguém pelo nome
 * vira o gargalo. Filtra em memória sobre a lista já carregada na página
 * (não faz requisição nova a cada tecla): o rótulo já combina nome e
 * documento, então a busca por CPF/CNPJ funciona de graça.
 *
 * Submete pelo campo oculto (`name`), com o id da pessoa — igual a um
 * `<select>» comum. Só valida no cliente que o campo não ficou vazio; se o
 * texto digitado não corresponder a ninguém, o id fica vazio e o servidor
 * recusa com a mesma mensagem de sempre ("Selecione o Interessado...").
 */
export function SeletorDePessoa({
  rotulo,
  name,
  pessoas,
  dica,
  required,
  defaultValue,
  aoSelecionar,
}: {
  rotulo: string;
  name: string;
  pessoas: Pessoa[];
  dica?: string;
  required?: boolean;
  defaultValue?: string;
  /** Chamado com o id da pessoa escolhida — usado para preencher outros campos a partir dela. */
  aoSelecionar?: (id: string) => void;
}) {
  const idCampo = useId();
  const idLista = `${idCampo}-lista`;
  const selecionadaInicial = pessoas.find((p) => p.id === defaultValue) ?? null;

  const [texto, setTexto] = useState(selecionadaInicial?.rotulo ?? "");
  const [valorId, setValorId] = useState(defaultValue ?? "");
  const [aberto, setAberto] = useState(false);

  const filtradas = useMemo(() => {
    const termo = texto.trim().toLowerCase();
    const base = termo ? pessoas.filter((p) => p.rotulo.toLowerCase().includes(termo)) : pessoas;
    return base.slice(0, LIMITE_EXIBIDO);
  }, [texto, pessoas]);

  function selecionar(pessoa: Pessoa) {
    setTexto(pessoa.rotulo);
    setValorId(pessoa.id);
    setAberto(false);
    aoSelecionar?.(pessoa.id);
  }

  return (
    <div className="relative mb-4">
      <label htmlFor={idCampo} className="mb-1.5 block text-xs font-medium text-carvao-700">
        {rotulo}
      </label>

      <div className="relative">
        <input
          id={idCampo}
          type="text"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setValorId("");
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            // Enter com um único resultado filtrado escolhe direto — poupa o clique
            if (e.key === "Enter" && filtradas.length === 1) {
              e.preventDefault();
              selecionar(filtradas[0]!);
            }
          }}
          placeholder="Buscar por nome, CPF, CNPJ ou OAB"
          autoComplete="off"
          required={required}
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
          aria-controls={idLista}
          className={cn(
            "w-full rounded-md border border-carvao-100 bg-white py-2.5 pl-3 pr-9 text-sm text-carvao-700",
            "outline-none focus:border-grafite-500"
          )}
        />

        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carvao-300"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {aberto && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-carvao-100 bg-white py-1 shadow-lg"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-xs text-carvao-300">Nenhuma pessoa encontrada.</li>
          ) : (
            filtradas.map((p) => (
              <li key={p.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === valorId}
                  // preventDefault: sem isso o blur do input fecha a lista
                  // antes do clique no item ser processado
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(p)}
                  className={cn(
                    "block w-full truncate px-3 py-2 text-left text-sm hover:bg-dourado-50",
                    p.id === valorId ? "bg-dourado-50 text-dourado-600" : "text-carvao-700"
                  )}
                >
                  {p.rotulo}
                </button>
              </li>
            ))
          )}
          {pessoas.length > filtradas.length && (
            <li className="border-t border-carvao-100 px-3 py-1.5 text-[11px] text-carvao-300">
              Mostrando {LIMITE_EXIBIDO} de {pessoas.length} — digite para refinar.
            </li>
          )}
        </ul>
      )}

      <input type="hidden" name={name} value={valorId} />
      {dica && <p className="mt-1 text-xs text-carvao-300">{dica}</p>}
    </div>
  );
}
