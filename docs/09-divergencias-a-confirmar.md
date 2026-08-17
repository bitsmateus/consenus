# Divergências entre o escopo e os modelos oficiais

> **Atualizado em 14/08/2026 — todas as pendências resolvidas.**
> O cliente respondeu os seis pontos. Nada bloqueia o desenvolvimento.

**Origem:** modelos de documento recebidos do Dr. Sergio em 14/08/2026
**Comparado com:** documento de escopo de 12/08 e Anexo I do contrato
**Ação:** confirmar os itens marcados antes de fechar a Sprint 2

---

## 1. ✅ RESOLVIDO — Prazo da documentação: 15 dias

O escopo e o contrato dizem **10 dias**. A Carta-Convite ao Interessado
Solicitante diz, textualmente:

> *"o Interessado Solicitante deverá encaminhar à Consensus One, no prazo de até
> **15 (quinze) dias**, contados do recebimento desta comunicação"*

**Já ajustei o sistema para 15 dias**, por ser o que está no documento oficial
dele. O prazo é parametrizável, então trocar é questão de configuração.

**Confirmado pelo cliente em 14/08:** *"o prazo pode ser 15 dias mesmo"*.
Sistema configurado com 15 dias. O Anexo III do contrato ainda cita 10 — vale
corrigir na próxima revisão contratual, sem urgência.

---

## 2. Terminologia — a nossa estava errada

Os documentos dele não falam em requerente e demandado.

| Nós usávamos | O correto |
|---|---|
| Requerente | **Interessado Solicitante** |
| Demandado | **Interessado Convidado** |
| Sessão de conciliação | **Sessão Privada de Conciliação** |
| Procedimento | **Procedimento Privado de Composição Consensual** |
| — | **Conciliador** (conduz a sessão) |

Corrigido no protótipo, no banco de dados e na documentação. Isso importa mais
do que parece: o vocabulário dele é deliberadamente não-judicial, porque a
câmara é privada e não pode soar como tribunal.

---

## 3. Código do documento — formato diferente do que assumimos

O documento "Fluxo do Sistema de documentos" define o padrão:

```
CO-CC-2026-000001      Carta-Convite
CO-ATA-2026-000001     Ata de Sessão
CO-TA-2026-000001      Termo de Acordo
CO-TE-2026-000001      Termo de Encerramento
CO-NT-2026-000001      Notificação
CO-MEM-2026-000001     Memorando
```

Sequencial de 6 dígitos, por tipo e por ano. Já implementado.

### ✅ DECIDIDO — código permanece puro, sem dígito verificador

**O sequencial é previsível.** Quem receber um único documento da câmara pode
digitar `000002`, `000003` na página de verificação e descobrir quantos
documentos foram emitidos, de quais tipos e em que datas. Para uma câmara
privada que vende confidencialidade, isso vaza volume de operação e a existência
de procedimentos.

Três saídas, da melhor para a mais simples:

**a) Dígito verificador de 2 caracteres** — `CO-ATA-2026-000001-K7`
O código dele continua íntegro e legível; sem ter o documento em mãos, ninguém
monta um código válido. Já está implementado e pode ser desligado por
configuração.

**b) Segundo campo na validação** — além do código, exigir a data de emissão.
Não mexe na numeração, mexe na tela.

**c) Apenas limite de tentativas por IP** — mantém tudo como está. Dificulta
varredura em massa, não impede consulta pontual.

**Resposta do cliente em 14/08: não.** A numeração fica exatamente como ele
especificou.

Decisão respeitada. Em contrapartida, as proteções da página de verificação
passam a ser obrigatórias e estão listadas em `docs/03`: limite por IP, tempo de
resposta constante, resposta idêntica para código inexistente e malformado,
nenhuma contagem exposta e alerta de varredura. O risco residual está registrado
e a função do verificador continua no código, caso ele mude de ideia.

---

## 4. Desfechos da sessão: são cinco, não quatro

O modelo de Ata prevê:

1. Composição Consensual **Integral**
2. Composição Consensual **Parcial** ← não tínhamos
3. **Redesignação** da Sessão
4. **Encerramento sem Composição**
5. **Sessão Prejudicada** — com registro do motivo

A composição parcial muda o produto: gera Termo de Acordo **dos pontos
acordados**, preservando os demais. Já corrigido no protótipo e no banco.

---

## 5. Modalidade da sessão: existe a híbrida

Os modelos preveem **presencial, videoconferência ou híbrida**, e a carta-convite
estabelece que mudar de modalidade exige aviso de **48 horas de antecedência**.
Adicionei a terceira opção e o aviso na tela.

---

## 6. Dados do Zoom: são três campos, não um

A carta-convite imprime **Link**, **ID da reunião** e **Senha**, separados. O
sistema agora tem os três.

---

## 7. Os documentos exigidos viram checklist

A carta ao solicitante lista cinco itens obrigatórios:

1. Contrato de prestação de serviços com a Consensus One
2. Procuração, quando aplicável
3. Contrato de financiamento relacionado à controvérsia
4. Prova técnica, laudo ou documento equivalente
5. Documentos pessoais do solicitante e do representante

Transformei o passo 3 em conferência **item a item**, em vez de um "recebeu ou
não". Assim o operador sabe exatamente o que falta antes de confirmar a data.

E isso confirma o botão de cancelamento que ele pediu — o próprio modelo diz:

> *"O não encaminhamento integral dos documentos no prazo estabelecido impedirá a
> confirmação da sessão e a expedição da Carta-Convite ao Interessado Convidado,
> podendo acarretar o encerramento administrativo do cadastro."*

---

## 8. ✅ RESOLVIDO — Os três documentos extras ficam fora do sistema

O sistema de códigos dele define seis tipos. Ele enviou quatro modelos. Faltam:

- **Termo de Encerramento** (`CO-TE`)
- **Notificação** (`CO-NT`)
- **Memorando** (`CO-MEM`)

**Resposta do cliente em 14/08:** *"os outros documentos são de uso
administrativo com uso fora da esteira que criamos"*.

Ou seja: **não entram no sistema**. O escopo permanece idêntico ao Anexo I
assinado, sem aditivo e sem trabalho extra. A esteira termina na Ata, com o
Termo de Acordo quando houver composição.

---

## 9. ✅ RESOLVIDO — Termo de Acordo: o que o operador pode editar

O modelo tem 13 seções. Só estas são campos livres:

| Campo | Seção |
|---|---|
| Objeto do acordo | Cláusula Primeira |
| Obrigações da primeira parte | Cláusula Segunda |
| Obrigações da segunda parte | Cláusula Terceira |
| Condições específicas | Cláusula Quarta |
| Prazos, forma de cumprimento, forma de pagamento, demais condições | Seção V, §§ 1º a 4º |

Todo o resto é texto fixo: inadimplemento (multa de 10%, juros de 1% ao mês,
IPCA), confidencialidade, força executiva, quitação, disposições finais.

**Confirmado pelo cliente em 14/08.** As cláusulas fixas ficam travadas na
interface, com indicação visual de cadeado na tela de sessão. Alterar cláusula
de inadimplemento é decisão jurídica do Dr. Sergio, não do colaborador que está
lavrando o termo no fim de uma sessão.

---

## Resumo — o que já está resolvido e o que falta

| # | Pergunta | Situação |
|---|---|---|
| 1 | Prazo de documentação é 15 dias? | ✅ Sim |
| 2 | Aceita o dígito verificador no código? | ✅ Não — código puro |
| 3 | Modelos de Termo de Encerramento, Notificação e Memorando | ✅ Fora da esteira |
| 4 | Quando cada um é emitido? | ✅ Prejudicada — ficam fora |
| 5 | Cláusulas fixas do Termo de Acordo não são editáveis? | ✅ Sim, travadas |
| 6 | A "Empresa de Consultoria e Assessoria Técnica" é fixa ou varia? | ✅ Texto fixo |

**Nenhuma pendência.** O escopo documental está fechado e a Sprint 2 pode correr
inteira sem novas consultas ao cliente.

### Sobre o item 6

O cliente respondeu *"tem que deixar o último que mandei"*. O texto do item I da
carta ao solicitante fica **literal**, como está na versão de 14/08 — "contrato
de prestação de serviços firmado com a Empresa de Consultoria e Assessoria
Técnica". Não é campo variável nem recebe nome de empresa: é redação genérica,
fixa no modelo.
