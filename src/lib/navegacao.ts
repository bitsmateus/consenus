/**
 * Validação de destino de redirecionamento.
 *
 * Só caminho interno é aceito. "//evil.com" e "/\evil.com" começam com "/" mas
 * o navegador os trata como endereço externo, então a checagem não pode ser
 * apenas `startsWith("/")`.
 */

/** Caracteres de controle e quebra de linha não têm uso legítimo em caminho. */
function temCaractereDeControle(valor: string): boolean {
  for (const caractere of valor) {
    const codigo = caractere.codePointAt(0) ?? 0;
    if (codigo < 32 || codigo === 127) return true;
  }
  return false;
}

export function destinoSeguro(destino: string | undefined | null, padrao = "/painel"): string {
  if (!destino) return padrao;

  const limpo = destino.trim();
  if (!limpo.startsWith("/")) return padrao;
  // "/" só redireciona para o painel: mandar para lá encadearia mais um salto,
  // e cadeia de redirecionamento quebra a resposta da Server Action
  if (limpo === "/") return padrao;
  // protocolo-relativo ("//host") ou barra invertida ("/\host")
  if (/^\/[/\\]/.test(limpo)) return padrao;
  if (temCaractereDeControle(limpo)) return padrao;

  return limpo;
}
