import { describe, expect, it } from "vitest";
import {
  reelWatchOf,
  summarizeWatchTime,
  type ReelWatchRow,
} from "./watchTime";

const row = (
  avg: number | null | string,
  duration: number | null,
): ReelWatchRow => ({ reel_avg_watch_sec: avg, reel_duration_sec: duration });

// Os 18 Reels do cpimportstore (banco, 31/10/2026): [duração, tempo médio].
const CP_IMPORT: Array<[number, number]> = [
  [59, 7],
  [12, 5],
  [12, 4],
  [23, 5],
  [17, 3],
  [21, 3],
  [9, 3],
  [12, 3],
  [12, 4],
  [15, 3],
  [29, 3],
  [26, 5],
  [17, 5],
  [24, 4],
  [16, 2],
  [11, 6],
  [15, 6],
  [20, 4],
];

describe("summarizeWatchTime", () => {
  it("cpimportstore: mediana 4 s, retenção ~20,9%, n=18 robusta", () => {
    const s = summarizeWatchTime(CP_IMPORT.map(([d, a]) => row(a, d)));
    expect(s).not.toBeNull();
    expect(s?.knownReels).toBe(18);
    expect(s?.avgWatchMedianSec).toBe(4);
    expect(s?.band).toBe("robusta");
    expect(s?.retentionKnownReels).toBe(18);
    expect(s?.retentionMedianPct).toBeCloseTo(20.87, 2);
    expect(s?.retentionBand).toBe("robusta");
    expect(s?.inconsistentReels).toBe(0);
  });

  it("menos de 3 Reels com dado => null (sem dado, sem tela)", () => {
    expect(summarizeWatchTime([])).toBeNull();
    expect(summarizeWatchTime([row(4, 12), row(5, 12)])).toBeNull();
  });

  it("nulo não é zero: Reel sem tempo médio fica fora da conta", () => {
    const s = summarizeWatchTime([
      row(4, 12),
      row(6, 12),
      row(8, 12),
      row(null, 12),
      row("", 12),
    ]);
    expect(s?.knownReels).toBe(3);
    expect(s?.avgWatchMedianSec).toBe(6);
    expect(s?.band).toBe("leve");
  });

  it("0 s é medição real e entra na conta", () => {
    const s = summarizeWatchTime([row(0, 10), row(0, 10), row(0, 10)]);
    expect(s?.knownReels).toBe(3);
    expect(s?.avgWatchMedianSec).toBe(0);
    expect(s?.retentionMedianPct).toBe(0);
  });

  it("sem duração: entra no tempo médio, fica fora da retenção", () => {
    const s = summarizeWatchTime([
      row(4, null),
      row(5, 0),
      row(6, null),
      row(3, 12),
    ]);
    expect(s?.knownReels).toBe(4);
    expect(s?.retentionKnownReels).toBe(1);
    expect(s?.retentionMedianPct).toBeNull(); // 1 Reel < 3: sem retenção
  });

  it("tempo médio maior que a duração é inconsistente: fora da retenção, contado", () => {
    const s = summarizeWatchTime([
      row(4, 12),
      row(5, 12),
      row(6, 12),
      row(30, 12),
    ]);
    expect(s?.knownReels).toBe(4);
    expect(s?.retentionKnownReels).toBe(3);
    expect(s?.inconsistentReels).toBe(1);
  });

  it("numeric vindo como string é lido; lixo é ignorado", () => {
    const s = summarizeWatchTime([
      row("4.00", 12),
      row("5.00", 12),
      row("6.00", 12),
      row("abc", 12),
    ]);
    expect(s?.knownReels).toBe(3);
    expect(s?.avgWatchMedianSec).toBe(5);
  });
});

describe("reelWatchOf (um Reel)", () => {
  it("tempo médio, duração e retenção", () => {
    expect(
      reelWatchOf({ reel_avg_watch_sec: 4, reel_duration_sec: 16 }),
    ).toEqual({ avgSec: 4, durationSec: 16, retentionPct: 25 });
  });
  it("sem tempo médio => tudo nulo, nunca 0", () => {
    expect(
      reelWatchOf({ reel_avg_watch_sec: null, reel_duration_sec: 16 }),
    ).toEqual({ avgSec: null, durationSec: 16, retentionPct: null });
  });
  it("0 s é medição real", () => {
    expect(
      reelWatchOf({ reel_avg_watch_sec: 0, reel_duration_sec: 10 }).avgSec,
    ).toBe(0);
  });
  it("sem duração ou tempo médio acima da duração: sem retenção", () => {
    expect(
      reelWatchOf({ reel_avg_watch_sec: 4, reel_duration_sec: null })
        .retentionPct,
    ).toBeNull();
    expect(
      reelWatchOf({ reel_avg_watch_sec: 12, reel_duration_sec: 10 })
        .retentionPct,
    ).toBeNull();
  });
});
