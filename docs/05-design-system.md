# Design system — Consensus One

> Paleta e ativos extraídos do **papel timbrado oficial** fornecido pelo cliente
> em 14/08/2026. Arquivos em `assets/marca/`.

## Identidade

**Nome completo:** Consensus One — Câmara Privada de Composição Estratégica Consensual
**Assinatura de marca:** *Duas posições. Uma solução.*

A marca é **preta e dourada**, com o "ONE" em prata. Não é uma marca azul, não é
moderna-tech: é sóbria, clássica e institucional. A interface tem que acompanhar.

## Cores

```css
/* preto institucional — base da marca */
--preto-900:  #0A0A0A;   /* cabeçalho de documento, barra lateral, rodapé */
--grafite-700:#1A1C1F;   /* botões primários */
--grafite-500:#33373D;   /* hover */

/* dourado — o acento da marca */
--dourado-600:#946810;   /* dourado escuro: texto e traços sobre fundo claro */
--dourado-400:#CC9933;   /* dourado vivo: acento sobre fundo escuro */
--dourado-100:#F8F1E2;

/* prata — do "ONE" do logotipo */
--prata-400:  #D1D1D1;

/* neutros */
--carvao-700:#2B2B2B;  /* texto principal */
--carvao-500:#5A5A5A;  /* texto secundário */
--carvao-300:#A6A6A6;  /* placeholder */
--carvao-100:#E4E1DA;  /* bordas */
--fundo:     #F7F6F3;  /* fundo da aplicação, levemente quente */
--superficie:#FFFFFF;

/* semânticos */
--sucesso:#2F6B4F;  --sucesso-bg:#E9F1EC;
--atencao:#946810;  --atencao-bg:#FAF2E1;   /* atenção usa o próprio dourado */
--erro:   #8E2A2A;  --erro-bg:#F9EBEB;
```

**Regra do dourado:** ele marca o que é institucional — o filete do documento, o
selo, a etapa ativa, o item de menu selecionado. Botão dourado vira loja. Ação
primária é grafite; o dourado acompanha, não lidera.

**Logotipo sobre fundo escuro:** os arquivos vêm com fundo preto chapado. Use
`mix-blend-mode: lighten` para o fundo desaparecer sobre superfícies escuras.

## Tipografia

- Interface: **Inter**
- Documentos gerados (carta convite, ata, termo): **serifada** — o timbrado do
  cliente é serifado e formal
- Códigos de verificação e números de procedimento: monoespaçada

## Ativos disponíveis

| Arquivo | Uso |
|---|---|
| `assets/marca/logo-consensus-one.png` | Logotipo horizontal, fundo escuro |
| `assets/marca/selo-dourado.png` | Selo circular com a assinatura de marca |
| `assets/marca/marca-dagua.png` | Selo em branco, para marca d'água de documento |
| `assets/marca/papel-timbrado-original.docx` | **Timbrado oficial — base dos PDFs** |

## O timbrado já define o layout dos documentos

O papel timbrado do cliente não é só decoração: ele **já resolve** o cabeçalho e
o rodapé de todos os documentos que o sistema vai emitir.

**Cabeçalho** — faixa preta com o logotipo centralizado e filete dourado embaixo.

**Rodapé, em duas faixas:**

1. Faixa clara com endereço, telefone, e-mail, site e — do lado direito — o
   bloco **"AUTENTICADOR DE DOCUMENTO"**, com QR Code e a instrução
   *"Escaneie o QR Code ou acesse: consensusone.com.br/verificar"*
2. Faixa preta com o selo dourado e o texto:
   *"Documento emitido pela Consensus One — Câmara Privada de Composição
   Estratégica Consensual. Este documento possui validade exclusivamente através
   de verificação do código e QR Code acima."*

Ou seja: **a autenticação por QR Code já é parte da identidade visual dele.**
O sistema não está inventando nada — está automatizando o que o timbrado já promete.

## Dados institucionais para os documentos

```
Rua Olegário Paiva, nº 180, 4º andar, Sala 411
Centro — Mogi das Cruzes/SP — CEP 08.780-040
Telefone: (11) 2668-8788
E-mail:   contato@consensusone.com.br
Site:     consensusone.com.br
Instagram: @one.consensus
Verificação: consensusone.com.br/verificar
```

## Responsividade

- Corte em 768px
- Abaixo disso, tabela vira lista de cartões; nunca rolagem horizontal
- Área de toque mínima de 44px
- Testar em 375px antes de dar qualquer tela por pronta
