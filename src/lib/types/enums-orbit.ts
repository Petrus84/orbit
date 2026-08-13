// Centralized enums/types aligned to DB (initial pass)

// Alert severity: DB contains 'info', 'warning', 'critical' and also 'success'
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success'

// Campaign objectives observed in DB and frontend usages
export type CampaignObjective =
  | 'awareness'
  | 'reach'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'app_promotion'
  | 'sales'
  | 'video_views'
  | 'conversion'
  | 'retargeting'
  | 'other'

// Placeholder / lightweight definitions for previously 'ghost' enums.
// These are intentionally permissive (string) for the first iteration;
// later passes should tighten them to literal unions using DB values.
export type AdsPlatform = string
export type AlertType = string
export type AssetStatus = string
export type ContentFormat = string
export type FatigueCause = string
export type GenderCategory = string
export type HealthStatus = string

// Export a small namespace for possible runtime constants if needed later
export const ENUM_NAME = 'enums-orbit'
