# Assinatura eletrônica — integração com a D4Sign

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
