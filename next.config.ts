import type { NextConfig } from "next";

const cabecalhosDeSeguranca = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // exigido pelo Dockerfile usado no EasyPanel
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
  experimental: {
    // O padrão do Next é 1 MB por requisição de Server Action — bem abaixo do
    // limite de 50 MB que o próprio sistema anuncia para anexo de documento
    // (src/lib/mime.ts). Documento escaneado de verdade passa de 1 MB fácil;
    // sem isto, o Next recusa o upload ANTES de chegar em `anexarDocumento`,
    // e o operador só via a tela de erro genérica — relatado em 29/09.
    //
    // 60 MB, e não 50: um arquivo bem no limite de negócio não pode colidir
    // com o limite do framework antes da checagem de negócio rodar — sem
    // folga de verdade, quem manda um arquivo perto do limite volta a ver a
    // tela de erro genérica em vez do aviso "passa de 50 MB". Os dois limites
    // abaixo SEMPRE ficam acima do limite de negócio em src/lib/mime.ts,
    // nunca abaixo, com folga de pelo menos 10 MB.
    serverActions: {
      bodySizeLimit: "60mb",
    },
    // Existe `src/middleware.ts` casando com quase toda rota (proteção de
    // acesso), e o Next SEMPRE buffera o corpo da requisição para o
    // middleware poder lê-lo — truncado em 10 MB por padrão, mesmo que o
    // middleware não olhe o corpo. Acima disso o multipart chega cortado e
    // quebra com "Unexpected end of form", faça o que fizer o bodySizeLimit
    // acima. É o mesmo bug do anexo, só que para arquivo maior.
    middlewareClientMaxBodySize: "60mb",
  },
};

export default config;
