# Procuradores e representação

Requisito trazido pelo cliente em 14/08/2026, junto com a aprovação do
protótipo. Muda o modelo de acesso externo do sistema.

## O que o cliente definiu

> *"1 - O procurador dos interessados pode ser uma empresa (consultoria), um
> representante da empresa ou advogado sendo representante ou não.
> 2 - No mesmo sentido isso pode acontecer para o interessado convidado.
> 3 - Quando o ato for representado por uma empresa, consultoria, escritório de
> advocacia ou advogado, tem que existir a possibilidade do filtro por este meio.
> 4 - Portal da parte precisa existir a possibilidade da pesquisa por interessado
> solicitante, interessado convidado e por procurador sendo empresa, consultoria,
> procurador CPF, escritório ou advogado, e nestes casos ele consegue visualizar
> todos que está representando."*

## Naturezas de procurador

| Natureza | Documento | Exemplo |
|---|---|---|
| **Advogado** | CPF + OAB | Dra. Helena Vasconcelos, OAB/SP 214.887 |
| **Escritório de advocacia** | CNPJ + OAB | Menezes Advogados Associados |
| **Empresa** | CNPJ | a própria empresa interessada, atuando como sua procuradora |
| **Consultoria** | CNPJ | Vértice Consultoria Empresarial Ltda |
| **Representante da empresa** | CPF | pessoa física vinculada à empresa/consultoria |

> **"Empresa" e "Consultoria" viraram naturezas separadas em 28/08/2026,** a
> pedido do cliente. O item 1 da citação acima as trata como sinônimo
> ("uma empresa (consultoria)"), mas os itens 3 e 4 já as listavam separadas
> ("empresa, consultoria, escritório de advocacia ou advogado") — a separação
> só formaliza o que o próprio requisito original já sugeria. Cadastro antigo
> com o valor combinado (`EMPRESA_CONSULTORIA`) foi migrado para
> **Consultoria**, por ser a leitura mais próxima do único exemplo em uso até
> então. Confira se algum deveria ter sido **Empresa**.

Qualquer uma delas pode representar **o Solicitante ou o Convidado**, e o mesmo
procurador pode estar dos dois lados em procedimentos diferentes.

O representante de empresa fica **vinculado** à consultoria no cadastro
(`Pessoa.vinculadoA`). Isso permite duas leituras: os procedimentos da
consultoria e os procedimentos acompanhados por aquela pessoa específica.

## Consequência no modelo de acesso

Antes existiam três papéis. Agora são quatro:

| Papel | O que enxerga |
|---|---|
| ADMIN | tudo |
| OPERADOR | tudo, conduz o fluxo |
| PARTE | **um** procedimento — o seu, após a sessão |
| **PROCURADOR** | **todos** os procedimentos em que representa alguém |

O perfil PROCURADOR é a novidade e precisa de atenção redobrada na
autorização. A regra é: ele vê um procedimento **se e somente se** existir um
registro em `ParteDoAto` com `papel = PROCURADOR` ligando a pessoa dele àquele
ato. Nunca por vínculo indireto, nunca por semelhança de nome ou documento.

## Filtro no painel administrativo

Chips acima da listagem, com contagem por procurador, mais busca livre que
alcança nome, CPF, CNPJ e OAB. A coluna "Procurador" aparece na tabela.

Serve a um caso real: a câmara quer saber quantos procedimentos vieram de cada
consultoria — informação de operação e, provavelmente, de repasse financeiro.

## Portal do procurador

Tela própria, separada do portal da parte. Mostra:

- Contadores: total, quantos como solicitante, quantos como convidado
- Tabela com procedimento, quem representa, posição, situação e data
- Busca por nome, CPF ou CNPJ do representado

**A regra de liberação continua valendo.** O procurador vê a lista dos
procedimentos que representa, mas o acesso aos documentos de cada um só abre
após a realização da sessão, exatamente como para o interessado. Representar não
antecipa acesso.

## Testes obrigatórios

- [ ] Procurador A não enxerga procedimento representado pelo procurador B
- [ ] Procurador vê os dois lados quando representa solicitante em um ato e
      convidado em outro
- [ ] Procurador não acessa documentos antes de `SESSAO_REALIZADA`
- [ ] Representante vinculado a uma consultoria vê apenas o que lhe cabe,
      conforme a regra que o cliente definir
- [ ] Filtro por procurador no painel não vaza ato de outro procurador
