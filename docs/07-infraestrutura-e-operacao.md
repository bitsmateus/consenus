# Infraestrutura e operação

Decisão fechada em 13/08/2026.

## Arquitetura

```
                    consensusone.com.br
                            │
                    ┌───────▼────────┐
                    │  VPS Hostinger │   São Paulo
                    │   EasyPanel    │
                    ├────────────────┤
                    │  App Next.js   │  container
                    │  PostgreSQL 16 │  container
                    │  Caddy / SSL   │  gerenciado pelo EasyPanel
                    └───────┬────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   Magalu Object Storage         Cloudflare R2
   (documentos, br-se1)          (backup criptografado)
   território nacional           réplica fora do país
```

**Os arquivos NÃO ficam no disco do VPS.** Documento em disco de VPS não tem
replicação: o disco morre, o documento morre junto. Object storage tem
redundância embutida. Isso não é opcional.

## Provisionamento — passo a passo

### 1. VPS

- Plano **KVM 2** (2 vCPU, 8 GB, 100 GB NVMe)
- **Datacenter: São Paulo** — confirmar na hora da contratação
- Ubuntu 24.04 LTS
- Conta em nome da Consensus One (Cláusula 5ª, alínea "b")

### 2. Blindagem do servidor, antes de qualquer coisa

```bash
# acesso só por chave, nunca por senha
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh

# firewall: só o necessário
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80,443/tcp
ufw enable

# bloqueio de força bruta
apt install -y fail2ban
systemctl enable --now fail2ban

# atualizações de segurança automáticas
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

**A porta 5432 nunca é exposta.** O Postgres só é acessível pela rede interna
do Docker. Se precisar acessar de fora, use túnel SSH.

### 3. EasyPanel

- Plano **Hobby**, US$ 10,90/mês — é ele que libera backup de banco
- Criar dois projetos: `producao` e `homologacao`
- App a partir do `Dockerfile` do repositório
- Postgres pelo template, com volume persistente
- Domínios: `sistema.consensusone.com.br` e `homologacao.consensusone.com.br`
- SSL automático via Let's Encrypt

### 4. Object storage

- Bucket `consensus-one` na Magalu, região **br-se1**, **privado**
- Bucket `consensus-one-backup` no Cloudflare R2
- Chaves de acesso separadas por ambiente

### 5. Backup — a parte que não pode falhar

```bash
apt install -y postgresql-client awscli
cp infra/*.sh /opt/consensus/
chmod +x /opt/consensus/*.sh

crontab -e
```

```cron
# dump do banco às 3h e às 15h
0 3,15 * * * . /opt/consensus/.env.backup && /opt/consensus/backup-postgres.sh >> /var/log/backup.log 2>&1
# réplica dos documentos às 4h
0 4 * * *    . /opt/consensus/.env.backup && /opt/consensus/sincronizar-arquivos.sh >> /var/log/sync.log 2>&1
```

**Monitoramento do backup.** Crie um check no healthchecks.io e coloque a URL
em `HEALTHCHECK_URL`. O script só avisa quando termina com sucesso — se o
backup parar de rodar, você recebe alerta. Sem isso, você vai descobrir que o
backup estava quebrado no pior dia possível.

**Guarde a `BACKUP_PASSPHRASE` fora do servidor.** Se ela se perder, o backup
criptografado vira um monte de bytes inúteis. Gerenciador de senhas, não
arquivo no VPS.

## Rotina de operação

### Toda semana
- [ ] Conferir no healthchecks.io se os backups rodaram todos os dias
- [ ] Olhar uso de disco: `df -h` — acima de 80%, agir

### Todo mês
- [ ] **Rodar `infra/restaurar-backup.sh` e registrar o resultado abaixo**
- [ ] Aplicar atualizações do sistema e reiniciar se houver kernel novo
- [ ] Revisar log de auditoria em busca de acesso estranho
- [ ] Conferir se as imagens Docker estão atualizadas

### Registro dos testes de restauração

| Data | Backup testado | Resultado | Quem |
|---|---|---|---|
| | | | |

Esta tabela é sua defesa. Se um dia der problema e o cliente perguntar se
havia backup, você mostra o histórico de testes — não uma promessa.

## Limites conhecidos desta escolha

Assumidos conscientemente ao optar pelo VPS único:

1. **Sem recuperação point-in-time.** A perda máxima é de até 12 horas, o
   intervalo entre os dumps. Se isso virar inaceitável para o cliente, a
   correção é migrar o banco para um serviço gerenciado — o código não muda,
   só a string de conexão.
2. **Ponto único de falha.** App e banco no mesmo servidor. Se o VPS cair,
   o sistema fica fora até subir de novo.
3. **Manutenção é sua.** Patch de sistema, atualização de Docker e
   monitoramento entram na rotina da mensalidade de R$ 400.
4. **Restaurar leva tempo.** Provisionar servidor novo e restaurar o dump é
   coisa de uma a duas horas. Não é failover automático.

Nada disso é impeditivo para o porte desta câmara. Mas está escrito aqui para
que a decisão seja consciente, e para que qualquer pessoa que assuma o projeto
depois saiba o que herdou.

## Custo mensal

| Item | Valor |
|---|---|
| Hostinger KVM 2 (preço de renovação) | R$ 77,99 |
| EasyPanel Hobby | ~R$ 60,00 |
| Magalu Object Storage (~50 GB) | ~R$ 5,00 |
| Cloudflare R2 (backup) | ~R$ 5,00 |
| Domínio | ~R$ 5,00 |
| **Total** | **~R$ 153,00** |

Dentro da faixa de R$ 300 a 500 prevista no contrato, com folga. A diferença
cobre o crescimento do volume de documentos e eventual upgrade do VPS.
