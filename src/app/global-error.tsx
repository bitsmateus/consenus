"use client";

/**
 * Último recurso: falha no próprio layout raiz, onde o limite de erro das
 * telas internas já não alcança. Substitui o documento inteiro, então precisa
 * trazer <html> e <body> e não pode depender de nada da aplicação.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F6F3",
          color: "#2B2B2B",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>O sistema não conseguiu carregar</h1>
          <p style={{ fontSize: 14, color: "#5A5A5A" }}>
            Recarregue a página. Se continuar, avise o suporte com o código abaixo.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#5A5A5A" }}>{error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "10px 16px",
              borderRadius: 6,
              border: 0,
              background: "#1A1C1F",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
