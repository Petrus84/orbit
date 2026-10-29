import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@/types/database.types";
import { avatarAlignmentRowSchema } from "./avatarAlignment.schema";
import { mapAvatarAlignmentViewRowToContract } from "./avatarAlignment.mapper";

type AvatarAlignmentViewRow =
  Database["orbit"]["Views"]["v_avatar_alignment"]["Row"];

const viewRow: AvatarAlignmentViewRow = {
  id: "alignment-id",
  client_id: "client-id",
  handle: "orbit",
  name: "Orbit",
  expected_gender_male: null,
  expected_gender_female: null,
  expected_age_range: null,
  expected_interest: null,
  expected_geo: null,
  expected_geo_pct: null,
  real_gender_male: null,
  real_gender_female: null,
  real_age_range: null,
  real_interest: null,
  real_geo: null,
  real_geo_pct: null,
  alignment_score: null,
  alignment_status: null,
};

test("avatar alignment mapper preserves null metrics as unavailable", () => {
  const mapped = mapAvatarAlignmentViewRowToContract(viewRow);

  assert.equal(mapped.expected_gender_male, null);
  assert.equal(mapped.expected_gender_female, null);
  assert.equal(mapped.expected_geo_pct, null);
  assert.equal(mapped.real_gender_male, null);
  assert.equal(mapped.real_gender_female, null);
  assert.equal(mapped.real_geo_pct, null);
  assert.equal(mapped.alignment_score, null);
  assert.equal(mapped.expected_age_range, "Indisponível");
  assert.equal(mapped.real_geo, "Indisponível");
  assert.doesNotThrow(() => avatarAlignmentRowSchema.parse(mapped));
});

test("avatar alignment mapper preserves explicit numeric zero", () => {
  const mapped = mapAvatarAlignmentViewRowToContract({
    ...viewRow,
    expected_gender_male: 0,
    real_gender_male: 0,
    alignment_score: 0,
  });

  assert.equal(mapped.expected_gender_male, 0);
  assert.equal(mapped.real_gender_male, 0);
  assert.equal(mapped.alignment_score, 0);
});
