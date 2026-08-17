"use client";

import { useActionState, useState } from "react";
import { TipoPessoa, TipoProcurador } from "@prisma/client";
import { salvarPessoa, type EstadoDeFormulario } from "@/acoes/pessoas";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { ROTULO_TIPO_PROCURADOR } from "@/lib/formato";

type Valores = {
  id?: string;
  tipo: TipoPessoa;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  tipoProcurador: TipoProcurador | "";
  oab: string;
  vinculadoAId: string;
};

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export function FormularioDePessoa({
  valores,
  empresas,
}: {
  valores: Valores;
  empresas: { id: string; nome: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(salvarPessoa, {});
  const [tipo, setTipo] = useState<TipoPessoa>(valores.tipo);
  const [natureza, setNatureza] = useState<TipoProcurador | "">(valores.tipoProcurador);

  const ehAdvogado =
    natureza === TipoProcurador.ADVOGADO || natureza === TipoProcurador.ESCRITORIO_ADVOCACIA;
  const ehRepresentante = natureza === TipoProcurador.REPRESENTANTE_EMPRESA;

  return (
    <form action={acao} className="max-w-2xl">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}

      {estado.erro && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-erro/20 bg-erro-bg px-3 py-2 text-xs text-erro"
        >
          {estado.erro}
        </p>
      )}

      <fieldset className="mb-6">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
          Identificação
        </legend>

        <Selecao
          rotulo="Tipo"
          name="tipo"
          defaultValue={valores.tipo}
          onChange={(e) => setTipo(e.target.value as TipoPessoa)}
          opcoes={[
            { valor: TipoPessoa.FISICA, rotulo: "Pessoa física" },
            { valor: TipoPessoa.JURIDICA, rotulo: "Pessoa jurídica" },
          ]}
        />

        <Campo
          rotulo={tipo === TipoPessoa.FISICA ? "Nome completo" : "Razão social"}
          name="nome"
          defaultValue={valores.nome}
          required
          autoFocus
        />

        <Campo
          rotulo={tipo === TipoPessoa.FISICA ? "CPF" : "CNPJ"}
          name="documento"
          defaultValue={valores.documento}
          className="tabular"
          inputMode="numeric"
          dica="Só os dígitos, ou com pontuação — o sistema normaliza."
          erro={estado.campo === "documento" ? estado.erro : undefined}
          required
        />

        <Campo rotulo="E-mail" name="email" type="email" defaultValue={valores.email} />
        <Campo rotulo="Telefone" name="telefone" defaultValue={valores.telefone} />
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
          Atuação como procurador
        </legend>

        <Selecao
          rotulo="Natureza"
          name="tipoProcurador"
          defaultValue={valores.tipoProcurador}
          onChange={(e) => setNatureza(e.target.value as TipoProcurador | "")}
          vazio="Não atua como procurador"
          dica="Advogado e representante usam CPF; escritório e consultoria, CNPJ."
          opcoes={Object.values(TipoProcurador).map((t) => ({
            valor: t,
            rotulo: ROTULO_TIPO_PROCURADOR[t],
          }))}
        />

        {ehAdvogado && (
          <Campo
            rotulo="OAB"
            name="oab"
            defaultValue={valores.oab}
            dica="Ex.: OAB/SP 214.887"
            required
          />
        )}

        {ehRepresentante && (
          <Selecao
            rotulo="Vinculado a"
            name="vinculadoAId"
            defaultValue={valores.vinculadoAId}
            vazio="Nenhuma"
            dica="Empresa ou escritório que esta pessoa representa."
            opcoes={empresas.map((e) => ({ valor: e.id, rotulo: e.nome }))}
          />
        )}
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
          Endereço
        </legend>

        <div className="grid gap-x-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo rotulo="Logradouro" name="logradouro" defaultValue={valores.logradouro} />
          </div>
          <Campo rotulo="Número" name="numero" defaultValue={valores.numero} />
          <Campo rotulo="Complemento" name="complemento" defaultValue={valores.complemento} />
          <Campo rotulo="Bairro" name="bairro" defaultValue={valores.bairro} />
          <Campo rotulo="CEP" name="cep" defaultValue={valores.cep} className="tabular" />
          <div className="sm:col-span-2">
            <Campo rotulo="Cidade" name="cidade" defaultValue={valores.cidade} />
          </div>
          <Selecao
            rotulo="UF"
            name="uf"
            defaultValue={valores.uf}
            vazio="—"
            opcoes={UFS.map((uf) => ({ valor: uf, rotulo: uf }))}
          />
        </div>
      </fieldset>

      <Botao type="submit" carregando={pendente}>
        {valores.id ? "Salvar alterações" : "Cadastrar pessoa"}
      </Botao>
    </form>
  );
}
