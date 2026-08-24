# Passo a passo — credenciais do Zoom

Para o sistema agendar a Sessão Privada de Conciliação sozinho, ele precisa de
três credenciais de um app **Server-to-Server OAuth** na conta Zoom da câmara.

Não é o OAuth de usuário: não há tela de "permitir acesso", ninguém precisa
logar, e o app não vai para loja nenhuma. É um app interno da conta.

> A Zoom mexe no Marketplace com frequência. Os nomes de menu podem sair do
> lugar; o que não muda é a sequência: criar o app, preencher contato,
> conceder escopos de reunião, ativar e copiar as três credenciais.

---

## Antes de começar

- [ ] Entrar com uma conta que seja **proprietária ou administradora** da conta
      Zoom da câmara. Usuário comum não vê a opção de criar app.
- [ ] Confirmar o **plano da conta**. No plano gratuito, reunião com três ou
      mais participantes corta em 40 minutos — e a sessão é agendada para 90.
      Se a câmara está no gratuito, avise antes de a primeira sessão real cair
      no meio.

---

## 1. Abrir o Marketplace

Acesse **https://marketplace.zoom.us** e entre com a conta da câmara.

Confira no canto superior direito se entrou com a conta certa: é comum o
navegador reaproveitar outra sessão do Zoom já aberta.

## 2. Criar o app

1. Menu **Develop** (ou "Desenvolver") → **Build App**.
2. Na lista de tipos, escolha **Server-to-Server OAuth**.
3. Clique em **Create**.
4. Dê um nome que a equipe reconheça depois, por exemplo:
   `Consensus One — Agendamento de Sessões`.

## 3. Guardar as três credenciais

A primeira tela depois de criar é **App Credentials**. Ela mostra:

- **Account ID**
- **Client ID**
- **Client Secret** (precisa clicar para revelar)

**Copie os três agora**, para um gerenciador de senhas. Diferente da D4Sign, o
Zoom permite consultar de novo depois — mas não conte com isso.

## 4. Preencher as informações obrigatórias

Na aba **Information**, o Zoom exige, e não deixa ativar sem:

- **Company Name**: `Consensus One`
- **Developer Contact Name** e **Email**: quem cuida da conta na câmara

Endereço e política de privacidade não são exigidos em app interno.

## 5. Conceder os escopos

Aba **Scopes** → **Add Scopes** → procure por **meeting**.

O sistema faz exatamente duas coisas no Zoom: **cria** uma reunião ao abrir o
procedimento e **apaga** a reunião quando o procedimento é encerrado. Marque os
escopos que dão essas duas permissões, na visão de administrador:

| Precisa de | Nome clássico | Nome granular (contas mais novas) |
|---|---|---|
| Criar reunião | `meeting:write:admin` | `meeting:write:meeting:admin` |
| Apagar reunião | `meeting:write:admin` | `meeting:delete:meeting:admin` |
| Ler reunião | `meeting:read:admin` | `meeting:read:meeting:admin` |

A Zoom migrou para os nomes granulares; sua conta vai mostrar um formato ou o
outro. Se aparecer só o granular, marque os três da coluna da direita.

**Não conceda mais do que isso.** O app não precisa de usuários, gravações,
relatórios nem webinars.

## 6. Ativar

Aba **Activation** → **Activate your app**.

Sem ativar, as credenciais existem mas a API responde erro de autorização.

## 7. Colocar no sistema

No EasyPanel, no serviço da aplicação, aba de variáveis de ambiente:

```
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
```

Salve e faça o **redeploy**. As três também estão em `.env.example`.

## 8. Conferir que funcionou

- [ ] Abra um procedimento **de teste**, com modalidade Videoconferência.
- [ ] Na linha do tempo dele deve aparecer:
      *"Sala da videoconferência agendada no Zoom (reunião ...)"*.
- [ ] Emita a Carta-Convite ao Interessado Solicitante e confira que o PDF traz
      link, ID e senha — e não mais "a ser informado".
- [ ] Encerre o procedimento de teste e confira que a reunião sumiu da agenda
      do Zoom.

Se der errado, a linha do tempo mostra o aviso de que os dados precisam ser
informados por fora, e o log do container traz o motivo em `[zoom]`.

---

## Quem fica sendo o anfitrião

As reuniões nascem sob o usuário dono das credenciais — na prática, o
proprietário da conta Zoom. Todas as sessões da câmara aparecem na agenda dele.

Se o cliente preferir que cada sessão nasça sob o conciliador que vai conduzir,
é uma alteração pequena no sistema, mas precisa de decisão dele: hoje o
conciliador é opcional no procedimento, e nem todo ato tem um vinculado.

## Se a câmara não quiser integrar agora

O sistema funciona sem essas variáveis, exatamente como antes: os campos de
link, ID e senha ficam vazios e a Carta-Convite sai dizendo "a ser informado".
Nada trava.
