/* ==========================================================================
   ORBIT · Repository — Instagram Overview
   Camada: [Supabase] ➔ [View SQL] ➔ [Repository]
   Versão: 1.2.0  |  Data: 2026-06-09

   FIXES v1.2.0:
   - BUG 5: fetchKPIs filtra por metric_key (4 KPIs em vez de 13)
   - BUG 3: fetchAlerts usa critical_alerts com colunas reais
            (metric_id + message; is_active removido — não existe na tabela)
   - BUG 4: clientHandle lê instagram_account_id de clients (não UUID bruto)
   - fetchQualityScores: lança erro em vez de retornar [] silenciosamente
   - BUG 2: Insights com % correto (era 124000%, agora 9.96%)
   - Conversão string→number em rawKpiToCardData (Supabase retorna string)
   ========================================================================== */

import { supabase } from '../lib/supabaseClient'
import {
  PROTOTYPE_KPIS,
  PROTOTYPE_QUALITY_SCORES,
  PROTOTYPE_FORMAT_PERFORMANCE,
  PROTOTYPE_INSIGHTS,
  PROTOTYPE_CRITICAL_ALERTS,
  PROTOTYPE_HEADER_META,
} from '../lib/prototypeConstants'
import type {
  KpiSnapshotRow,
  QualityScoreRow,
  FormatPerformanceRawRow,
  CriticalAlertRawRow,
  KPICardData,
  QualityScoreItem,
  FormatPerformanceRow,
  InsightData,
  CriticalAlertData,
  DashboardHeaderMeta,
  InstagramOverviewData,
  GlowColor,
  SemaphoreColor,
  TrendColor,
} from '../types/orbit'

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const METRIC_GLOW_MAP: Record<string, GlowColor> = {
  'seguidores-totais': 'cyan',
  'saldo-90-dias':     'red',
  'alcance-90d':       'cyan',
  'cliques-no-link':   'red',
}

// FIX BUG 5: lista explícita dos 4 KPIs da visão geral
const KPI_METRIC_KEYS = [
  'alcance-90d',
  'cliques-no-link',
  'seguidores-totais',
  'saldo-90-dias',
] as const

// ─────────────────────────────────────────────
// Helpers de transformação (raw → domain)
// ─────────────────────────────────────────────

function rawKpiToCardData(row: KpiSnapshotRow): KPICardData {
  // ✅ FIX: Conversão defensiva string→number
  // Supabase retorna numeric como string no JSON
  const numericValue = typeof row.metric_value === 'string'
    ? parseFloat(row.metric_value)
    : row.metric_value

  const numericDelta = typeof row.delta_pct === 'string'
    ? parseFloat(row.delta_pct)
    : row.delta_pct

  return {
    id:         row.id,
    label:      row.metric_key.toUpperCase().replace(/-/g, ' '),
    value:      numericValue,          // ← SEMPRE number
    unit:       row.metric_unit,
    delta:      numericDelta,          // ← SEMPRE number
    deltaLabel: 'vs período anterior',
    semaphore:  row.semaphore as SemaphoreColor,
    glowColor:  METRIC_GLOW_MAP[row.metric_key] ?? 'cyan',
    subtitle:   row.subtitle ?? null,
  }
}

function rawScoreToItem(row: QualityScoreRow): QualityScoreItem {
  const glowMap: Record<string, GlowColor> = {
    ok:      'cyan',
    warn:    'red',
    neutral: 'none',
  }
  return {
    id:            row.id,
    label:         row.score_key.toUpperCase().replace(/-/g, ' '),
    value:         row.score_value ?? 'N/A',
    unit:          '%',
    statusText:    row.status_text,
    statusVariant: row.status_variant,
    glowColor:     glowMap[row.status_variant] ?? 'none',
  }
}

function rawFormatToRow(row: FormatPerformanceRawRow): FormatPerformanceRow {
  return {
    id:         row.id,
    format:     row.format_name,
    posts:      row.post_count,
    shares:     row.share_count,
    trendLabel: row.trend_label,
    trendColor: row.trend_color as TrendColor,
  }
}

// ─────────────────────────────────────────────
// Queries individuais por view/tabela
// ─────────────────────────────────────────────

async function fetchKPIs(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<KPICardData[]> {
  const { data, error } = await supabase
    .from('v_kpi_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .in('metric_key', KPI_METRIC_KEYS)           // ← FIX BUG 5
    .order('created_at', { ascending: false })
    .returns<KpiSnapshotRow[]>()

  if (error) throw new Error(`[fetchKPIs] ${error.message}`)
  return data.map(rawKpiToCardData)
}

async function fetchQualityScores(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<QualityScoreItem[]> {
  const { data, error } = await supabase
    .from('v_quality_scores')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .returns<QualityScoreRow[]>()

  // FIX: era return [] silencioso — agora lança igual às outras 3 funções
  if (error) throw new Error(`[fetchQualityScores] ${error.message}`)
  return (data ?? []).map(rawScoreToItem)
}

async function fetchFormatPerformance(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<FormatPerformanceRow[]> {
  const { data, error } = await supabase
    .from('v_format_performance')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .order('share_count', { ascending: false })
    .returns<FormatPerformanceRawRow[]>()

  if (error) throw new Error(`[fetchFormatPerformance] ${error.message}`)
  return data.map(rawFormatToRow)
}

async function fetchAlerts(clientId: string): Promise<CriticalAlertData[]> {
  const { data, error } = await supabase
    .from('critical_alerts')                      // ← FIX BUG 3: era 'alerts'
    .select('id, metric_id, severity, message')   // ← FIX: colunas reais da tabela
    .eq('client_id', clientId)
    // .eq('is_active', true) ← REMOVIDO: coluna não existe em critical_alerts
    .order('created_at', { ascending: false })
    .returns<CriticalAlertRawRow[]>()             // ← USA TIPO DE orbit.ts

  if (error) throw new Error(`[fetchAlerts] ${error.message}`)
  return (data ?? []).map(row => ({
    id:       row.id,
    title:    row.metric_id,                             // Sprint 3: adicionar coluna 'title'
    body:     row.message,                               // ← FIX: campo real é 'message'
    severity: row.severity as CriticalAlertData['severity'],
  }))
}

// ─────────────────────────────────────────────
// Aggregate — tudo para a página Overview
// ─────────────────────────────────────────────

export interface FetchOverviewParams {
  clientId:          string
  periodStart:       string
  periodEnd:         string
  usePrototypeData?: boolean
}

export async function fetchInstagramOverview(
  params: FetchOverviewParams,
): Promise<InstagramOverviewData> {
  const { clientId, periodStart, periodEnd, usePrototypeData = true } = params

  // LOG TEMPORÁRIO — remover após confirmar em produção
  console.log('[ORBIT] fetchInstagramOverview', { clientId, usePrototypeData })

  if (usePrototypeData) {
    console.log('[ORBIT] → retornando PROTOTYPE')
    return {
      meta:              PROTOTYPE_HEADER_META,
      kpis:              PROTOTYPE_KPIS,
      qualityScores:     PROTOTYPE_QUALITY_SCORES,
      formatPerformance: PROTOTYPE_FORMAT_PERFORMANCE,
      insights:          PROTOTYPE_INSIGHTS,
      criticalAlerts:    PROTOTYPE_CRITICAL_ALERTS,
    }
  }

  console.log('[ORBIT] → buscando SUPABASE real')

  // FIX BUG 4: busca o handle real em vez de usar o UUID como clientHandle
  const { data: clientRow } = await supabase
    .from('clients')
    .select('instagram_account_id')
    .eq('id', clientId)
    .single()

  const handle = clientRow?.instagram_account_id ?? clientId

  const [kpis, qualityScores, formatPerformance, criticalAlerts] = await Promise.all([
    fetchKPIs(clientId, periodStart, periodEnd),
    fetchQualityScores(clientId, periodStart, periodEnd),
    fetchFormatPerformance(clientId, periodStart, periodEnd),
    fetchAlerts(clientId),
  ])

  // Seguidores para cálculo de % nos insights
  const kpiSeguidores = kpis.find(k => k.label.includes('SEGUIDORES'))
  const totalSeguidores =
    typeof kpiSeguidores?.value === 'number' && kpiSeguidores.value > 0
      ? kpiSeguidores.value
      : 1

  // FIX BUG 2: cálculo de % correto (era *100*100, agora só *100)
  const insights: InsightData[] = formatPerformance
    .filter(f => f.shares > 20)
    .map(f => ({
      id:   `insight-${f.id}`,
      text: `${f.shares} compartilhamentos de ${f.format} = ${
        ((f.shares / totalSeguidores) * 100).toFixed(1)  // ← FIX: só *100 (não *100*100)
      }% da base.`,
    }))

  const meta: DashboardHeaderMeta = {
    clientHandle: `@${handle}`,          // ← FIX BUG 4: era `@${clientId}` (UUID)
    periodLabel:  '90 dias',
    dateRange:    { from: periodStart, to: periodEnd },
  }

  return { meta, kpis, qualityScores, formatPerformance, insights, criticalAlerts }
}
