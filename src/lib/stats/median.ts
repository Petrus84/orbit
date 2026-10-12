/**
 * Mediana de uma lista de números. Ignora não-finitos (NaN/±Infinity) e
 * devolve `null` para lista vazia — ausência nunca vira 0.
 * Módulo puro (sem supabase) para poder ser testado com node:test.
 */
export function medianOf(values: readonly number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
