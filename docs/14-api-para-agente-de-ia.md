# 14 — API para o agente de IA (Clara)

Entregue em 24/11/2026. Base: briefing "Consensus One – Clara" v1 (19/11/2026),
passos 2 e 3 do fluxo (identificar cadastro; enviar link do Zoom).

## O que é

Três rotas **somente leitura** em `/api/ia/v1`, chamadas pelo n8n da NX Digital.
A IA não vende, não cadastra e não altera ato (briefing, seção 5): nenhuma rota
escreve em tabela de negócio. Contrato completo em `docs/api-ia.openapi.yaml`.

| Rota | Para quê |
|------|----------|
| `GET /api/ia/v1/saude` | testar URL e token no n8n |
| `GET /api/ia/v1/cadastro` | a pessoa já tem cadastro? (passo 2) |
| `GET /api/ia/v1/sessoes` | sessões agendadas + link do Zoom (passo 3) |

Identificação: `?telefone=5511987654321` (número do WhatsApp, qualquer formato)
e/ou `?documento=CPF-ou-CNPJ`.

## Autenticação

`Authorization: Bearer <IA_API_TOKEN>`. Variável de ambiente no EasyPanel
(`openssl rand -hex 32`); no n8n, credencial "Header Auth". Token ausente ou com
menos de 32 caracteres = API desligada (401). Comparação em tempo constante.
Limite: 60 consultas por minuto. Toda resposta leva `Cache-Control: no-store`.

## Regras de proteção

1. **Mínimo necessário.** Sai: id, primeiro nome, tipo, papéis, e por sessão:
   nº do procedimento, data/hora, modalidade, link, ID, senha, local. **Nunca**
   sai: CPF/CNPJ, e-mail, endereço, nome da outra parte, objeto, documentos.
2. **Telefone repetido não é adivinhado.** Dois cadastros no mesmo número →
   `motivo: "ambigua"`, `acao: "pedir_documento"`; a Clara pede o CPF/CNPJ.
3. **Telefone casa por DDD + 8 últimos dígitos**: ignora máscara, `55` e o nono
   dígito. Sem DDD não identifica ninguém.
4. **Quando o link é liberado** (REGRA A CONFIRMAR COM O CLIENTE):
   - Solicitante: status `DATA_CONFIRMADA` ou `CONVIDADO_CONVOCADO`;
   - Convidado: só `CONVIDADO_CONVOCADO` (depois da 2ª Carta-Convite);
   - Procurador: segue o lado de quem representa; sem representado
     registrado, vale o critério mais restrito (Convidado);
   - só sessão futura, com tolerância de 30 min após o horário marcado;
   - presencial: sem link/ID/senha; híbrida: os dois.
5. **Auditoria** (`CONSULTOU_API_IA`): rota, resultado e só os 4 últimos
   dígitos de telefone/documento.

## Respostas

- `encontrado: false` + `motivo` (`nao_encontrada` | `ambigua`) → Clara segue o
  fluxo do convidado sem cadastro (formulário → fila `cadastro`).
- `encontrado: true`, `sessoes: []` → cadastro sem sessão agendada
  (pendência 11 do briefing: definir o que a Clara responde).
- `sessoes[].dataHoraTexto` já vem pronto para a Clara dizer à pessoa.

## Como ligar no n8n

1. Credencial Header Auth: `Authorization` = `Bearer <token>`.
2. HTTP Request `GET {{URL}}/api/ia/v1/sessoes?telefone={{ telefone do WhatsApp }}`.
3. Ramificar por `encontrado`, `motivo` e `sessoes.length`.

## Fora desta entrega (depende do cliente ou da NX)

Formulário do convidado sem cadastro, tutorial do Zoom, filas, horário e a
confirmação da regra 4. Se o formulário for gravar no sistema, será uma rota
de escrita nova (`POST`), a desenhar com o cliente.

## Testes

`tests/unit/api-ia.test.ts` e `tests/integracao/api-ia.test.ts` (23 casos):
autenticação, telefone em formatos diferentes, ambiguidade, cada regra de
liberação do link, privacidade da resposta e auditoria.
