#!/usr/bin/env bash
#
# Endurecimento do VPS Ubuntu 24.04 — Consensus One
#
# Roda UMA vez, como root, logo depois de provisionar o servidor e ANTES de
# instalar o EasyPanel. Ver docs/07-infraestrutura-e-operacao.md
#
#   scp infra/endurecer-servidor.sh root@SEU_VPS:/root/
#   ssh root@SEU_VPS 'bash /root/endurecer-servidor.sh'
#
# REGRA QUE NÃO SE VIOLA: a porta 5432 nunca fica exposta para fora.
# Leia o bloco 6 — o ufw sozinho NÃO garante isso quando há Docker na máquina.

set -Eeuo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: rode como root." >&2
  exit 1
fi

echo "==> 1/7  Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "==> 2/7  Instalando pacotes"
# age: cifra o backup com chave pública, para a chave privada não morar aqui
apt-get install -y -qq ufw fail2ban unattended-upgrades postgresql-client awscli age

# ---------------------------------------------------------------- 3. SSH
echo "==> 3/7  SSH: só por chave"

# Trava de segurança: sem chave autorizada, desligar a senha te deixa de fora.
# Prefiro abortar a te trancar do lado de fora do próprio servidor.
CHAVES=0
for arquivo in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [ -s "$arquivo" ] && CHAVES=$((CHAVES + 1))
done

if [ "$CHAVES" -eq 0 ]; then
  echo "ERRO: nenhuma chave em authorized_keys." >&2
  echo "Rode 'ssh-copy-id root@SEU_VPS' da sua máquina e execute de novo." >&2
  exit 1
fi

# No 24.04 os arquivos de /etc/ssh/sshd_config.d/ têm precedência, e o
# cloud-init costuma deixar lá um PasswordAuthentication yes. Editar só o
# sshd_config — como está no docs/07 — pode não ter efeito nenhum.
cat > /etc/ssh/sshd_config.d/99-consensus.conf <<'EOF'
# Consensus One — acesso administrativo
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin prohibit-password
PermitEmptyPasswords no
MaxAuthTries 3
X11Forwarding no
EOF
chmod 644 /etc/ssh/sshd_config.d/99-consensus.conf

# valida a configuração ANTES de reiniciar; config inválida derruba o acesso
sshd -t
systemctl restart ssh.socket 2>/dev/null || true
systemctl restart ssh
echo "    SSH por senha: desligado (validado com sshd -t)"

# ---------------------------------------------------------------- 4. firewall
echo "==> 4/7  Firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP (redireciona para HTTPS)'
ufw allow 443/tcp   comment 'HTTPS'

# Explícito de propósito: documenta a regra e protege contra alguém liberar
# a porta por engano mais tarde. O "deny" fica registrado em 'ufw status'.
ufw deny 5432/tcp   comment 'PostgreSQL NUNCA exposto — use tunel SSH'
ufw --force enable

# ---------------------------------------------------------------- 5. fail2ban
echo "==> 5/7  fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = 22
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---------------------------------------------------------------- 6. upgrades
echo "==> 6/7  Atualizações de segurança automáticas"
# Escrito direto no arquivo: 'dpkg-reconfigure -plow' abre menu interativo e
# trava quando o script roda sem terminal.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52unattended-upgrades-consensus <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades

# ---------------------------------------------------------------- 7. postgres
echo "==> 7/7  Conferindo que a 5432 não está publicada"

# rotação dos logs de backup, referenciada no crontab-producao
cat > /etc/logrotate.d/consensus <<'EOF'
/var/log/consensus-*.log {
  weekly
  rotate 12
  compress
  missingok
  notifempty
  create 640 root adm
}
EOF

# ATENÇÃO, e é o ponto mais importante deste script:
# o Docker escreve as próprias regras de iptables e PASSA POR CIMA do ufw.
# Um container publicado com "ports: 5432:5432" fica acessível da internet
# mesmo com o ufw negando a porta. O controle real é não publicar a porta:
# no EasyPanel, o Postgres não deve ter porta exposta, só a rede interna.
mkdir -p /opt/consensus

EXPOSTA=0
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Ports}}' 2>/dev/null | grep -E '0\.0\.0\.0:5432|:::5432' >/dev/null; then
    EXPOSTA=1
  fi
fi
if ss -ltn 2>/dev/null | grep -E '0\.0\.0\.0:5432|\[::\]:5432' >/dev/null; then
  EXPOSTA=1
fi

if [ "$EXPOSTA" -eq 1 ]; then
  echo ""
  echo "  #############################################################"
  echo "  #  ALERTA: a porta 5432 está publicada em todas as interfaces"
  echo "  #  O ufw NÃO bloqueia porta publicada por container Docker."
  echo "  #  Remova o mapeamento de porta do Postgres no EasyPanel e"
  echo "  #  deixe o banco só na rede interna. Confira de novo depois."
  echo "  #############################################################"
  echo ""
else
  echo "    5432 não está publicada para fora. Confirme de novo após subir o EasyPanel."
fi

echo ""
echo "======================= RESUMO ======================="
ufw status verbose | head -n 20
echo ""
systemctl is-active fail2ban unattended-upgrades | tr '\n' ' '; echo ""
echo "====================================================="
echo ""
echo "AGORA, SEM FECHAR ESTA SESSÃO:"
echo "  abra um SEGUNDO terminal e confirme que 'ssh root@SEU_VPS' ainda entra."
echo "  Se não entrar, você ainda tem esta sessão aberta para corrigir."
