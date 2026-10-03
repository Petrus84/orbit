/* =============================================================================
  ORBIT · Repository — Funil Interativo + Simulador
  Caminho: src/lib/repositories/funnelRepository.ts
  ============================================================================= */

import { supabase } from '@/lib/supabase'
import { buildFunnelInsight } from './contentContractEngine'
import type { FunnelMetrics, InsightData, SetorBenchmark } from '@/types/funnel'
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
  period_start: string
  period_end: string
  created_at: string
}

// ✅ CORRIGIDO 09/09 (TICKETS item 5) — ctr_bio/taxa_conv eram buscadas do
// banco e descartadas (tudo era recalculado do zero). Decisão: banco não é
// fonte de verdade pra essas 2 colunas, então pararam de ser selecionadas
// na query também (ver .select() abaixo) — evita payload morto e deixa
// explícito que o cálculo é sempre local.

function mapRowsToFunnelMetrics(rows: FunnelDataRow[]): FunnelMetrics {
  const hasRows = rows.length > 0
  const alcance = rows.reduce((sum, r) => sum + (r.alcance ?? 0), 0)
  const visitas = rows.reduce((sum, r) => sum + (r.visitas ?? 0), 0)
  // ✅ TICKETS item 7 — null quando não há NENHUMA linha no período (sem
  // dado de verdade), número (inclusive 0) quando há linha(s).
  const cliques = hasRows ? rows.reduce((sum, r) => sum + (r.cliques ?? 0), 0) : null
  const vendas = hasRows ? rows.reduce((sum, r) => sum + (r.vendas ?? 0), 0) : null

  return {
    alcance,
    visitas,
    cliques,
    vendas,
    // ✅ TICKETS item 4 — nomes corretos (ver types/orbit.ts).
    profileVisitRate: alcance > 0 ? (visitas / alcance) * 100 : 0,
    linkCtrPct: visitas > 0 && cliques != null ? (cliques / visitas) * 100 : 0,
    taxaConv: cliques != null && cliques > 0 && vendas != null ? (vendas / cliques) * 100 : 0,
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
  // ✅ TICKETS item 7 — cliques só vira número quando accountSnapshot tem
  // link_clicks OU o fallback (funnel_data) tinha linha(s) de verdade;
  // caso contrário fica null ("sem dado"), não 0.
  const cliques =
    accountSnapshot && accountSnapshot.link_clicks != null
      ? toFiniteNumber(accountSnapshot.link_clicks)
      : fallback.cliques
  // vendas não tem fonte em ig_account_snapshots — vem só de funnel_data.
  const vendas = fallback.vendas

  return {
    alcance,
    visitas,
    cliques,
    vendas,
    profileVisitRate: alcance > 0 ? (visitas / alcance) * 100 : 0,
    linkCtrPct: visitas > 0 && cliques != null ? (cliques / visitas) * 100 : 0,
    taxaConv: cliques != null && cliques > 0 && vendas != null ? (vendas / cliques) * 100 : 0,
  }
}

function toISOString(date: Date | string): string {
  if (typeof date === 'string') return date
  return date.toISOString()
}

const EMPTY_FUNNEL_METRICS: FunnelMetrics = {
  alcance: 0,
  visitas: 0,
  cliques: null,
  vendas: null,
  profileVisitRate: 0,
  linkCtrPct: 0,
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
  // ✅ TICKETS item 8 — setor_benchmark de client_onboarding, pra
  // FunnelScreen parar de passar setor={null} fixo pro simulador.
  setor: SetorBenchmark | null
}> {
  const start = toISOString(periodStart)
  const end = toISOString(periodEnd)

  const [accountResult, funnelResult, onboardingResult] = await Promise.all([
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
      // ✅ TICKETS item 5 — ctr_bio/taxa_conv removidos do select: eram
      // buscados e nunca lidos (tudo recalculado localmente). Banco não é
      // fonte de verdade pra essas 2 colunas.
      .select('id, client_id, alcance, visitas, cliques, vendas, period_start, period_end, created_at')
      .eq('client_id', clientId)
      .lte('period_start', end)
      .gte('period_end', start)
      .order('period_end', { ascending: false }),
    supabase
      .schema('orbit')
      .from('client_onboarding')
      .select('setor_benchmark')
      .eq('client_id', clientId)
      .maybeSingle(),
  ])

  if (accountResult.error) {
    throw accountResult.error
  }

  if (funnelResult.error) {
    throw funnelResult.error
  }

  const accountSnapshot = accountResult.data as AccountSnapshotRow | null
  const funnelRows = (funnelResult.data ?? []) as FunnelDataRow[]
  const setor = (onboardingResult.data?.setor_benchmark ?? null) as SetorBenchmark | null

  if (!accountSnapshot && funnelRows.length === 0) {
    const insight = buildFunnelInsight({
      reach: EMPTY_FUNNEL_METRICS.alcance,
      linkCtrPct: EMPTY_FUNNEL_METRICS.linkCtrPct,
      dataSource: 'empty_database',
    })
    return { metrics: EMPTY_FUNNEL_METRICS, insight, setor }
  }

  const metrics = mapFunnelMetrics(accountSnapshot, funnelRows)
  const insight = buildFunnelInsight({
    reach: metrics.alcance,
    linkCtrPct: metrics.linkCtrPct,
    dataSource: 'real_snapshot',
  })
  return { metrics, insight, setor }
}

// ============================================================================
// FIM — cálculo de simulação vive em src/lib/funnelMath.ts (runFunnelSimulation)
// ============================================================================