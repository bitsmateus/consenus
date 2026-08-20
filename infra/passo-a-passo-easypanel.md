# Configuração no EasyPanel — passo a passo

Valores prontos para colar. Complementa `infra/variaveis-de-producao.md`, que
explica o porquê de cada variável.

> **Antes de tudo:** o painel do EasyPanel está exposto na internet em HTTP puro
> (`http://SEU_IP:3000`). A senha do painel viaja em texto claro, e esse painel
> controla o servidor inteiro. Resolva isso primeiro — instruções no fim.

---

## 1. Serviço do banco

**+ Service → Postgres** (template do EasyPanel), no projeto `producao`.

| Campo | Valor |
|---|---|
| Nome do serviço | `postgres` |
| Usuário | `consensus` |
| Senha | gere uma longa e guarde no gerenciador de senhas |
| Banco | `consensus_one` |

Em **Advanced / Ports**: **não publique a porta 5432.** Se houver mapeamento de
porta, remova. O banco só precisa da rede interna do EasyPanel — e a regra do
projeto é que a 5432 nunca fica exposta.

Marque o **volume persistente**. Sem ele, uma recriação do container apaga o
banco.

## 2. Serviço da aplicação

**+ Service → App**, no mesmo projeto.

| Campo | Valor |
|---|---|
| Nome do serviço | `app` |
| Source | GitHub → `bitsmateus/consenus` |
| Branch | `main` |
| Build | Dockerfile (detectado sozinho) |

O `Dockerfile` já roda `prisma migrate deploy` na subida, então o schema é
aplicado sozinho no primeiro deploy.

## 3. Variáveis de ambiente do app

Cole no bloco **Environment** do serviço `app`. Troque o que está em MAIÚSCULAS.

```
DATABASE_URL=postgresql://consensus:SENHA_DO_BANCO@producao_postgres:5432/consensus_one?schema=public
AUTH_SECRET=COLE_O_SEGREDO_GERADO
AUTH_URL=https://sistema.consensusone.com.br
NEXT_PUBLIC_URL_VERIFICACAO=https://consensusone.com.br/verificar
NODE_ENV=production
TZ=America/Sao_Paulo

S3_ENDPOINT=https://arquivos.consensusone.com.br
S3_REGION=br-se1
S3_BUCKET=consensus-one
S3_ACCESS_KEY_ID=CHAVE_DO_MINIO
S3_SECRET_ACCESS_KEY=SEGREDO_DO_MINIO
S3_FORCE_PATH_STYLE=true

SMTP_HOST=DO_PROVEDOR
SMTP_PORT=587
SMTP_USER=DO_PROVEDOR
SMTP_PASSWORD=DO_PROVEDOR
EMAIL_REMETENTE=nao-responda@consensusone.com.br
```

Três armadilhas:

1. O host do `DATABASE_URL` é o **nome interno** do serviço. No EasyPanel
   costuma ser `projeto_servico`, aqui `producao_postgres`. Se você precisou
   abrir porta no firewall para a string funcionar, ela está errada.
2. **Não defina `S3_CRIPTOGRAFIA`.** Sem ela o padrão é `AES256`, que é a
   criptografia em repouso exigida pelo `docs/04`. A variável só existe vazia em
   desenvolvimento, porque o MinIO local não tem KMS.
3. `NEXT_PUBLIC_` vai embutido no JavaScript que chega ao navegador. Nunca
   ponha segredo com esse prefixo.

## 4. Domínio e SSL

Só depois que o DNS estiver propagado — o Let's Encrypt valida por HTTP e falha
se o domínio ainda não resolve.

No serviço `app` → **Domains**: `sistema.consensusone.com.br`, com **SSL
automático** e **redirecionar HTTP para HTTPS**.

## 5. Primeiro administrador

Sem este passo o sistema sobe e ninguém entra: criar conta pela tela exige estar
logado como administrador, e o seed de demonstração se recusa a rodar em
produção.

No EasyPanel, serviço `app` → **Console**:

```bash
ADMIN_NOME="Sergio Ferreira" \
ADMIN_EMAIL="sergio@consensusone.com.br" \
ADMIN_SENHA="uma senha longa e única" \
node scripts/criar-admin.cjs
```

O script exige senha de 12+ caracteres com maiúscula, minúscula e número,
registra a criação em auditoria e **recusa criar um segundo administrador**. Do
primeiro em diante, contas saem pela tela de Equipe.

**Tenha um aplicativo autenticador à mão:** o primeiro acesso cai na tela de
Segurança e não sai de lá até a verificação em duas etapas ser ativada.

## 6. Conferência

Percorra o `infra/checklist-pos-deploy.md` inteiro, começando pelo bloco da
porta 5432. A varredura tem que ser feita **da sua máquina**, não de dentro do
servidor — é a única prova que vale.

O teste mais rápido de tudo funcionar de ponta a ponta: abra um procedimento,
emita a Carta-Convite e confira o código na página `/verificar` em janela
anônima. Se o PDF gerou e o código valida, storage, banco e aplicação estão de pé.

---

## Fechar o painel do EasyPanel

Hoje ele responde em `http://SEU_IP:3000`, alcançável de qualquer lugar da
internet, sem TLS. Duas providências:

**Dar domínio e SSL ao painel.** Crie um registro DNS `painel` apontando para o
IP e configure em **Settings → Domain** do EasyPanel, com SSL. A partir daí o
acesso é `https://painel.consensusone.com.br`, cifrado.

**Fechar a porta 3000 depois disso.** Atenção a uma armadilha que vale para todo
este projeto: o **Docker escreve as próprias regras de iptables e passa por cima
do ufw**. Negar a 3000 no ufw pode não surtir efeito nenhum se o container
publicar a porta em `0.0.0.0`. Confira de fora, com `nc -zv SEU_IP 3000`, e não
pelo `ufw status`.

Enquanto o painel estiver em HTTP puro, **não acesse de rede pública** e troque a
senha dele depois de fechar — a atual já trafegou em texto claro.

## Ordem sugerida

1. Fechar o painel (domínio + SSL, ou ao menos trocar a senha em rede confiável)
2. `infra/endurecer-servidor.sh` — e confirmar num segundo terminal que o SSH
   ainda entra antes de fechar o primeiro
3. DNS de `sistema` e `homologacao`
4. Bucket `consensus-one` no MinIO do VPS, **privado** (ver docs/07)
5. Postgres e app no EasyPanel, com as variáveis acima
6. Domínio e SSL do app
7. Primeiro administrador pelo console
8. Checklist pós-deploy
9. Backup: par de chaves na sua máquina, crontab no servidor, e **um teste de
   restauração** antes de considerar pronto
