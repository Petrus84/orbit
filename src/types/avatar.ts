// ─── Avatar Alignment — CP Import Store ──────────────────────────────────────
// Types for the Avatar Alignment screen of the ORBIT Dashboard

// ─── Literal Union Types ───────────────────────────────────────────────────────

export type AlignmentStatus = 'critical' | 'warning' | 'healthy';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

// ─── Generic Async State ───────────────────────────────────────────────────────

export type AsyncState<T> = {
  data: T;
  status: FetchStatus;
  error: string | null;
};

// ─── Domain Interfaces ────────────────────────────────────────────────────────

/** Gender split as percentages (0–100). Must sum to 100. */
export interface GenderSplit {
  male: number;
  female: number;
}

/**
 * A single audience profile — used for both "expected" and "real" sides
 * of the alignment comparison.
 */
export interface AvatarProfile {
  gender: GenderSplit;
  /** Age range label — e.g. '25–34', '18–24' */
  ageRange: string;
  /** Primary interest category — e.g. 'Moda', 'Tecnologia' */
  interest: string;
  /** Primary geographic region — e.g. 'São Paulo', 'Sul do Brasil' */
  geo: string;
}

/**
 * A single horizontal alignment bar shown on screen.
 * Compares the expected value vs the real observed value.
 */
export interface AlignmentBar {
  /** Display label — e.g. 'Gênero', 'Faixa Etária', 'Interesse', 'Localização' */
  label: string;
  /** Expected audience value (0–100 for numeric; label for categorical) */
  expected: number;
  /** Real observed value (0–100 for numeric; label for categorical) */
  real: number;
  /**
   * Absolute variance = |real − expected|.
   * For categorical dimensions this is a binary 0 (match) or 100 (mismatch).
   */
  variance: number;
  status: AlignmentStatus;
}

/**
 * Full alignment data for one client — the top-level shape returned by the
 * repository and consumed by the hook.
 */
export interface AvatarAlignment {
  expected: AvatarProfile;
  real: AvatarProfile;
  /** Overall alignment score 0–100 */
  score: number;
  status: AlignmentStatus;
  /** Pre-computed bars ready to render */
  bars: AlignmentBar[];
  /** Human-readable recommendation generated from the score */
  recommendation: string;
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

export const ALIGNMENT_STATUS_LABEL: Record<AlignmentStatus, string> = {
  healthy: 'Saudável',
  warning: 'Atenção',
  critical: 'Crítico',
};

/** Thresholds used consistently across repository and UI */
export const ALIGNMENT_THRESHOLDS = {
  /** Score below this → critical */
  critical: 50,
  /** Score below this (but ≥ critical) → warning */
  warning: 75,
} as const;
