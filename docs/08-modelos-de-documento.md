# Modelos de documento — mapa de variáveis

Modelos oficiais recebidos do cliente em 14/08/2026, em `assets/modelos/`.
São a **fonte da verdade** do texto. O sistema não reescreve o conteúdo: preenche
as variáveis e aplica o timbrado.

## Sistema de códigos — padrão do cliente

Cada documento tem **um único identificador**, que serve simultaneamente como
número do documento, identificador interno, código do autenticador e chave de
busca.

```
CO - CC - 2026 - 000001
│    │     │      └── sequencial de 6 dígitos, por tipo e por ano
│    │     └───────── ano de emissão
│    └─────────────── sigla do tipo
└──────────────────── Consensus One
```

| Documento | Sigla | Exemplo |
|---|---|---|
| Carta-Convite | `CC` | CO-CC-2026-000001 |
| Ata de Sessão | `ATA` | CO-ATA-2026-000001 |
| Termo de Acordo | `TA` | CO-TA-2026-000001 |
| Termo de Encerramento | `TE` | CO-TE-2026-000001 |
| Notificação | `NT` | CO-NT-2026-000001 |
| Memorando | `MEM` | CO-MEM-2026-000001 |

> **Atenção de segurança.** O sequencial é previsível: quem tiver um código
> consegue tentar `000002`, `000003` e descobrir quantos e quais documentos a
> câmara emitiu. Ver `docs/03-autenticacao-de-documentos.md` para as três opções
> de mitigação. **Decisão pendente do cliente.**

---

## 1. Carta-Convite ao Interessado Solicitante

Arquivo: `assets/modelos/Carta_Convite_Cliente.docx` · Código `CO-CC`

Emitida no **passo 2**, logo após o cadastro. Comunica o recebimento da
solicitação, reserva a data e **pede a documentação**.

### Variáveis

| Variável | Origem |
|---|---|
| `{{codigo_documento}}` | gerado na emissão |
| `{{interessado_solicitante}}` | `ParteDoAto` papel SOLICITANTE |
| `{{interessado_convidado}}` | `ParteDoAto` papel CONVIDADO |
| `{{objeto_procedimento}}` | `Ato.objeto` |
| `{{data_sessao}}` `{{hora_sessao}}` | `Ato.dataReservada` |
| `{{link_sessao}}` `{{id_reuniao}}` `{{senha_reuniao}}` | `Ato.*` |
| `{{prazo_documentacao_dias}}` | `ConfiguracaoSistema` — **15 dias** |

### Documentos exigidos do solicitante — vira checklist no sistema

O modelo lista cinco itens obrigatórios. O passo 3 deve conferir item a item,
não apenas "recebeu ou não":

1. contrato de prestação de serviços firmado com a **Empresa de Consultoria e
   Assessoria Técnica**
2. procuração com poderes de representação, quando aplicável
3. contrato de financiamento relacionado à controvérsia
4. prova técnica, laudo ou documento equivalente
5. documentos pessoais do solicitante e do representante

> **Nota sobre o item I.** Na versão de 14/08 o cliente trocou "contrato firmado
> com a Consensus One" por "contrato firmado com a Empresa de Consultoria e
> Assessoria Técnica" — a câmara administra o procedimento, não contrata o
> solicitante. Perguntamos se o nome deveria ser variável e ele respondeu
> *"tem que deixar o último que mandei"*: o texto é **fixo e genérico**, sem
> campo para nome de empresa. Usar a redação literal do modelo de 14/08.

> O texto é explícito: *"O não encaminhamento integral dos documentos no prazo
> estabelecido impedirá a confirmação da sessão e a expedição da Carta-Convite ao
> Interessado Convidado, podendo acarretar o encerramento administrativo do
> cadastro."* — é exatamente a regra do botão **Cancelar o ato**.

---

## 2. Carta-Convite ao Interessado Convidado

Arquivo: `assets/modelos/Carta_Convite.docx` · Código `CO-CC`

Emitida no **passo 4**, só depois da validação documental. Mesmo texto
institucional da anterior, **sem** as seções de cadastro e de documentos.

Contém a designação da sessão com link, ID e senha, e a ressalva de que a
mudança para presencial ou híbrida exige aviso de **48 horas**.

---

## 3. Ata de Sessão Privada de Conciliação

Arquivo: `assets/modelos/Ata_de_Sessao_Privada_de_Conciliacao.docx` · Código `CO-ATA`

Estrutura em seis seções: identificação, realização, comparecimento,
desenvolvimento, conclusão e encerramento.

### Variáveis

| Variável | Origem |
|---|---|
| `{{dia}}` `{{mes}}` `{{ano}}` `{{hora_inicio}}` | `Ato.horaInicio` |
| `{{modalidade}}` | presencial · videoconferência · híbrida |
| `{{hora_verificacao}}` | abertura da conferência de presença |
| `{{presentes}}` `{{ausentes}}` | `ParteDoAto.compareceu` |
| `{{desfecho}}` | uma das cinco opções abaixo |
| `{{motivo_prejudicada}}` | só quando prejudicada |
| `{{observacoes}}` | livre |
| `{{hora_encerramento}}` | `Ato.horaEncerramento` |

### Os cinco desfechos possíveis

1. **Composição Consensual Integral** — gera Termo de Acordo
2. **Composição Consensual Parcial** — gera Termo de Acordo dos pontos acordados
3. **Redesignação da Sessão** — nova data a definir
4. **Encerramento sem Composição**
5. **Sessão Prejudicada** — exige registro do motivo

### Assinaturas

Conciliador, Interessado Solicitante (parte e procurador) e Interessado
Convidado (parte e procurador) — cinco linhas de assinatura no total.

---

## 4. Termo de Acordo Extrajudicial

Arquivo: `assets/modelos/Termo_de_Acordo_Extrajudicial.docx` · Código `CO-TA`

Treze seções. As cláusulas primeira a quarta e os quatro parágrafos da seção V
são **campos livres**, preenchidos pelo conciliador na tela de sessão:

| Campo livre | Seção |
|---|---|
| Objeto do acordo | Cláusula Primeira |
| Obrigações da primeira parte | Cláusula Segunda |
| Obrigações da segunda parte | Cláusula Terceira |
| Condições específicas | Cláusula Quarta |
| Prazos de cumprimento | V, § 1º |
| Forma de cumprimento | V, § 2º |
| Forma de pagamento | V, § 3º |
| Demais condições | V, § 4º |

O restante do texto é fixo e **não deve ser editável na interface** — são as
cláusulas de inadimplemento (multa de 10%, juros de 1% ao mês, IPCA),
confidencialidade, força executiva, quitação e disposições finais. Alterar isso
é decisão jurídica do cliente, não do operador.

---

## Onde a esteira termina — decisão do cliente, 14/08/2026

> *"A esteira funciona como desenhamos e os documentos oficiais terminam com a
> elaboração e assinatura da ATA. Os outros documentos são de uso administrativo
> com uso fora da esteira que criamos."* — Dr. Sergio Ferreira

**Ficam dentro do sistema:** Carta-Convite ao Solicitante, Carta-Convite ao
Convidado, Ata e Termo de Acordo.

**Ficam fora do sistema:** Termo de Encerramento (`CO-TE`), Notificação
(`CO-NT`) e Memorando (`CO-MEM`). São de uso administrativo do escritório, não
passam pela esteira, e portanto **não serão implementados**. Não constavam do
Anexo I do contrato — o escopo continua exatamente como assinado.

O parser de códigos em `src/lib/codigo-documento.ts` reconhece as seis siglas
mesmo assim. É proposital: se alguém digitar um `CO-TE` na página de
verificação, a resposta certa é *"documento não encontrado"*, e não *"código
inválido"* — a numeração é legítima, só não foi emitida por aqui.
