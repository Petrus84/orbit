/**
 * Referência de comentários e alcance (run orbit_comments_v2, nao_verificado).
 * Valor do cliente = mediana por post, na mesma unidade da régua:
 *   resposta_da_base   = (likes + comments) / seguidores_atuais * 100
 *   views_por_seguidor = reel_views / seguidores_atuais * 100
 * Seguidores atuais (L2, não contemporâneo). A régua exclui contas < 1000
 * seguidores; abaixo disso a comparação não se aplica e devolve null.
 * n < 5 posts => null. Ausência nunca vira 0.
 */
import { medianOf } from "./median";

export interface RefPost {
  likes: number | null;
  comments: number | null;
  views: number | null;
}

const N_MIN = 5;
const MIN_FOLLOWERS = 1000;

const validFollowers = (f: number | null): f is number =>
  f != null && Number.isFinite(f) && f >= MIN_FOLLOWERS;

export function respostaDaBaseMedian(
  posts: readonly RefPost[],
  followers: number | null,
): number | null {
  if (!validFollowers(followers)) return null;
  const ratios: number[] = [];
  for (const p of posts) {
    if (p.likes == null || p.comments == null) continue;
    ratios.push(((p.likes + p.comments) / followers) * 100);
  }
  return ratios.length < N_MIN ? null : medianOf(ratios);
}

export function viewsPorSeguidorMedian(
  posts: readonly RefPost[],
  followers: number | null,
): number | null {
  if (!validFollowers(followers)) return null;
  const ratios: number[] = [];
  for (const p of posts) {
    if (p.views == null || p.views < 0) continue;
    ratios.push((p.views / followers) * 100);
  }
  return ratios.length < N_MIN ? null : medianOf(ratios);
}

export interface PercentileRef {
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

/** Posição descritiva na régua (percentis globais). Sem cor, sem veredito. */
export function percentilePosition(
  value: number | null,
  ref: PercentileRef,
): string | null {
  if (value == null || ref.p25 == null || ref.p50 == null || ref.p75 == null)
    return null;
  if (value < ref.p25) return "Abaixo do P25 da referência";
  if (value < ref.p50) return "Entre o P25 e a mediana da referência";
  if (value < ref.p75) return "Entre a mediana e o P75 da referência";
  return "Acima do P75 da referência";
}
