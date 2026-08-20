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
                    │  MinIO         │  container — DOCUMENTOS
                    │  Caddy / SSL   │  gerenciado pelo EasyPanel
                    └───────┬────────┘
                            │
                            ▼
                     Cloudflare R2
                     backup do banco (criptografado)
                     réplica dos documentos (EM CLARO)
                     fora do país
```

> **Atenção — este parágrafo descrevia a intenção, não o que existe.**
>
> O texto original dizia que os arquivos não ficam no disco do VPS, porque
> disco de VPS não tem redundância: o disco morre, o documento morre junto.
> O argumento continua válido.
>
> Só que, em produção, **os documentos ficam sim no disco do VPS**, no MinIO
> local. O cliente optou por esse arranjo em 20/08/2026, ciente da alternativa.
> A redundância vem de fora: o `sincronizar-arquivos.sh` replica os documentos
> cifrados para o Cloudflare R2 uma vez por dia, o que põe a perda máxima de
> documentos em **24 horas**, contra as 12 horas do banco.
>
> **Essa réplica não funcionou até 20/08/2026.** O script mandava um único
> `--endpoint-url` para origem e destino, procurava os documentos dentro do R2,
> não achava nada e terminava com sucesso — o cron registrava "concluída" todo
> dia sem copiar um arquivo sequer. Corrigido; ver a seção de object storage.
>
> Ver a seção "Object storage" abaixo para as consequências completas.

## Provisionamento — passo a passo

### 1. VPS

- Plano **KVM 2** (2 vCPU, 8 GB, 100 GB NVMe)
- **Datacenter: São Paulo** — confirmar na hora da contratação
- Ubuntu 24.04 LTS
- Conta em nome da Consensus One (Cláusula 5ª, alínea "b")

### 2. Blindagem do servidor, antes de qualquer coisa

Tudo automatizado em **`infra/endurecer-servidor.sh`**. Rode como root, uma vez,
antes de instalar o EasyPanel:

```bash
scp infra/endurecer-servidor.sh root@SEU_VPS:/root/
ssh root@SEU_VPS 'bash /root/endurecer-servidor.sh'
```

O script cobre SSH só por chave, ufw, fail2ban e unattended-upgrades. Três
detalhes por que ele não é só um `sed` no `sshd_config`:

1. No Ubuntu 24.04 os arquivos de `/etc/ssh/sshd_config.d/` têm precedência, e
   o cloud-init costuma deixar lá um `PasswordAuthentication yes`. Editar só o
   `sshd_config` pode não surtir efeito nenhum. O script escreve um drop-in.
2. Ele aborta se não houver chave em `authorized_keys` — desligar a senha sem
   isso te tranca do lado de fora do próprio servidor.
3. `dpkg-reconfigure -plow` abre menu interativo e trava em execução sem
   terminal; a configuração é escrita direto no arquivo.

**A porta 5432 nunca é exposta.** O Postgres só é acessível pela rede interna
do Docker. Se precisar acessar de fora, use túnel SSH.

Atenção a uma armadilha: **o ufw não protege porta publicada por container.**
O Docker escreve as próprias regras de iptables e passa por cima do firewall —
um `ports: 5432:5432` fica acessível da internet mesmo com o ufw negando a
porta. O controle real é não publicar a porta; no máximo publique em
`127.0.0.1:5432:5432`. Confira com `ss -ltn | grep 5432` e pela varredura
externa descrita em `infra/checklist-pos-deploy.md`.

### 3. EasyPanel

- Plano **Hobby**, US$ 10,90/mês — é ele que libera backup de banco
- Criar dois projetos: `producao` e `homologacao`
- App a partir do `Dockerfile` do repositório
- Postgres pelo template, com volume persistente
- Domínios: `sistema.consensusone.com.br` e `homologacao.consensusone.com.br`
- SSL automático via Let's Encrypt

### 4. Object storage

**Arranjo em produção, decidido em 20/08/2026:** os documentos ficam num
**MinIO no próprio VPS**, exposto em `arquivos.consensusone.com.br`. A Magalu
Object Storage foi avaliada e descartada pelo cliente.

- Bucket `consensus-one` no MinIO local, **privado**
- Bucket `consensus-one-backup` no Cloudflare R2 (backup do banco e réplica
  diária dos documentos)
- Chaves de acesso separadas por ambiente

O que isso custa, e que precisa estar consciente:

| Consequência | Situação |
|---|---|
| Criptografia em repouso | **ausente** — MinIO exigiria KES/KMS, com a chave na mesma máquina |
| Documento no disco do VPS | sim — perder o VPS é perder a origem, restando a réplica no R2 |
| Território nacional | atendido: o VPS é em São Paulo |
| Réplica fora do país | os documentos vão **cifrados** com `age` para o R2 |

Migrar para object storage externo continua sendo a recomendação técnica, e
fica barato enquanto o volume é pequeno (~R$ 5/mês). Quanto mais tarde, mais
caro — mover documento com valor jurídico exige janela e conferência.

#### A réplica dos documentos estava quebrada

Descoberto em 20/08/2026: o bucket do R2 só continha `postgres/`. Nenhum
documento havia sido replicado, nunca. O `sincronizar-arquivos.sh` usava um
`--endpoint-url` só para os dois lados e não tinha as credenciais da origem,
então listava um caminho inexistente dentro do R2 e saía com sucesso.

Foi reescrito e agora: usa credenciais e endpoint separados para origem e
destino; **cifra cada arquivo com a chave pública `age`** antes do envio, como
o dump do banco; copia só o que falta, de modo idempotente; e avisa quando a
origem vem vazia, que é o sintoma de credencial errada.

**Para recuperar um documento da réplica** — na sua máquina, com a chave
privada:

```bash
aws s3 cp s3://consensus-one-backup/replica-atos/CAMINHO.age . \
  --endpoint-url "$BACKUP_S3_ENDPOINT"
age --decrypt --identity consensus-backup.key --output documento.pdf CAMINHO.age
```

### 5. Backup — a parte que não pode falhar

```bash
cp infra/*.sh /opt/consensus/
chmod +x /opt/consensus/*.sh
install -m 600 -o root -g root /dev/null /opt/consensus/.env.backup
# preencher conforme infra/variaveis-de-producao.md, seção B

crontab -e   # colar o conteúdo de infra/crontab-producao
```

As linhas prontas estão em **`infra/crontab-producao`**. Repare no `set -a`
antes de carregar o `.env.backup`: sem ele as variáveis ficam só no shell do
cron e não chegam ao script, que aborta reclamando de variável indefinida.

**Monitoramento do backup.** Crie um check no healthchecks.io e coloque a URL
em `HEALTHCHECK_URL`. O script só avisa quando termina com sucesso — se o
backup parar de rodar, você recebe alerta. Sem isso, você vai descobrir que o
backup estava quebrado no pior dia possível.

**A chave que decifra o backup não vive no servidor.** Guardar a passphrase no
VPS anularia o backup como proteção: quem invade o servidor levaria o banco e a
chave dos backups na mesma ida. Por isso o backup é cifrado com **chave
pública** (`age`) — o servidor cifra e não decifra.

| Onde | O quê | É segredo? |
|---|---|---|
| VPS, em `.env.backup` | `BACKUP_CHAVE_PUBLICA` (`age1...`) | não |
| Gerenciador de senhas | chave privada (`AGE-SECRET-KEY-1...`) | **sim** |
| Segundo cofre, outra pessoa | segunda via da privada | sim |

Gere o par **na sua máquina**, nunca no servidor:

```bash
age-keygen -o consensus-backup.key
```

A restauração (`infra/restaurar-backup.sh`) roda no seu computador, com a chave
privada vinda do cofre — é o único momento em que ela sai de lá. Perdeu a chave
e não tem segunda via? Todos os backups viram bytes inúteis.

## Rotina de operação

### Toda semana
- [ ] Conferir no healthchecks.io se os backups rodaram todos os dias
- [ ] Olhar uso de disco: `df -h` — acima de 80%, agir

### Todo mês
- [ ] **Rodar `infra/restaurar-backup.sh` e registrar o resultado abaixo**
- [ ] **Recuperar um documento da réplica no R2 e conferir que abre** — a
      réplica dos documentos merece a mesma desconfiança que o dump do banco:
      cópia que nunca foi aberta não é cópia. Receita abaixo
- [ ] Aplicar atualizações do sistema e reiniciar se houver kernel novo
- [ ] Revisar log de auditoria em busca de acesso estranho
- [ ] Conferir se as imagens Docker estão atualizadas

### Registro dos testes de restauração

| Data | Backup testado | Resultado | Quem |
|---|---|---|---|
| 19/08/2026 | `consensus-one_2026-08-19_2307.dump.enc` | ✅ Íntegro — 1 usuário, 2 pessoas, 2 atos, 1 documento, batendo com a produção | Mateus |

Esta tabela é sua defesa. Se um dia der problema e o cliente perguntar se
havia backup, você mostra o histórico de testes — não uma promessa.

### Como conferir a réplica de um documento

Na **sua máquina**, nunca no servidor — precisa da chave privada `age`.

```bash
export AWS_ACCESS_KEY_ID="..." AWS_SECRET_ACCESS_KEY="..." AWS_DEFAULT_REGION=auto
EP="https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com"

# escolha qualquer um dos replicados
ALVO=$(aws s3 ls s3://consensus-one-backup/replica-atos/ --recursive \
       --endpoint-url "$EP" | awk '{print $4}' | tail -n1)

aws s3 cp "s3://consensus-one-backup/${ALVO}" /tmp/doc.age --endpoint-url "$EP"
age --decrypt --identity consensus-backup.key --output /tmp/doc.pdf /tmp/doc.age

head -c 5 /tmp/doc.pdf     # tem que sair %PDF-
rm -f /tmp/doc.age /tmp/doc.pdf
```

Sai `%PDF-`, o documento está íntegro e a chave abre a réplica. Registre na
tabela abaixo, junto com o teste do banco.

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
