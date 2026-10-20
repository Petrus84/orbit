/**
 * Limite superior EXCLUSIVO de período para colunas timestamptz
 * (ex.: ig_posts.published_at).
 *
 * O header entrega datas 'YYYY-MM-DD'. `.lte("published_at", "2026-10-18")`
 * compara com 2026-10-18T00:00:00 e descarta o último dia inteiro do período.
 * O correto é `.lt("published_at", periodUpperExclusive(end))`, que cobre o
 * dia final até 23:59:59.999 (UTC, mesma base do `toISODate` do hook).
 *
 * Valores que não sejam 'YYYY-MM-DD' (timestamp completo, inválido) voltam
 * intactos: quem já mandou um instante exato sabe o que quer.
 */
export function periodUpperExclusive(end: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return end;
  const t = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(t)) return end;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}
