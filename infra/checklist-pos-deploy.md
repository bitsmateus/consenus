# Checklist pós-deploy — executar na mão

Rode na ordem. Cada item tem o comando e o **resultado esperado**: se o que
aparecer for diferente, pare e corrija antes de seguir.

Legenda: `[local]` roda na sua máquina · `[vps]` roda logado no servidor.

---

## 1. A porta 5432 está fechada — a regra que não se viola

Este bloco vem primeiro de propósito. É o único item que, se falhar, exige
derrubar o serviço na hora.

- [ ] **`[local]`** varredura de fora, com o serviço no ar:

      nc -zv -w 5 SEU_IP_DO_VPS 5432

      Esperado: `Connection timed out` ou `refused`.
      Se responder `succeeded`, o banco está na internet. Pare tudo.

- [ ] **`[local]`** confirmação por outro caminho:

      nmap -Pn -p 5432,22,80,443 SEU_IP_DO_VPS

      Esperado: 22, 80 e 443 `open`; **5432 `filtered` ou `closed`**.

- [ ] **`[vps]`** onde o Postgres está escutando:

      ss -ltn | grep 5432

      Esperado: `127.0.0.1:5432`. Se aparecer `0.0.0.0:5432` ou `[::]:5432`,
      remova o mapeamento de porta do Postgres no EasyPanel.

- [ ] **`[vps]`** o Docker não furou o firewall:

      docker ps --format '{{.Names}}\t{{.Ports}}' | grep 5432

      Esperado: nada, ou apenas `127.0.0.1:5432->5432/tcp`.
      Lembre: o ufw **não** bloqueia porta publicada por container.

- [ ] **`[vps]`** o firewall está ativo e sem surpresa:

      ufw status verbose

      Esperado: `Status: active`, `deny (incoming)` por padrão, e só
      22, 80 e 443 permitidos.

## 2. Acesso ao servidor

- [ ] **`[local]`** senha não entra:

      ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@SEU_VPS

      Esperado: `Permission denied (publickey)`.

- [ ] **`[local]`** chave entra: `ssh root@SEU_VPS` funciona.
- [ ] **`[vps]`** `systemctl is-active fail2ban` → `active`
- [ ] **`[vps]`** `fail2ban-client status sshd` responde sem erro
- [ ] **`[vps]`** `systemctl is-active unattended-upgrades` → `active`
- [ ] **`[vps]`** `unattended-upgrades --dry-run --debug 2>&1 | tail -5` sem erro

## 3. TLS e domínio

- [ ] **`[local]`** `curl -sI https://sistema.consensusone.com.br | head -1` → `HTTP/2 200`
- [ ] **`[local]`** HTTP redireciona:

      curl -sI http://sistema.consensusone.com.br | grep -i location

      Esperado: `location: https://...`

- [ ] **`[local]`** certificado válido e emissor Let's Encrypt:

      echo | openssl s_client -connect sistema.consensusone.com.br:443 2>/dev/null | openssl x509 -noout -dates -issuer

- [ ] **`[local]`** HSTS presente:

      curl -sI https://sistema.consensusone.com.br | grep -i strict-transport

      Se não aparecer, ligue HSTS no EasyPanel (docs/04 exige).

## 4. A aplicação responde e protege o que deve

- [ ] **`[local]`** raiz manda para o login:

      curl -sI https://sistema.consensusone.com.br/ | grep -iE 'HTTP|location'

      Esperado: `302` para `/entrar?de=%2F`

- [ ] **`[local]`** `/entrar` → `200`
- [ ] **`[local]`** `/verificar` → `200` (é pública, e tem que continuar sendo)
- [ ] **`[local]`** rota interna sem sessão não vaza:

      curl -sI https://sistema.consensusone.com.br/painel | grep -i location

      Esperado: redireciona para `/entrar`

- [ ] **`[local]`** API sem sessão responde 401 em JSON, não HTML:

      curl -s -o /dev/null -w '%{http_code}\n' https://sistema.consensusone.com.br/api/atos

      Esperado: `401`

- [ ] **`[local]`** a página de verificação **não** revela nada além do previsto:
      abra `/verificar`, informe um código válido e confirme que a tela mostra
      só existe/tipo/data de emissão. Nome de parte ou arquivo ali é falha
      grave (CLAUDE.md, regra 5).

## 5. Banco e migrações

- [ ] **`[vps]`** migrações aplicadas, sem pendência:

      docker exec -it producao_app npx prisma migrate status

      Esperado: `Database schema is up to date!`

- [ ] **`[vps]`** a URL de verificação está com a grafia certa:

      docker exec -it producao_postgres psql -U consensus -d consensus_one \
        -c 'SELECT "urlVerificacao" FROM "ConfiguracaoSistema";'

      Esperado: `https://consensusone.com.br/verificar` — com dois "s" em
      "consensus". Se vier `consensone`, o QR Code de todo documento vai
      apontar para um domínio que não é do cliente.

- [ ] **`[vps]`** o banco de produção **não** tem dado de demonstração:

      docker exec -it producao_postgres psql -U consensus -d consensus_one \
        -c 'SELECT email, papel FROM "Usuario";'

      Esperado: só as contas reais da equipe. Nenhum `admin@consensusone.com.br`
      com a senha do seed. Se houver, troque a senha antes de qualquer coisa.

## 6. Autenticação e auditoria

- [ ] Entrar com uma conta real pelo navegador funciona.
- [ ] Conta ADMIN/OPERADOR **é obrigada** a configurar a verificação em duas
      etapas antes de acessar o sistema (cai em `/seguranca`).
- [ ] **`[vps]`** o login ficou registrado:

      docker exec -it producao_postgres psql -U consensus -d consensus_one \
        -c 'SELECT acao, "criadoEm" FROM "LogAuditoria" ORDER BY "criadoEm" DESC LIMIT 5;'

      Esperado: uma linha `LOGIN` com a hora do seu acesso.

- [ ] Errar a senha de propósito e confirmar que aparece `LOGIN_FALHOU`.

## 7. Armazenamento de documentos

- [ ] **`[local]`** o bucket é privado — objeto não abre sem assinatura:

      curl -sI https://br-se1.magaluobjects.com/consensus-one/

      Esperado: `403`. Se listar arquivo, o bucket está público. Falha grave.

- [ ] Subir um documento pelo sistema e baixá-lo em seguida funciona.
- [ ] O link de download expira: copie a URL pré-assinada, espere 11 minutos e
      tente de novo. Esperado: erro de expiração.

## 8. Backup — o item que ninguém confere e todo mundo precisa

- [ ] **`[vps]`** a passphrase não está no servidor. Este comando tem que voltar **vazio**:

      grep -ri "BACKUP_PASSPHRASE\|AGE-SECRET-KEY" /opt /etc /root /home 2>/dev/null

      Qualquer resultado aqui é violação da regra. Apague e regenere o par de chaves.

- [ ] **`[vps]`** permissão do arquivo de ambiente:

      stat -c '%a %U' /opt/consensus/.env.backup

      Esperado: `600 root`

- [ ] **`[vps]`** o backup roda de verdade, na mão, antes de confiar no cron:

      set -a; . /opt/consensus/.env.backup; set +a; /opt/consensus/backup-postgres.sh

      Esperado: termina sem erro e imprime o tamanho do dump.

- [ ] **`[vps]`** o arquivo chegou no R2:

      aws s3 ls s3://consensus-one-backup/postgres/ --endpoint-url "$BACKUP_S3_ENDPOINT"

- [ ] **`[vps]`** o crontab está instalado: `crontab -l` mostra as quatro linhas.
- [ ] **`[local]`** healthchecks.io recebeu o ping e o check está verde.
- [ ] **`[local]`** **restauração testada**: rode `infra/restaurar-backup.sh` na
      sua máquina, com a chave privada vinda do gerenciador de senhas. Confira
      se as contagens fazem sentido e **anote na tabela de docs/07**.
      Backup nunca restaurado não é backup.

## 9. Responsividade

- [ ] Abrir `/entrar`, `/painel` e `/verificar` em 375px de largura.
      Sem rolagem horizontal, alvo de toque com pelo menos 44px (docs/05).

---

## Registro

| Item | Data | Quem | Observação |
|---|---|---|---|
| Deploy verificado | | | |
| Restauração testada | | | |
