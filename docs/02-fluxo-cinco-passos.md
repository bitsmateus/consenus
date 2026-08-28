# Fluxo operacional — os cinco passos

Esta é a regra de negócio central do sistema. Qualquer implementação precisa
respeitar exatamente esta sequência e os bloqueios entre passos.

```
[1] Cadastro das partes
     │  operador cadastra Interessado Solicitante, Interessado Convidado e procurador(es)
     ▼
[2] Primeira carta convite  ──► ao SOLICITANTE
     │  gerada automaticamente ao concluir o cadastro
     │  reserva data na agenda em caráter PROVISÓRIO
     │  informa: data da sessão, link da videoconferência,
     │           prazo de 15 dias para enviar documentação
     │  enviada por AR digital · laudo arquivado
     ▼
[3] Recebimento e validação da documentação
     │  operador anexa os documentos enviados pelo Interessado Solicitante
     │  confere no painel
     │  ►► O "OK" DO OPERADOR EFETIVA A DATA RESERVADA ◄◄
     │  sem esse OK o processo NÃO avança e a data NÃO é efetivada
     ▼
[4] Segunda carta convite  ──► ao CONVIDADO
     │  gerada automaticamente após o OK do passo 3
     │  conteúdo restrito: data e link apenas
     │  o Interessado Convidado NÃO tem obrigação de enviar documentos
     │  enviada por AR digital · laudo arquivado
     ▼
[5] Sessão e documentos do ato
        realizada por videoconferência na data confirmada (D+30)
        ATA          → obrigatória, sempre, mesmo sem comparecimento
                       ou sem acordo
        TERMO ACORDO → opcional, só quando há acordo
        assinatura digital em plataforma externa
        documentos assinados anexados ao ato
```

## Regras que o código precisa garantir

1. A data só passa de reservada a confirmada por ação explícita do operador no
   passo 3. Nenhum outro caminho efetiva data.
2. A segunda carta convite não pode ser gerada antes da confirmação do passo 3.
   Tentar isso é erro de negócio, não erro de validação de formulário.
3. Toda sessão gera ata, independentemente do resultado. Concluir um ato sem
   ata anexada deve ser impossível.
4. Termo de acordo só existe em ato concluído com acordo.
5. O perfil PARTE só enxerga o ato depois de `SESSAO_REALIZADA`. Antes disso,
   a parte recebe apenas as cartas convite, por fora do sistema.
6. Todo passo grava um `EventoAto` — a linha do tempo é a prova de que o rito
   foi seguido.

## Prazos

| Prazo | Padrão | Conta a partir de | Onde fica |
|---|---|---|---|
| Envio da documentação pelo Interessado Solicitante | 15 dias corridos | **recebimento** da 1ª carta | `ConfiguracaoSistema.prazoDocumentacaoDias` |
| Data da sessão | 30 dias corridos | criação do ato | `ConfiguracaoSistema.diasAteSessao` |

Nunca fixe esses números no código. São 15 dias, confirmados pelo cliente em
14/08/2026 (`docs/09`, item 1).

### O prazo conta do recebimento, não da emissão

A Carta-Convite diz, textualmente:

> *"o Interessado Solicitante deverá encaminhar à Consensus One, no prazo de até
> **15 (quinze) dias**, contados do **recebimento** desta comunicação"*

Não é detalhe de redação: é o marco inicial. Como a carta vai por AR digital,
entre emitir e receber passam dias — contar da emissão encurta o prazo de quem
recebeu, e o modelo prevê **encerramento administrativo do cadastro** para quem
o perder (`docs/08`). Fundamentar isso numa contagem começada cedo demais é
indefensável.

Como o sistema trata:

1. Ao emitir a 1ª carta, `prazoDocumentacaoAte` é calculado da **emissão** e
   fica **provisório** — a tela do procedimento marca assim, com a ressalva de
   não encerrar cadastro enquanto for provisório.
2. Ao vincular o laudo de AR, o operador informa a **data de recebimento nele
   impressa**. Ela vai para `Ato.dataCienciaSolicitante`, o prazo é
   **recalculado** a partir dela e deixa de ser provisório.
3. A mudança entra na linha do tempo, com as duas datas.

Quando a integração com o AR Digital existir (Etapa 2), ela preenche esse mesmo
campo automaticamente — o valor dela não é poupar digitação, é trazer a data
que o prazo exige.
