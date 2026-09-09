/* =============================================================================
  ORBIT · Repository — Funil Interativo + Simulador
  Caminho: src/lib/repositories/funnelRepository.ts
  ============================================================================= */

import { supabase } from '@/lib/supabase'
import { buildFunnelInsight } from './contentContractEngine'
import type { FunnelMetrics , InsightData } from '@/types/orbit'
import type { AlertContractFields } from './contentContractEngine'

interface AccountSnapshotRow {
  reach_total: number | null
  profile_visits: number | null
  link_clicks: number | null
  period_start: string
  period_end: string
}

interface FunnelDataRow {
  id: string
  client_id: string
  alcance: number
  visitas: number
  cliques: number | null
  vendas: number | null
  ctr_bio: string | number
  taxa_conv: string | number
  period_start: string
  period_end: string
  created_at: string
}

function mapRowsToFunnelMetrics(rows: FunnelDataRow[]): FunnelMetrics {
  const alcance = rows.reduce((sum, r) => sum + (r.alcance ?? 0), 0)
  const visitas = rows.reduce((sum, r) => sum + (r.visitas ?? 0), 0)
  const cliques = rows.reduce((sum, r) => sum + (r.cliques ?? 0), 0)
  const vendas = rows.reduce((sum, r) => sum + (r.vendas ?? 0), 0)

  return {
    alcance,
    visitas,
    cliques,
    vendas,
    ctrBio: alcance > 0 ? (visitas / alcance) * 100 : 0,
    taxaConv: cliques > 0 ? (vendas / cliques) * 100 : 0,
  }
}

function toFiniteNumber(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0
}

function mapFunnelMetrics(
  accountSnapshot: AccountSnapshotRow | null,
  funnelRows: FunnelDataRow[]
): FunnelMetrics {
  const fallback = mapRowsToFunnelMetrics(funnelRows)
  const alcance = accountSnapshot
    ? accountSnapshot.reach_total == null
      ? fallback.alcance
      : toFiniteNumber(accountSnapshot.reach_total)
    : fallback.alcance
  const visitas = accountSnapshot
    ? accountSnapshot.profile_visits == null
      ? fallback.visitas
      : toFiniteNumber(accountSnapshot.profile_visits)
    : fallback.visitas
  const cliques = accountSnapshot
    ? accountSnapshot.link_clicks == null
      ? fallback.cliques
      : toFiniteNumber(accountSnapshot.link_clicks)
    : fallback.cliques
  const vendas = fallback.vendas

  return {
    alcance,
    visitas,
    cliques,
    vendas,
    ctrBio: alcance > 0 ? (visitas / alcance) * 100 : 0,
    taxaConv: cliques > 0 ? (vendas / cliques) * 100 : 0,
  }
}

function toISOString(date: Date | string): string {
  if (typeof date === 'string') return date
  return date.toISOString()
}

const EMPTY_FUNNEL_METRICS: FunnelMetrics = {
  alcance: 0,
  visitas: 0,
  cliques: 0,
  vendas: 0,
  ctrBio: 0,
  taxaConv: 0,
}

// ============================================================================
// FUNÇÃO PRINCIPAL: Busca dados reais + integra ContentContractEngine
// ============================================================================

export async function fetchFunnelData(
  clientId: string,
  periodStart: Date | string,
  periodEnd: Date | string
): Promise<{
  metrics: FunnelMetrics
  insight: InsightData & AlertContractFields
}> {
  const start = toISOString(periodStart)
  const end = toISOString(periodEnd)

  const [accountResult, funnelResult] = await Promise.all([
    supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .select('reach_total, profile_visits, link_clicks, period_start, period_end')
      .eq('client_id', clientId)
      .lte('period_start', end)
      .gte('period_end', start)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema('orbit')
      .from('funnel_data')
      .select('id, client_id, alcance, visitas, cliques, vendas, ctr_bio, taxa_conv, period_start, period_end, created_at')
      .eq('client_id', clientId)
      .lte('period_start', end)
      .gte('period_end', start)
      .order('period_end', { ascending: false }),
  ])

  if (accountResult.error) {
    throw accountResult.error
  }

  if (funnelResult.error) {
    throw funnelResult.error
  }

  const accountSnapshot = accountResult.data as AccountSnapshotRow | null
  const funnelRows = (funnelResult.data ?? []) as FunnelDataRow[]

  if (!accountSnapshot && funnelRows.length === 0) {
    const insight = buildFunnelInsight({
      reach: EMPTY_FUNNEL_METRICS.alcance,
      ctrBio: EMPTY_FUNNEL_METRICS.ctrBio,
      dataSource: 'empty_database',
    })
    return { metrics: EMPTY_FUNNEL_METRICS, insight }
  }

  const metrics = mapFunnelMetrics(accountSnapshot, funnelRows)
  const insight = buildFunnelInsight({
    reach: metrics.alcance,
    ctrBio: metrics.ctrBio,
    dataSource: 'real_snapshot',
  })
  return { metrics, insight }
}

// ============================================================================
// FIM — cálculo de simulação vive em src/lib/funnelMath.ts (runFunnelSimulation)
// ============================================================================