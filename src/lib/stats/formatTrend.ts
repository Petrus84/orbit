import { medianOf } from "./median";

/**
 * Tendência por formato derivada das INTERAÇÕES dos posts (não da nota de
 * utilidade da legenda).
 *
 * Definição (contracts: decisão VAL-7):
 *   interação do post = curtidas + comentários — os dois campos que o L0/L1
 *   sempre traz. Se qualquer um é nulo, o post fica fora (nunca vira 0).
 *   Posts com dado, em ordem cronológica, são divididos em duas metades de
 *   mesmo tamanho (com número ímpar, o post do meio sai). A tendência compara a
 *   MEDIANA da metade recente com a da metade antiga (mediana, como a polêmica:
 *   um post viral não decide a seta).
 *   A seta só muda quando a diferença passa de 15% (estrito).
 *
 * Módulo puro (sem supabase), testável com node:test.
 */

/** RN-15: menos de 5 posts no formato = amostra insuficiente. */
export const TREND_MIN_POSTS = 5;
/**
 * Posts com dado exigidos em cada metade. 3 (e não 2): com 2 posts a mediana
 * é a média e um único post viral decide a seta; com 3 a mediana o ignora.
 */
export const TREND_MIN_PER_HALF = 3;
/** A seta muda quando |variação| passa de 15%. */
export const TREND_THRESHOLD = 0.15;

export interface TrendPost {
  publishedAt: string;
  likes: number | null;
  comments: number | null;
}

export type TrendDirection = "subindo" | "caindo" | "estavel";

export type FormatTrend =
  | { status: "insufficient_sample"; posts: number }
  | { status: "no_data"; postsWithData: number }
  | {
      status: "ok";
      direction: TrendDirection;
      /** Variação relativa (ex.: 0.25 = +25%). null quando a base antiga é 0. */
      change: number | null;
      olderMedian: number;
      newerMedian: number;
      postsWithData: number;
    };

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function computeFormatTrend(posts: readonly TrendPost[]): FormatTrend {
  if (posts.length < TREND_MIN_POSTS) {
    return { status: "insufficient_sample", posts: posts.length };
  }

  const withData = posts
    .flatMap((p) => {
      const ts = Date.parse(p.publishedAt);
      if (!Number.isFinite(ts) || !isNum(p.likes) || !isNum(p.comments)) {
        return [];
      }
      return [{ ts, interactions: p.likes + p.comments }];
    })
    .sort((a, b) => a.ts - b.ts);

  const half = Math.floor(withData.length / 2);
  if (half < TREND_MIN_PER_HALF) {
    return { status: "no_data", postsWithData: withData.length };
  }

  const older = withData.slice(0, half).map((p) => p.interactions);
  const newer = withData
    .slice(withData.length - half)
    .map((p) => p.interactions);
  const olderMedian = medianOf(older) as number;
  const newerMedian = medianOf(newer) as number;

  let change: number | null;
  let direction: TrendDirection;
  if (olderMedian === 0) {
    change = null;
    direction = newerMedian > 0 ? "subindo" : "estavel";
  } else {
    change = (newerMedian - olderMedian) / olderMedian;
    direction =
      change > TREND_THRESHOLD
        ? "subindo"
        : change < -TREND_THRESHOLD
          ? "caindo"
          : "estavel";
  }

  return {
    status: "ok",
    direction,
    change,
    olderMedian,
    newerMedian,
    postsWithData: withData.length,
  };
}

export type TrendColor = "cyan" | "red" | "gold" | "none";

/** Texto e cor da pílula. Ausência é nomeada (RN-22), nunca "N/A" nem 0. */
export function trendCopy(trend: FormatTrend): {
  label: string;
  color: TrendColor;
} {
  switch (trend.status) {
    case "insufficient_sample":
      return {
        label: `Tendência com ${TREND_MIN_POSTS} posts; hoje são ${trend.posts}`,
        color: "gold",
      };
    case "no_data":
      return {
        label: "Tendência: faltam curtidas e comentários em posts suficientes",
        color: "none",
      };
    case "ok": {
      const pct =
        trend.change === null
          ? ""
          : ` (${trend.change > 0 ? "+" : trend.change < 0 ? "−" : ""}${Math.round(Math.abs(trend.change) * 100)}%)`;
      if (trend.direction === "subindo")
        return { label: `Subindo${pct}`, color: "cyan" };
      if (trend.direction === "caindo")
        return { label: `Caindo${pct}`, color: "red" };
      return { label: `Estável${pct}`, color: "none" };
    }
  }
}
