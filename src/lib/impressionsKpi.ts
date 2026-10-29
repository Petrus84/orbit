import type { ConfidenceLevel } from "@/types/orbit";

export interface PostImpressionsRow {
  impressions: number | null;
  confidence_level: ConfidenceLevel;
}

export interface PostImpressionsAggregate {
  total: number | null;
  sourceLevel: ConfidenceLevel | undefined;
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
};

export function aggregatePostImpressions(
  rows: readonly PostImpressionsRow[],
): PostImpressionsAggregate {
  let total = 0;
  let rowsWithImpressions = 0;
  let sourceLevel: ConfidenceLevel | undefined;

  for (const row of rows) {
    if (
      row.impressions === null ||
      !Number.isFinite(row.impressions) ||
      row.impressions < 0
    ) {
      continue;
    }

    total += row.impressions;
    rowsWithImpressions += 1;
    if (
      sourceLevel === undefined ||
      CONFIDENCE_RANK[row.confidence_level] > CONFIDENCE_RANK[sourceLevel]
    ) {
      sourceLevel = row.confidence_level;
    }
  }

  return {
    total: rowsWithImpressions > 0 ? total : null,
    sourceLevel,
  };
}
