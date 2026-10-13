/**
 * SSC-1 (decisions.md 2026-10-13).
 * Mediana por post de (comments/likes * 100) no header.
 * likes > 0 e comments nao nulo. n < 5 retorna null.
 * Snapshot e soma ponderada nao sao o oraculo. 20% recusado.
 */
import { medianOf } from "./median";

export interface PolemicPost {
  comments: number | null;
  likes: number | null;
}

const N_MIN = 5;

export function polemicMedianOfPeriod(
  posts: readonly PolemicPost[],
): number | null {
  const ratios: number[] = [];
  for (const p of posts) {
    if (p.likes == null || p.likes <= 0) continue;
    if (p.comments == null) continue;
    ratios.push((p.comments / p.likes) * 100);
  }
  if (ratios.length < N_MIN) return null;
  return medianOf(ratios);
}
