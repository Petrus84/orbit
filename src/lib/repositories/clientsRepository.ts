// ============================================================================
// ORBIT · Repository — Clients (v3.1.0)
//
// v3.1.0 (integração real da tela Carteira):
// - 🐛 CORRIGIDO: STATUS_ORDER, normalizeHealthStatus() e o parâmetro
//   healthStatus de toClient() estavam tipados como ClientHealthStatus, mas
//   o arquivo só importava ClientStatus (status de ASSINATURA, valores
//   active/inactive/paused — nada a ver com saúde). Isso não compilava:
//   os literais 'critical'/'warning'/'healthy'/'unknown' não pertencem a
//   ClientStatus. Trocado o import para ClientHealthStatus (o tipo certo,
//   agora exportado por types/client.ts) em toda a cadeia.
// - Confirmado contra dump_orbit.sql: orbit.v_client_health expõe
//   client_id/handle/avatar_name/metric_count/avg_quality_score/
//   health_status/last_updated/days_since_update/max_confidence_level;
//   este repositório só consome client_id + health_status, que batem.
// - Confirmado contra dump_orbit.sql: orbit.v_client_metrics expõe id
//   (não client_id) + name/handle/follower_balance/engagement_real/
//   ctr_link/polemic_score_pct/follower_churn_pct — bate exato com
//   ClientMetricsRow abaixo.
//
// v3.0.0 (revisão 14/08/2026, mantida):
// - v_client_health e v_client_metrics não têm, cada uma sozinha, todos os
//   campos que a tela precisa — v_client_metrics.health_status é a coluna
//   estática e deprecated de orbit.clients (nunca usar — R-03). O status
//   de saúde de verdade vem de v_client_health, calculado a partir de
//   metric_history. Por isso duas queries, mescladas por id/client_id.
// - Sem fallback para public.* (schema legado) — removido por decisão
//   explícita, mesmo padrão de alertsRepository.ts.
// - avatarUrl fica sempre undefined: orbit.clients não tem coluna de
//   avatar (confirmado no DDL real, dump_orbit.sql).
//
// Nota sobre os `?? 0` em toClient(): não é o mesmo anti-padrão de
// REGRA-11 (mascarar ausência de dado). ClientMetrics (orbit.ts) tipa os
// 5 campos como `number`, sem `| null` — o mapper não tem `null` como
// saída válida do contrato. O sinal real de "sem dado" fica em
// Client.status === 'unknown', não no valor da métrica; quem consome
// Client deve checar status, não comparar métrica a zero.
// ============================================================================

import { supabase } from '@/lib/supabase'
import type { Client, ClientHealthStatus } from '../../types/client'

// ── Raw shape from orbit.v_client_metrics ─────────────────────────────────
interface ClientMetricsRow {
  id: string
  name: string
  handle: string
  follower_balance: number | null
  engagement_real: number | null
  ctr_link: number | null
  polemic_score_pct: number | null
  follower_churn_pct: number | null
}

// ── Raw shape from orbit.v_client_health ──────────────────────────────────
interface ClientHealthRow {
  client_id: string
  health_status: 'healthy' | 'warning' | 'critical' | null // NULL quando metric_count=0 (sem dado nos últimos 30 dias)
}

const STATUS_ORDER: Record<ClientHealthStatus, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
  unknown: 3,
}

// v_client_health nunca emite o literal 'unknown' — mapeia o NULL (cliente
// sem métrica recente) para 'unknown', que é exatamente o 4º valor que o
// enum orbit.health_status já reserva para esse caso.
function normalizeHealthStatus(status: 'healthy' | 'warning' | 'critical' | null): ClientHealthStatus {
  return status ?? 'unknown'
}

function toClient(metrics: ClientMetricsRow, healthStatus: ClientHealthStatus): Client {
  return {
    id: metrics.id,
    handle: metrics.handle,
    name: metrics.name,
    avatar: undefined, // orbit.clients não tem coluna de avatar ainda
    status: healthStatus,
    metrics: {
      follower_balance: metrics.follower_balance ?? 0,
      engagement_real: metrics.engagement_real ?? 0,
      ctr_link: metrics.ctr_link ?? 0,
      polemic_score_pct: metrics.polemic_score_pct ?? 0,
      follower_churn_pct: metrics.follower_churn_pct ?? 0,
      // segment não está disponível em v_client_metrics — precisa de outra
      // fonte (provavelmente ig_account_snapshots direto). Preenchido com
      // valores neutros por enquanto; não fabricar dado demográfico aqui.
      segment: {
        gender_dominant: 'mixed',
        gender_pct: 0,
        age_range: '',
        top_city: '',
        top_city_pct: 0,
      },
    },
    lastUpdated: new Date().toISOString(),
  }
}

async function fetchHealthMap(): Promise<Map<string, ClientHealthStatus>> {
  const { data, error } = await supabase
    .from('v_client_health')
    .select('client_id, health_status')
    .returns<ClientHealthRow[]>()

  if (error) {
    throw new Error(`[clientsRepository] falha ao buscar orbit.v_client_health: ${error.message}`)
  }

  const map = new Map<string, ClientHealthStatus>()
  for (const row of data ?? []) {
    map.set(row.client_id, normalizeHealthStatus(row.health_status))
  }
  return map
}

// ── fetchClientsWithHealth ────────────────────────────────────────────────
export async function fetchClientsWithHealth(): Promise<Client[]> {
  const [{ data: metricsData, error: metricsError }, healthMap] = await Promise.all([
    supabase
      .from('v_client_metrics')
      .select('id, name, handle, follower_balance, engagement_real, ctr_link, polemic_score_pct, follower_churn_pct')
      .returns<ClientMetricsRow[]>(),
    fetchHealthMap(),
  ])

  if (metricsError) {
    throw new Error(`[clientsRepository] falha ao buscar orbit.v_client_metrics: ${metricsError.message}`)
  }

  return (metricsData ?? [])
    .map((row) => toClient(row, healthMap.get(row.id) ?? 'unknown'))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
}

// ── fetchClientById ───────────────────────────────────────────────────────
export async function fetchClientById(clientId: string): Promise<Client | null> {
  const [{ data: metricsData, error: metricsError }, healthMap] = await Promise.all([
    supabase
      .from('v_client_metrics')
      .select('id, name, handle, follower_balance, engagement_real, ctr_link, polemic_score_pct, follower_churn_pct')
      .eq('id', clientId)
      .returns<ClientMetricsRow[]>()
      .maybeSingle(),
    fetchHealthMap(),
  ])

  if (metricsError) {
    throw new Error(`[clientsRepository] falha ao buscar cliente ${clientId}: ${metricsError.message}`)
  }
  if (!metricsData) return null

  return toClient(metricsData as unknown as ClientMetricsRow, healthMap.get(clientId) ?? 'unknown')
}

// ── fetchCriticalClients ──────────────────────────────────────────────────
export async function fetchCriticalClients(): Promise<Client[]> {
  const all = await fetchClientsWithHealth()
  return all.filter((c) => c.status === 'critical')
}