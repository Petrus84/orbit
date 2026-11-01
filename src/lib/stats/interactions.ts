import { medianOf } from "@/lib/stats/median";

/**
 * "Interações" por formato (RWP-5): likes + comments + shares + saves.
 * Regras (ausência nunca vira 0):
 *   - o post só entra se os QUATRO campos existem; qualquer null = post sem
 *     dado, fora da soma, da mediana e de `knownPosts`;
 *   - formato sem nenhum post completo => interactions e interactionsMedian = null;
 *   - `interactionsMedian` é a MEDIANA das interações por post (SSOT R8/§9):
 *     a média some a diferença entre um post viral e o típico.
 * Módulo puro (sem supabase) para poder ser testado.
 */
export interface InteractionPostRow {
  content_format: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export interface FormatInteractions {
  interactions: number | null;
  interactionsMedian: number | null;
  knownPosts: number;
  totalPosts: number;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function summarizeInteractionsByFormat(
  rows: readonly InteractionPostRow[],
  labelOf: (contentFormat: string) => string,
): Map<string, FormatInteractions> {
  const perPost = new Map<string, number[]>();
  const totals = new Map<string, number>();

  for (const row of rows) {
    const label = labelOf(row.content_format);
    totals.set(label, (totals.get(label) ?? 0) + 1);
    if (
      isNum(row.likes) &&
      isNum(row.comments) &&
      isNum(row.shares) &&
      isNum(row.saves)
    ) {
      const list = perPost.get(label) ?? [];
      list.push(row.likes + row.comments + row.shares + row.saves);
      perPost.set(label, list);
    }
  }

  const out = new Map<string, FormatInteractions>();
  for (const [label, totalPosts] of totals) {
    const list = perPost.get(label) ?? [];
    out.set(label, {
      interactions: list.length > 0 ? list.reduce((s, v) => s + v, 0) : null,
      interactionsMedian: medianOf(list),
      knownPosts: list.length,
      totalPosts,
    });
  }
  return out;
}
