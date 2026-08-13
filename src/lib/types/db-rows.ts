// DB-aligned row types generated from schema SQL files (iterative additions)

export interface AdsMetricsRow {
  id: string
  client_id: string
  ad_id: string
  week_index: number
  week_start: string
  ctr?: number | null
  cpa?: number | null
  frequency?: number | null
  fatigue_pct?: number | null
  diagnosis?: unknown
  created_at?: string
}

export interface DomainEventRow {
  id: string
  client_id: string
  event_type: string
  previous_state?: unknown | null
  new_state?: unknown | null
  triggered_at: string
  webhook_sent: boolean
  webhook_url?: string | null
  webhook_response?: unknown | null
  created_at?: string
}

export interface OAuthTokenRow {
  id: string
  agency_id: string
  provider: 'meta' | 'google'
  access_token: string
  token_type: string
  expires_at: string
  scope?: string | null
  meta_user_id?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface MetricHistoryRow {
  id?: string
  client_id: string
  metric_name: string
  metric_value: number
  metric_date: string
  platform: string
  created_at?: string
}

export interface BenchmarkHistoryRow {
  id: string
  client_id: string
  metric_name: string
  benchmark_value: number
  source_level: string
  input_by: string
  input_reason?: string | null
  valid_from: string
  valid_until?: string | null
  created_at?: string
}

export interface AlertConfigRow {
  id: string
  client_id: string
  ctr_threshold_meta: number
  ctr_threshold_google: number
  cpa_multiplier: number
  freq_threshold: number
  alert_email?: string | null
  alert_slack_webhook?: string | null
  updated_at?: string
}
