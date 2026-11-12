# Assinatura eletrônica — integração com a D4Sign

> **Troca para a ZapSign (11/2026).** O pacote da D4Sign esgotou, o limite de
> 10 chamadas por hora travava o envio e as assinaturas saíam numa página à
> parte. A câmara passou para a ZapSign. A seção abaixo descreve a ZapSign; o
> restante deste documento continua valendo para os envios **antigos**, que
> terminam na D4Sign.

## ZapSign

### Como a troca funciona

- `ASSINATURA_PROVEDOR` decide para onde vão os envios **novos**: `zapsign` ou
  `d4sign` (padrão). Virar a chave é mudar a variável no EasyPanel; voltar
  atrás também.
- Cada envio grava `OperacaoAssinatura.provedor` (`D4SIGN` | `ZAPSIGN`, migração
  `20261112120000_provedor_da_assinatura`; linhas antigas ficaram `D4SIGN`).
  Webhook, download e cancelamento olham essa coluna — um envio termina na
  plataforma em que começou.
- **Mantenha as variáveis `D4SIGN_*` configuradas** enquanto houver envio
  pendente na D4Sign: sem elas, o webhook da D4Sign não consegue baixar o
  assinado e a retificação não consegue cancelar lá (a linha do tempo pede para
  cancelar pelo painel).

### Envio

Uma chamada só (`POST /docs/`): o PDF vai em base64, com os signatários, e os
convites partem junto. Não existe envio pela metade. **Todo documento criado é
cobrado**, mesmo cancelado — por isso todas as recusas (sem e-mail, já enviado,
ata substituída) acontecem antes da chamada.

Quem assina é a mesma regra de sempre (`montarSignatarios`). Cada signatário
vai com `auth_mode` de `ZAPSIGN_AUTENTICACAO` (padrão
`assinaturaTela-tokenEmail`, sem custo extra), e-mail automático, nome e
e-mail travados e o papel em `qualification` ("Conciliador", "Interessado
Solicitante"…), que aparece no relatório de assinaturas.

### Posição das assinaturas

A Ata e o Termo têm cinco linhas fixas. Cada uma leva um texto âncora
invisível (branco, altura zero), logo acima do traço — `<<assina-conciliador>>`,
`<<assina-solicitante>>`, `<<assina-procurador-solicitante>>`,
`<<assina-convidado>>`, `<<assina-procurador-convidado>>`. A ZapSign procura o
texto e desenha a assinatura ali (`signature_placement`). Lista única em
`src/lib/ancoras-de-assinatura.ts`, usada pelo documento e pelo envio.

- Dois signatários na mesma linha (dois procuradores do mesmo lado): só o
  primeiro recebe a âncora, para as assinaturas não se sobreporem; o outro
  assina e aparece no relatório de assinaturas.
- **A posição exata (quanto acima do traço) não foi conferida com documento
  real** — a câmara não tem conta de testes. Conferir no primeiro envio; o
  ajuste é o `top` de `.ancora-assinatura` em `src/documentos/timbrado.ts`.
- Atas emitidas antes desta versão não têm âncora: na ZapSign elas assinam sem
  posição definida. Retifique, se precisar.

### Retorno

O aviso da ZapSign **não é assinado** (não há HMAC). A rota
`/api/webhooks/zapsign/<ZAPSIGN_WEBHOOK_TOKEN>` confere o token do caminho e,
do corpo, lê só o `token` do documento. O estado vem sempre de
`GET /docs/{token}/`, autenticado (`src/lib/retorno-da-zapsign.ts`):

| A consulta diz | O sistema faz |
|---|---|
| mais gente assinou | sobe o contador (UPDATE condicional) e registra na linha do tempo |
| `signed` | baixa o PDF na hora (o link vale 60 min) e arquiva como `DOCUMENTO_ASSINADO` |
| `refused` / `recusado` / excluído | marca `CANCELADA` |

`doc_signed` chega uma vez por signatário, e a ZapSign reenvia o que não
recebeu 200: avisos repetidos não duplicam evento nem documento. Falha técnica
responde 500, de propósito, para ela reenviar.

### Configuração (EasyPanel)

| Variável | O quê |
|---|---|
| `ASSINATURA_PROVEDOR` | `zapsign` para virar a chave |
| `ZAPSIGN_API_TOKEN` | token da conta (Configurações › Integrações › API ZapSign) |
| `ZAPSIGN_WEBHOOK_TOKEN` | segredo do caminho do webhook (`openssl rand -hex 32`) |
| `ZAPSIGN_AUTENTICACAO` | forma de identificação do signatário (vazio = padrão) |
| `ZAPSIGN_BASE_URL` | vazio = produção |

No painel da ZapSign, cadastrar o webhook (todos os eventos) em
`<AUTH_URL>/api/webhooks/zapsign/<ZAPSIGN_WEBHOOK_TOKEN>`. Para conferir a
chave e o plano sem criar documento: `npm run zapsign:conta`.


Primeira integração da Etapa 2. Substitui, para a Ata e o Termo de Acordo, o
vaivém manual entre o sistema e o painel do fornecedor.

## O fornecedor é a D4Sign, não a ForSign

`docs/01` e `docs/06` dizem **ForSign** — é o que consta do contrato. O
fornecedor efetivamente usado pela câmara é a **D4Sign**, confirmado em
20/08/2026, e é dela que vieram as credenciais. São empresas diferentes, com
APIs incompatíveis.

**Pendência com o cliente:** alinhar o texto contratual. O sistema está
integrado à D4Sign; o contrato promete ForSign.

## O que muda para o operador

Antes, sete movimentos, quatro deles fora do sistema: gerar a ata, baixar o
PDF, abrir a D4Sign, subir o arquivo, cadastrar signatários, esperar, baixar o
assinado e anexar aqui.

Agora, um botão **"Enviar para assinatura"** na linha do documento. O
andamento aparece na tela e na linha do tempo conforme cada um assina, e o PDF
assinado se arquiva sozinho no repositório.

O botão só aparece quando a integração está configurada. Sem configuração,
tudo continua funcionando pelo caminho manual — a integração não é passo
obrigatório de nenhum dos cinco passos.

## Quem assina

Regra em `src/lib/signatarios.ts`, com teste em `tests/unit/signatarios.test.ts`:

1. O **conciliador assina sempre**. A Ata é obrigatória mesmo sem
   comparecimento e sem acordo (`docs/02`, regra 3); numa sessão em que ninguém
   compareceu, ele é o único signatário.
2. Interessados e procuradores assinam **apenas se compareceram**. Quem não
   esteve na sessão não assina a ata do que não presenciou.
3. **Um e-mail entra uma vez só.** A D4Sign identifica signatário pelo e-mail;
   repetido, o documento esperaria para sempre uma assinatura que a plataforma
   não tem como coletar.

Falta de e-mail no cadastro **barra o envio**, com a lista de quem falta — e
barra antes de qualquer chamada externa, para não deixar documento órfão lá nem
gastar requisição do limite.

## A sequência das chamadas

A ordem importa: o webhook precisa estar registrado **antes** de o convite sair,
senão a primeira assinatura acontece antes de existir para onde avisar.

| # | Chamada | Para quê |
|---|---|---|
| 1 | `POST /documents/{cofre}/upload` | sobe o PDF, devolve o UUID |
| 2 | `POST /documents/{uuid}/createlist` | cadastra os signatários |
| 3 | `POST /documents/{uuid}/addinfo` | grava o nome de cada um — **uma por pessoa** |
| 4 | `POST /documents/{uuid}/webhooks` | registra o retorno |
| 5 | `POST /documents/{uuid}/sendtosigner` | dispara os convites por e-mail |

O webhook da D4Sign é **por documento**: não existe cadastro global, por isso o
passo 4 entra em todo envio.

## ⚠️ Limite de requisições

A conta padrão da D4Sign aceita **10 chamadas por hora**. Um envio consome
`4 + 1 por signatário`; o arquivamento consome mais duas. Na prática, **cerca de
um procedimento por hora** enquanto o limite não for ampliado.

**Isso é conversa com o comercial da D4Sign, não problema técnico.** Sem a
ampliação, a integração funciona em teste e trava no uso real. Quando a API
recusa por limite, o operador recebe mensagem dizendo exatamente isso, e o
envio pode ser repetido depois.

Antes de acrescentar qualquer chamada nova ao fluxo, conte quanto ela custa.

## Segurança do retorno

O webhook é a única rota do sistema que responde sem sessão de usuário. Três
camadas o protegem, e a terceira é a que sustenta as outras duas:

1. **Token secreto no caminho da URL** (`D4SIGN_WEBHOOK_TOKEN`), que só nós e a
   D4Sign conhecemos. Caminho errado devolve 404.
2. **`Content-Hmac`**, que a D4Sign calcula sobre o UUID do documento.
3. **O aviso é só um gatilho — nada do que ele traz vira conteúdo.** Ao receber,
   o sistema busca o PDF assinado na API da D4Sign, autenticado, pelo UUID que
   já estava gravado aqui. Aviso forjado não injeta arquivo em procedimento
   nenhum.

A camada 2 é fraca **por desenho da D4Sign**: o hash é do UUID, não do corpo da
requisição, então não muda nunca e um aviso capturado pode ser repetido. Por
isso ela não é a defesa principal. Ver `src/lib/d4sign.ts`.

O aviso repetido também não duplica documento: cada um é registrado em
`WebhookAssinatura` por `documento + tipo + signatário`, e o registro só entra
**depois** do processamento bem-sucedido — se marcasse antes, uma falha faria o
reenvio ser descartado como repetido e o documento nunca chegaria.

## Avisos tratados

| `type_post` | Significado | O que o sistema faz |
|---|---|---|
| 1 | documento finalizado | baixa o PDF assinado e arquiva |
| 2 | e-mail não entregue | evento na linha do tempo, com o endereço |
| 3 | documento cancelado | marca a operação como cancelada |
| 4 | um signatário assinou | atualiza o contador na tela |

O aviso 2 vale mais do que parece: sem ele, o procedimento ficaria parado
esperando a assinatura de alguém que nunca recebeu o convite.

## Onde fica o documento assinado

O PDF assinado entra como **documento novo**, do tipo `DOCUMENTO_ASSINADO`. O
original emitido pela esteira continua intacto, com seu código de verificação —
o assinado é anexo e não recebe código, como todo anexo (`docs/03`).

Enquanto não é baixado, o documento assinado só existe na D4Sign. O acervo da
câmara não pode depender de terceiro: é por isso que `ARQUIVADA` é um estado
nosso, e não um estado deles.

## Posicionamento das assinaturas

A D4Sign posiciona assinatura por coordenada XY (*pins*), não por marca de
texto. Coordenada quebra silenciosamente quando o documento muda de tamanho — e
a Ata muda, porque o texto varia com o caso.

Decisão: **não usar pins**. As assinaturas ficam na folha de assinaturas que a
própria D4Sign acrescenta, com os nomes, os hashes e as evidências. É por isso
que o nome de cada signatário é gravado (passo 3 da sequência): sem ele, a folha
identificaria as partes só por e-mail, o que não serve num documento com valor
de título executivo.

As cinco linhas de assinatura do modelo oficial continuam impressas como
sempre, e o texto da Ata já prevê a forma: *"segue a presente Ata assinada
eletronicamente pelos participantes"*.

## As credenciais só aparecem uma vez

A D4Sign exibe o `tokenAPI` e o `cryptKey` **apenas no momento em que a chave é
criada**. Não há botão de revelar depois: o mascaramento é do servidor. O mesmo
vale para a Secret Key do HMAC.

Consequência prática: quem cria uma chave e não copia na hora perde os valores
para sempre, e a chave vira peso morto ocupando uma das três vagas da conta.
Foi o que aconteceu com a chave chamada "ConsensusOne" — ver `docs/09`, item 9.

**Ao criar qualquer credencial da D4Sign, copie para o gerenciador de senhas
antes de fechar a tela.**

## Configuração

Todas em `.env.example`. Nenhuma no repositório.

| Variável | Onde obter |
|---|---|
| `D4SIGN_TOKEN_API` | painel da D4Sign, menu **Dev API** |
| `D4SIGN_CRYPT_KEY` | mesma tela |
| `D4SIGN_UUID_COFRE` | `GET /safes` — o cofre onde os documentos ficam |
| `D4SIGN_BASE_URL` | vazio = produção; homologação em `sandbox.d4sign.com.br/api/v1` |
| `D4SIGN_WEBHOOK_SEGREDO` | cadastrado no painel, para o `Content-Hmac` |
| `D4SIGN_WEBHOOK_TOKEN` | gerado por nós: `openssl rand -hex 32` |

O endereço a cadastrar na D4Sign é montado a partir de `AUTH_URL`:

```
https://SEU-DOMINIO/api/webhooks/d4sign/{D4SIGN_WEBHOOK_TOKEN}
```

**Existe ambiente de homologação**, com credenciais próprias. Use-o durante o
desenvolvimento: em produção, cada teste dispara e-mail de verdade para quem
estiver no cadastro e consome o limite de requisições.

## Se o envio falhar no meio

O PDF pode já ter subido para a D4Sign quando uma chamada seguinte falha. Nesse
caso o sistema registra na linha do tempo o identificador do documento que ficou
lá, e o operador conclui o envio pelo painel da D4Sign. Não há reenvio
automático: repetir a sequência criaria um segundo documento para a mesma ata.
