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
/** Mínimo de comentários com texto para Intenção (DEV-3). */
export const INTENT_MIN_COMMENTS = 30;

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

export interface PostsComComentario {
  withComment: number;
  valid: number;
  total: number;
  pct: number | null;
  state: "ok" | "insufficient" | "not_collected";
}

/**
 * RN-21: posts com comments > 0 ÷ posts válidos. comments nulo fica fora do
 * denominador (nunca vira zero). Mínimo de 5 posts válidos. Informativa: sem
 * cor, sem régua e sem Ação.
 */
export function postsComComentario(
  posts: readonly Pick<RefPost, "comments">[],
): PostsComComentario {
  let valid = 0;
  let withComment = 0;
  for (const p of posts) {
    if (p.comments == null || !Number.isFinite(p.comments)) continue;
    valid += 1;
    if (p.comments > 0) withComment += 1;
  }
  const total = posts.length;
  if (valid === 0 && total > 0)
    return { withComment, valid, total, pct: null, state: "not_collected" };
  if (valid < N_MIN)
    return { withComment, valid, total, pct: null, state: "insufficient" };
  return {
    withComment,
    valid,
    total,
    pct: (withComment / valid) * 100,
    state: "ok",
  };
}

/** Textos do contrato de tela (SSOT v1.5, Seção 9). Sem adjetivos de juízo. */
export function postsComComentarioText(r: PostsComComentario): {
  valueText: string;
  note: string;
} {
  if (r.state === "not_collected")
    return {
      valueText: "—",
      note: "Não calculado: sem contagem de comentários",
    };
  if (r.state === "insufficient")
    return {
      valueText: "—",
      note: `Amostra insuficiente: ${r.valid} de ${N_MIN} posts`,
    };
  const valueText = `${r.withComment} de ${r.valid}`;
  return {
    valueText,
    note:
      r.withComment === 0
        ? `0 de ${r.valid} posts têm comentário`
        : `${r.withComment} de ${r.valid} posts (${Math.round(r.pct as number)}%) têm comentário`,
  };
}

/** Texto de Intenção/Tom conforme o texto de comentários coletado (RN-22). */
export function commentTextStateNote(
  metric: "intencao_nos_comentarios" | "tom_dos_comentarios",
  textCount: number | null,
): string {
  if (textCount == null)
    return "Não calculado: contagem de comentários indisponível";
  if (textCount === 0)
    return "Não calculado: sem texto de comentários coletado";
  if (metric === "tom_dos_comentarios") return "Não liberado para cor ou Ação";
  if (textCount < INTENT_MIN_COMMENTS)
    return `Amostra insuficiente: ${textCount} de ${INTENT_MIN_COMMENTS} comentários`;
  return "Não calculado: sem classificação de intenção";
}

/** Motivo do "—" de resposta_da_base / views_por_seguidor (RN-22). */
export function refNullReason(
  posts: readonly RefPost[],
  followers: number | null,
  kind: "er" | "views",
): string {
  if (!validFollowers(followers))
    return "Não calculado: seguidores indisponíveis ou abaixo de 1.000";
  const n = posts.filter((p) =>
    kind === "er"
      ? p.likes != null && p.comments != null
      : p.views != null && p.views >= 0,
  ).length;
  return `Amostra insuficiente: ${n} de ${N_MIN} posts`;
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
