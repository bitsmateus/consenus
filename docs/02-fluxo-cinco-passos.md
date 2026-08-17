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
        realizada por videoconferência na data confirmada (D+20)
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

| Prazo | Padrão | Onde fica |
|---|---|---|
| Envio da documentação pelo Interessado Solicitante | 15 dias corridos da 1ª carta | `ConfiguracaoSistema.prazoDocumentacaoDias` |
| Data da sessão | D+20 da criação do ato | `ConfiguracaoSistema.diasAteSessao` |

Nunca fixe esses números no código. O cliente ainda vai confirmar se são fixos
ou parametrizáveis (item 5 do Anexo III do contrato).
