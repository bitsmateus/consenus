# Autenticação de documentos por QR Code

Funcionalidade destacada pelo cliente como requisito importante. Hoje não
existe no processo dele.

## Como funciona

1. Todo documento **emitido pelo sistema** (cartas convite, ata, termo de
   acordo) recebe um **código único e variável** no momento da geração.
2. O código aparece no **cabeçalho** do documento, em texto legível.
3. Um **QR Code** no **rodapé** aponta para a página pública de verificação,
   já com o código na URL.
4. Quem receber o documento escaneia, ou digita o código manualmente na página.
5. A página responde se o documento é válido.

## Formato do código — padrão do cliente

`CO-CC-2026-000001`

- `CO` — Consensus One
- `CC` — sigla do tipo (CC, ATA, TA, TE, NT, MEM)
- `2026` — ano de emissão
- `000001` — sequencial de 6 dígitos, por tipo e por ano

Definido pelo cliente no documento "Fluxo do Sistema de documentos". O mesmo
código serve como número do documento, identificador interno, código do
autenticador e chave de busca.

## Nota de segurança — DECIDIDO em 14/08/2026

O sequencial é **previsível**. Quem tiver em mãos um único documento consegue
tentar `000002`, `000003` e descobrir quantos documentos a câmara emitiu, de
quais tipos e em que datas. Isso vaza volume de operação e existência de
procedimentos — informação sensível para uma câmara privada.

**O cliente optou por manter o código puro**, sem dígito verificador. A
numeração oficial é `CO-ATA-2026-000001` e assim permanece.

Isso é legítimo — o código é a identidade documental da câmara e ele não quis
alterá-la. Mas transfere **toda** a proteção para a página de verificação. Os
itens abaixo deixam de ser desejáveis e passam a ser **obrigatórios**:

### Obrigatório na página pública de verificação

- [ ] **Limite por IP**: 10 consultas por minuto e 100 por hora. Excedeu,
      responde 429 com mensagem neutra.
- [ ] **Tempo de resposta constante**: código válido e inválido devem levar o
      mesmo tempo. Sem isso, dá para inferir existência pela latência.
- [ ] **Resposta idêntica para inexistente e malformado**: sempre
      *"Documento não encontrado"*. Nunca *"código inválido"* versus
      *"não existe"* — a diferença entrega informação.
- [ ] **Sem contagem**: a página nunca revela total de documentos, último
      emitido ou qualquer numeração vizinha.
- [ ] **Sem enumeração assistida**: nada de autocompletar, sugerir ou corrigir
      código digitado.
- [ ] **Desafio após tentativas seguidas**: a partir de 20 consultas sem
      sucesso no mesmo IP, exigir confirmação humana.
- [ ] **Monitoramento**: alertar quando um IP consultar muitos códigos
      sequenciais. É o padrão clássico de varredura.

O risco residual continua existindo e é conhecido: quem tiver paciência e
muitos IPs consegue mapear volume. Está registrado aqui para que a decisão seja
rastreável, e a função `calcularVerificador()` segue no código caso o cliente
mude de ideia — é trocar um parâmetro.

## O que a página pública devolve

Conforme o modelo do cliente, a resposta é exatamente:

```
✓ Documento autêntico
Tipo:       Ata de Sessão
Código:     CO-ATA-2026-000001
Emitido em: 01/07/2026
Situação:   Válido
```

**Devolve:** existência, tipo, código, data de emissão e situação.

**Nunca devolve:**
- o arquivo em si
- nome das partes
- qualquer conteúdo do documento
- se houve ou não acordo

O objetivo é provar autenticidade para um terceiro, não abrir o processo.
Documento de conciliação é sigiloso.

## Proteções

- Limite de tentativas por IP, para impedir varredura de códigos
- Nenhuma diferença de tempo de resposta entre código válido e inválido
- Consulta registrada em `LogAuditoria` sem identificar o consultante
