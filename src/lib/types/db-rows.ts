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
