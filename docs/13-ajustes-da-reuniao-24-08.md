# Ajustes pedidos na reunião de 24/08/2026

Reunião com **Sergio Ferreira** (Consensus One) e **Pedro** e **Pietra** (Mais
Credit, cliente da câmara), com o William. Fonte: gravação e transcrição do
Gemini, mais as anotações da chamada.

Na reunião a NX se comprometeu a entregar os ajustes **até a manhã de
quarta-feira, 26/08**, e a marcar nova demonstração. Este documento organiza o
que foi pedido, separa o que já existe do que é novo, e marca o que depende de
decisão antes de codar.

Terminologia: a reunião usou "processo", "audiência" e "requerente". Aqui e no
código continua valendo a do cliente — *procedimento*, *Sessão Privada de
Conciliação*, *Interessado Solicitante* e *Interessado Convidado*.

---

## 1. Já está pronto — não refazer

Boa parte do que foi discutido já é o comportamento atual. Confirmado no
código antes de escrever este documento:

| Pedido na reunião | Situação |
|---|---|
| Interessados cadastrados antes de abrir o procedimento | Já é assim, e é obrigatório |
| 2ª Carta-Convite só depois da conferência documental | Já é assim, e o bloqueio é no servidor |
| Ata obrigatória em qualquer desfecho; Termo só quando há acordo | Já é assim |
| Marcar comparecimento de cada parte | Já existe, e a Ata já imprime "Presentes" |
| Prazo de 15 dias para a documentação | Já existe, configurável |
| Modalidade: videoconferência, presencial ou híbrida | Já existe |
| Verificação em duas etapas | Já existe, obrigatória para perfis internos |
| Auditoria de quem acessou e baixou o quê | Já existe |
| Filtro por procurador na tela de procedimentos | Já existe |
| QR Code e página pública de verificação | Já existe |

Vale dizer isso na próxima demonstração: o que soou como pedido novo, em
metade dos casos já estava entregue e só não ficou evidente na tela.

---

## 2. A fazer — ordenado por valor na demonstração

Tamanho é relativo: **P** sai em minutos, **M** em uma a três horas, **G** em
meio dia ou mais, contando teste.

### 2.1 Título do procedimento e interessados na listagem — **G**

Hoje a listagem mostra só o número (`2026.0004`), e o operador não sabe de quem
é o procedimento sem abrir. Pedido em 00:02:38.

- campo novo `titulo` em `Ato`, opcional, com migração
- edição na página do procedimento
- listagem e painel passam a mostrar título e os nomes dos Interessados
- quando não houver título, cai no número, que continua sendo a identidade
  oficial do procedimento — título é apelido de trabalho, não substitui

### 2.2 Painel já abre filtrado — **P**

Ao clicar nos cartões do painel, ir direto para a listagem filtrada por
"em andamento" e "aguardando documentação", em vez de abrir a lista inteira.

### 2.3 Menu mostra onde você está — **P**

O menu lateral não destaca o item da página atual. Marcar o ativo, com
`aria-current` para leitor de tela.

### 2.4 Fluxo do registro da sessão: presença primeiro — **M**

Sergio foi explícito em 00:17:44 e 00:18:41: *"começa o fluxo de quem tá
presente, depois se houve o acordo ou não"*. Hoje o formulário começa pelos
horários.

- reordenar: comparecimento → desfecho → horários → observações
- rever o texto do desfecho para a linguagem que ele pediu: "conciliado" e
  "inconciliado" soam melhor a quem opera do que "composição consensual
  integral"

**Atenção, e por isso não implementei ainda:** ele falou em *"houve acordo, sim
ou não"*, mas o escopo fechado em `docs/09` item 4 tem **cinco** desfechos, não
dois — inclui redesignação e sessão prejudicada, que não são "acordo sim/não".
Ver seção 4.

### 2.5 Cadastrar pessoa sem sair da tela — **M**

Pedido por Pedro em 00:18:41: ao gerar a ata, descobre-se que o advogado do
Convidado não estava cadastrado, e hoje é preciso voltar ao início.

- botão "cadastrar nova pessoa" dentro do bloco de vínculo do procedimento
- e também no momento do registro da sessão, que é onde o representante do
  Convidado costuma aparecer

### 2.6 Filtros — **M**

- **Procedimentos**: já filtra por procurador; falta por Interessado. Sergio
  quer buscar pelo CNPJ da Mais Credit e ver todos os representados (00:20:49)
- **Documentos**: hoje não tem filtro nenhum — a tela lista tudo. Adicionar
  filtro por procedimento, por Interessado e por tipo de documento

### 2.7 Documentos agrupados por Interessado — **M**

Pedido em 00:23:09 e 00:24:13: "a pasta vai ser pelo interessado". Na tela de
Documentos, agrupar por Interessado, com os procedimentos dele dentro.

**Isto é agrupamento de tela, não mudança do armazenamento.** Ver seção 4.

### 2.8 O erro que apareceu na demonstração — **?**

Em 00:06:53 e 00:16:41 aparece um erro ao mexer no procedimento. Pela
transcrição não dá para saber qual — em 00:16:41 parece validação do campo
obrigatório do Termo de Acordo, o que seria comportamento correto, não defeito.

**Preciso que você me diga o que estava na tela.** Sem isso eu estaria
adivinhando, e o item fica sem estimativa.

---

## 3. Depende de terceiros ou do cliente

Nada aqui é desenvolvimento parado por nossa causa.

| Item | De quem depende |
|---|---|
| **AR Digital** — documentação da API | AR Digital, prometida para quarta |
| **Assinatura eletrônica** — testar de ponta a ponta | Nós, mas ver a ressalva abaixo |
| **Modelos de carta convite** — enviar cópia para validação do texto | NX enviar, Sergio validar |
| **Zoom** — gerar o link da sessão pelo sistema | Credenciais da conta Zoom da câmara |
| **Contato do TI da Mais Credit** — assunto CRM/WhatsApp, fora deste sistema | Sergio encaminhar ao Pedro |

**Sobre a assinatura, três pontos que precisam ser ditos ao cliente:**

1. Na reunião ela foi chamada de **ForSign**, que é o nome no contrato. O
   sistema está integrado à **D4Sign**, que é a plataforma que a câmara usa. O
   texto contratual precisa ser alinhado — `docs/09`, item 10.
2. A conta atual aceita **10 requisições por hora**, cerca de um procedimento
   por hora. Trava o uso real e precisa ser ampliada antes da virada.
3. A integração está rodando com uma **chave de API da NX**, não da Consensus
   One. Precisa ser trocada antes do uso real — `docs/09`, item 9.

**Sobre o Zoom:** hoje o sistema tem os três campos (link, ID e senha) para o
operador colar à mão. Gerar o link automaticamente é integração nova, e o
contrato coloca automação e integrações na **Etapa 2** (`docs/01`).

---

## 4. Decisões pendentes — responder antes de codar

São regras de negócio jurídicas. Não decido sozinho.

### 4.1 "Houve acordo: sim ou não" convive com os cinco desfechos?

Em 00:17:44 Sergio pediu um "houve acordo, sim ou não". Mas `docs/09` item 4
fechou **cinco** desfechos, e três deles não cabem nessa pergunta:
redesignação, sessão prejudicada e encerramento sem composição.

Caminhos:

- **(a)** manter os cinco e só trocar os rótulos para linguagem de operador —
  *é o que eu recomendo*, não perde caso previsto e atende o espírito do pedido;
- **(b)** perguntar "houve acordo?" primeiro e, conforme a resposta, oferecer os
  desfechos compatíveis — mais trabalho, mas é literalmente o fluxo que ele
  descreveu;
- **(c)** reduzir para dois desfechos — **não recomendo**: perde redesignação e
  sessão prejudicada, que estão nos modelos oficiais.

### 4.2 "Pasta por interessado" é tela ou é armazenamento?

Hoje os arquivos ficam em `atos/{id}/...` no bucket. Agrupar **na tela** por
Interessado é simples e reversível. Mudar o **caminho no armazenamento** é
migração de arquivo já emitido, com hash e código de verificação apontando para
eles — risco alto, ganho nenhum para o usuário.

Vou fazer o agrupamento de tela, salvo se você disser que ele quis o outro.

### 4.3 O prazo de quarta cabe?

Contando 2.1 a 2.7, é aproximadamente **um dia e meio a dois dias** de trabalho
com teste. Hoje é segunda à tarde. Cabe, mas sem folga — e sem contar o item
2.8, que ainda não sei o que é.

Se apertar, a ordem que eu cortaria de trás para frente é: 2.7, depois 2.6.
As três primeiras são as que aparecem na primeira tela da demonstração e valem
mais do que todo o resto junto.

---

## 5. Fora deste bloco

Continuam valendo, e não foram afetados pela reunião:

- checklist de segurança do servidor e backup com restauração testada, ainda
  pendentes — `docs/06`
- automação de envio das cartas, agente de IA e módulo do escritório seguem na
  Etapa 2 e adiante, conforme `docs/01`
