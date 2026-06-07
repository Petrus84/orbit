/* ==========================================================================
   ORBIT · Repository — Instagram Overview
   Camada: [Supabase] ➔ [View SQL] ➔ [Repository]
   Versão: 1.1.0  |  Data: 2026-06-06

   MUDANÇAS v1.1:
   - BUG-5 corrigido: total de seguidores dinâmico (era hardcoded 1785)
   - glowColor neutral mapeado para 'none' (era 'gold', sem cobertura no tipo)
   - subtitle null handling explícito (era string vazia em vez de null)
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
  AlertRow,
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
// Helpers de transformação (raw → domain)
// ─────────────────────────────────────────────

const METRIC_GLOW_MAP: Record<string, GlowColor> = {
  'seguidores-totais': 'cyan',
  'saldo-90-dias':     'red',
  'alcance-90d':       'cyan',
  'cliques-no-link':   'red',
}

function rawKpiToCardData(row: KpiSnapshotRow): KPICardData {
  return {
    id:         row.id,
    label:      row.metric_key.toUpperCase().replace(/-/g, ' '),
    value:      row.metric_value,
    unit:       row.metric_unit,
    delta:      row.delta_pct,
    deltaLabel: 'vs período anterior',
    semaphore:  row.semaphore as SemaphoreColor,
    glowColor:  METRIC_GLOW_MAP[row.metric_key] ?? 'cyan',
    // FIX: subtitle null explícito em vez de string vazia
    subtitle:   row.subtitle ?? null,
  }
}

function rawScoreToItem(row: QualityScoreRow): QualityScoreItem {
  // FIX: 'neutral' mapeado para 'none' — GlowColor não tem 'none' como 'gold'
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

  if (error) throw new Error(`[fetchQualityScores] ${error.message}`)
  return data.map(rawScoreToItem)
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
    .from('alerts')
    .select('id, title, body, severity')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<Pick<AlertRow, 'id' | 'title' | 'body' | 'severity'>[]>()

  if (error) throw new Error(`[fetchAlerts] ${error.message}`)
  return data.map(row => ({
    id:       row.id,
    title:    row.title,
    body:     row.body,
    severity: row.severity,
  }))
}

// ─────────────────────────────────────────────
// Aggregate — tudo para a página Overview
// ─────────────────────────────────────────────

export interface FetchOverviewParams {
  clientId:         string
  periodStart:      string
  periodEnd:        string
  usePrototypeData?: boolean
}

export async function fetchInstagramOverview(
  params: FetchOverviewParams,
): Promise<InstagramOverviewData> {
  const { clientId, periodStart, periodEnd, usePrototypeData = true } = params

  if (usePrototypeData) {
    return {
      meta:              PROTOTYPE_HEADER_META,
      kpis:              PROTOTYPE_KPIS,
      qualityScores:     PROTOTYPE_QUALITY_SCORES,
      formatPerformance: PROTOTYPE_FORMAT_PERFORMANCE,
      insights:          PROTOTYPE_INSIGHTS,
      criticalAlerts:    PROTOTYPE_CRITICAL_ALERTS,
    }
  }

  const [kpis, qualityScores, formatPerformance, criticalAlerts] = await Promise.all([
    fetchKPIs(clientId, periodStart, periodEnd),
    fetchQualityScores(clientId, periodStart, periodEnd),
    fetchFormatPerformance(clientId, periodStart, periodEnd),
    fetchAlerts(clientId),
  ])

  // FIX BUG-5: total de seguidores dinâmico — lido do KPI real
  // Em vez de 1785 hardcoded, pega o valor do card 'seguidores-totais'
  const kpiSeguidores = kpis.find(k => k.id === 'seguidores-totais')
  const totalSeguidores = typeof kpiSeguidores?.value === 'number' && kpiSeguidores.value > 0
    ? kpiSeguidores.value
    : 1 // fallback de segurança — evita divisão por zero

  const insights: InsightData[] = formatPerformance
    .filter(f => f.shares > 20)
    .map(f => ({
      id:   `insight-${f.id}`,
      text: `${f.shares} compartilhamentos de ${f.format} = ${
        ((f.shares / totalSeguidores) * 100).toFixed(1)
      }% da base.`,
    }))

  const meta: DashboardHeaderMeta = {
    clientHandle: `@${clientId}`,
    periodLabel:  '90 dias',
    dateRange:    { from: periodStart, to: periodEnd },
  }

  return { meta, kpis, qualityScores, formatPerformance, insights, criticalAlerts }
}
