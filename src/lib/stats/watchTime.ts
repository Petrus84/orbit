/**
 * Tempo assistido por Reel (ORBIT · card "Tempo assistido por Reel").
 *
 * Fonte do dado: `ig_posts.reel_avg_watch_sec` (tempo médio de reprodução
 * informado pela Meta, em segundos inteiros) e `reel_duration_sec`.
 * Módulo puro, sem supabase: testável.
 *
 * Regras (SSOT R8, R9, R10):
 *  - nulo ≠ zero: Reel sem tempo médio fica FORA da conta. 0 s é medição real
 *    e continua entrando;
 *  - mediana por Reel, não média (um Reel viral não define o típico);
 *  - menos de 3 Reels com dado => `null` (sem dado, sem tela);
 *  - retenção = tempo médio ÷ duração: grandeza DERIVADA (não é métrica da
 *    Meta). Só entra Reel com duração > 0; Reel com tempo médio maior que a
 *    duração é inconsistente: fica fora da retenção e é contado;
 *  - faixa de amostra pelo SSOT (R8): 3–7 leve, ≥ 8 robusta.
 */
import { medianOf } from "@/lib/stats/median";
import { SAMPLE_MIN_LEVE, sampleBand } from "@/lib/stats/sampleBand";
import type { WatchTimeSummary } from "@/types/orbit";

export interface ReelWatchRow {
  reel_avg_watch_sec: unknown;
  reel_duration_sec: unknown;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

export interface ReelWatch {
  avgSec: number | null;
  durationSec: number | null;
  retentionPct: number | null;
}

/**
 * Tempo assistido de UM Reel (linha expandida do Desempenho por formato).
 * nulo ≠ zero; retenção só com duração > 0 e tempo médio <= duração.
 */
export function reelWatchOf(row: ReelWatchRow): ReelWatch {
  const avg = toFiniteNumber(row.reel_avg_watch_sec);
  const duration = toFiniteNumber(row.reel_duration_sec);
  const avgSec = avg !== null && avg >= 0 ? avg : null;
  const durationSec = duration !== null && duration > 0 ? duration : null;
  const retentionPct =
    avgSec !== null && durationSec !== null && avgSec <= durationSec
      ? (avgSec / durationSec) * 100
      : null;
  return { avgSec, durationSec, retentionPct };
}

export function summarizeWatchTime(
  rows: readonly ReelWatchRow[],
): WatchTimeSummary | null {
  const avgWatch: number[] = [];
  const retention: number[] = [];
  let inconsistentReels = 0;

  for (const row of rows) {
    const avg = toFiniteNumber(row.reel_avg_watch_sec);
    if (avg === null || avg < 0) continue;
    avgWatch.push(avg);

    const duration = toFiniteNumber(row.reel_duration_sec);
    if (duration === null || duration <= 0) continue;
    if (avg > duration) {
      inconsistentReels += 1;
      continue;
    }
    retention.push((avg / duration) * 100);
  }

  if (avgWatch.length < SAMPLE_MIN_LEVE) return null;
  const avgWatchMedianSec = medianOf(avgWatch);
  if (avgWatchMedianSec === null) return null;

  return {
    knownReels: avgWatch.length,
    avgWatchMedianSec,
    band: sampleBand(avgWatch.length),
    retentionKnownReels: retention.length,
    retentionMedianPct:
      retention.length >= SAMPLE_MIN_LEVE ? medianOf(retention) : null,
    retentionBand: sampleBand(retention.length),
    inconsistentReels,
  };
}
