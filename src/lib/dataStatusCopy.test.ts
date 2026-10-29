import { describe, expect, it } from "vitest";
import { buildDataStatusNotices, type ClientDataFacts } from "./dataStatusCopy";

const facts: ClientDataFacts = {
  postsTotal: 10,
  postsFirst: "2026-01-01",
  postsLast: "2026-10-01",
  postsInPeriod: 8,
  postsEstimated: 0,
  postsL2Excluded: 2,
  snapshotCount: 1,
  latestSnapshotReach: 100,
  latestSnapshotImpressions: 200,
};

describe("buildDataStatusNotices", () => {
  it("reports the count of L2 posts excluded in the selected period", () => {
    expect(buildDataStatusNotices(facts)).toContainEqual({
      id: "posts_l2_excluidos",
      text: "2 posts com confiança L2 foram excluídos dos indicadores por post no período selecionado.",
    });
  });

  it("does not report L2 exclusions when their count is zero", () => {
    expect(
      buildDataStatusNotices({ ...facts, postsL2Excluded: 0 }),
    ).not.toContainEqual(expect.objectContaining({ id: "posts_l2_excluidos" }));
  });

  it("does not treat a missing snapshot reach value as zero", () => {
    expect(
      buildDataStatusNotices({ ...facts, latestSnapshotReach: null }),
    ).not.toContainEqual(
      expect.objectContaining({ id: "snapshot_sem_alcance" }),
    );
  });

  it("uses singular agreement for one excluded post", () => {
    expect(
      buildDataStatusNotices({ ...facts, postsL2Excluded: 1 }),
    ).toContainEqual({
      id: "posts_l2_excluidos",
      text: "1 post com confiança L2 foi excluído dos indicadores por post no período selecionado.",
    });
  });
});
