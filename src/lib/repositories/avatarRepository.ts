// ─── Avatar Repository ────────────────────────────────────────────────────────
// All Supabase queries and domain logic for the Avatar Alignment screen.
// Assumes src/lib/supabaseClient.ts exports a named `supabase` client.

import { supabase } from '../supabaseClient';
import type {
  AlignmentBar,
  AlignmentStatus,
  AvatarAlignment,
  AvatarProfile,
} from '../../types/avatar';
import { ALIGNMENT_THRESHOLDS } from '../../types/avatar';

// ─── Raw DB row shape (snake_case) ────────────────────────────────────────────

interface AvatarAlignmentRow {
  client_id: string;
  expected_gender_male: number;
  expected_gender_female: number;
  expected_age_range: string;
  expected_interest: string;
  expected_geo: string;
  real_gender_male: number;
  real_gender_female: number;
  real_age_range: string;
  real_interest: string;
  real_geo: string;
  alignment_score: number;
  alignment_status: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function scoreToStatus(score: number): AlignmentStatus {
  if (score < ALIGNMENT_THRESHOLDS.critical) return 'critical';
  if (score < ALIGNMENT_THRESHOLDS.warning) return 'warning';
  return 'healthy';
}

function varianceToStatus(variance: number): AlignmentStatus {
  if (variance >= 30) return 'critical';
  if (variance >= 15) return 'warning';
  return 'healthy';
}

/**
 * Categorical match: returns 0 variance when strings match (case-insensitive),
 * or 100 when they differ — mapped to a 0–100 scale for uniform bar rendering.
 */
function categoricalVariance(expected: string, real: string): number {
  return expected.trim().toLowerCase() === real.trim().toLowerCase() ? 0 : 100;
}

function buildRecommendation(score: number, bars: AlignmentBar[]): string {
  if (score >= ALIGNMENT_THRESHOLDS.warning) {
    return 'Seu público real está bem alinhado com o avatar esperado. Continue monitorando para manter a consistência.';
  }

  const criticalBars = bars.filter((b) => b.status === 'critical').map((b) => b.label);
  const warningBars = bars.filter((b) => b.status === 'warning').map((b) => b.label);

  const parts: string[] = [];

  if (criticalBars.length > 0) {
    parts.push(
      `Divergência crítica em: ${criticalBars.join(', ')}. Revise a segmentação das campanhas imediatamente.`,
    );
  }

  if (warningBars.length > 0) {
    parts.push(
      `Atenção para: ${warningBars.join(', ')}. Ajuste os critérios de público nas campanhas ativas.`,
    );
  }

  if (parts.length === 0) {
    return 'Alinhamento abaixo do esperado. Revise a segmentação e os criativos das campanhas ativas.';
  }

  return parts.join(' ');
}

function buildBars(row: AvatarAlignmentRow): AlignmentBar[] {
  const genderVariance = Math.abs(row.real_gender_male - row.expected_gender_male);
  const ageVariance = categoricalVariance(row.expected_age_range, row.real_age_range);
  const interestVariance = categoricalVariance(row.expected_interest, row.real_interest);
  const geoVariance = categoricalVariance(row.expected_geo, row.real_geo);

  const bars: AlignmentBar[] = [
    {
      label: 'Gênero (masculino %)',
      expected: row.expected_gender_male,
      real: row.real_gender_male,
      variance: genderVariance,
      status: varianceToStatus(genderVariance),
    },
    {
      label: 'Faixa Etária',
      expected: 100, // categorical: 100 = "expected category present"
      real: ageVariance === 0 ? 100 : 0,
      variance: ageVariance,
      status: varianceToStatus(ageVariance),
    },
    {
      label: 'Interesse',
      expected: 100,
      real: interestVariance === 0 ? 100 : 0,
      variance: interestVariance,
      status: varianceToStatus(interestVariance),
    },
    {
      label: 'Localização',
      expected: 100,
      real: geoVariance === 0 ? 100 : 0,
      variance: geoVariance,
      status: varianceToStatus(geoVariance),
    },
  ];

  return bars;
}

function rowToAvatarAlignment(row: AvatarAlignmentRow): AvatarAlignment {
  const expected: AvatarProfile = {
    gender: { male: row.expected_gender_male, female: row.expected_gender_female },
    ageRange: row.expected_age_range,
    interest: row.expected_interest,
    geo: row.expected_geo,
  };

  const real: AvatarProfile = {
    gender: { male: row.real_gender_male, female: row.real_gender_female },
    ageRange: row.real_age_range,
    interest: row.real_interest,
    geo: row.real_geo,
  };

  const score = row.alignment_score;
  // Trust DB status when present; derive locally as fallback
  const status: AlignmentStatus =
    (['critical', 'warning', 'healthy'] as AlignmentStatus[]).includes(
      row.alignment_status as AlignmentStatus,
    )
      ? (row.alignment_status as AlignmentStatus)
      : scoreToStatus(score);

  const bars = buildBars(row);
  const recommendation = buildRecommendation(score, bars);

  return { expected, real, score, status, bars, recommendation };
}

// ─── Exported Queries ─────────────────────────────────────────────────────────

/**
 * Fetches the full avatar alignment record for a client and derives all
 * display-ready data (bars, variance, recommendation).
 */
export async function fetchAvatarAlignment(clientId: string): Promise<AvatarAlignment> {
  const { data, error } = await supabase
    .from<'avatar_alignment', AvatarAlignmentRow>('avatar_alignment')
    .select(
      [
        'expected_gender_male',
        'expected_gender_female',
        'expected_age_range',
        'expected_interest',
        'expected_geo',
        'real_gender_male',
        'real_gender_female',
        'real_age_range',
        'real_interest',
        'real_geo',
        'alignment_score',
        'alignment_status',
      ].join(', '),
    )
    .eq('client_id', clientId)
    .single();

  if (error) {
    console.error('[avatarRepository] fetchAvatarAlignment error:', error.message);
    throw new Error(error.message);
  }

  return rowToAvatarAlignment(data);
}

/**
 * Convenience function — returns only the expected and real AvatarProfiles
 * without derived metrics. Useful for profile-only display components.
 */
export async function fetchAvatarProfile(
  clientId: string,
): Promise<{ expected: AvatarProfile; real: AvatarProfile }> {
  const alignment = await fetchAvatarAlignment(clientId);
  return { expected: alignment.expected, real: alignment.real };
}
