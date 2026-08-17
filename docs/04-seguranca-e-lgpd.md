# Segurança e LGPD

## Papéis definidos no contrato

- **Consensus One:** controladora dos dados pessoais
- **NX Netscale:** operadora, atua conforme instrução da controladora

Isso está na Cláusula 17ª, § 1º do contrato. Toda decisão sobre finalidade,
retenção e compartilhamento é da câmara, não da NX.

## Checklist de implementação

### Autenticação
- [ ] Senha com Argon2id (`argon2` — memória 19 MiB, 2 iterações, paralelismo 1)
- [ ] Cookie de sessão `httpOnly`, `Secure`, `SameSite=Lax`
- [ ] TOTP obrigatório para ADMIN e OPERADOR
- [ ] Bloqueio de 15 minutos após 5 tentativas falhas
- [ ] Sessão expira em 8 horas de inatividade
- [ ] Troca de senha invalida todas as sessões ativas

### Autorização
- [ ] Toda query filtra por papel no servidor
- [ ] Teste automatizado: parte A não acessa ato da parte B
- [ ] Teste automatizado: PARTE não acessa ato antes de `SESSAO_REALIZADA`
- [ ] Rota de API sem verificação de sessão não pode existir, exceto
      `/verificar` e `/login`

### Arquivos
- [ ] Bucket privado, sem listagem pública
- [ ] Download só por URL pré-assinada, expiração de 10 minutos
- [ ] Hash SHA-256 gravado na subida, conferido na leitura
- [ ] Upload valida tipo MIME real, não só a extensão
- [ ] Limite de tamanho por arquivo

### Dados
- [ ] TLS obrigatório, HSTS ativo
- [ ] Criptografia em repouso no provedor
- [ ] Backup diário automático + PITR
- [ ] **Teste de restauração mensal, com registro** — backup nunca restaurado
      não é backup
- [ ] Dados de homologação são fictícios, jamais cópia de produção

### Rastreabilidade
- [ ] Login, download, alteração de ato e consulta de documento em
      `LogAuditoria`
- [ ] Log retido por 12 meses no mínimo
- [ ] Log não guarda senha, token ou conteúdo de documento

### Resposta a incidente
- [ ] Procedimento escrito de comunicação à controladora em até 48 horas
      (Cláusula 17ª, § 3º)
- [ ] Contato responsável definido dos dois lados

## Dados pessoais tratados

| Dado | Origem | Base legal sugerida | Retenção |
|---|---|---|---|
| Nome, CPF/CNPJ, contato das partes | Cadastro pelo operador | Execução de procedimento de conciliação | A definir com o cliente |
| Documentos do processo | Envio pelo requerente | Idem | Idem |
| Ata e termo de acordo | Gerados pelo sistema | Idem | Provável retenção longa, por natureza probatória |
| Logs de acesso | Automático | Legítimo interesse, segurança | 12 meses |

A coluna de retenção precisa ser preenchida pela Consensus One. É decisão da
controladora e a NX não deve arbitrar.
