/* ==========================================================================
   ORBIT · Prototype Constants
   Dados hardcoded para Sprint 1 (sem Supabase)
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import type {
  KPICardData,
  QualityScoreItem,
  FormatPerformanceRow,
  InsightData,
  CriticalAlertData,
  DashboardHeaderMeta,
} from '../types/orbit'

// ─────────────────────────────────────────────
// Header Meta
// ─────────────────────────────────────────────

export const PROTOTYPE_HEADER_META: DashboardHeaderMeta = {
  clientHandle: '@cpimportstore',
  periodLabel: '90 dias',
  dateRange: {
    from: '2026-02-23',
    to: '2026-05-23',
  },
}

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────

export const PROTOTYPE_KPIS: KPICardData[] = [
  {
    id: 'kpi-1',
    label: 'SEGUIDORES TOTAIS',
    value: 12450,
    unit: null,
    delta: 8.5,
    deltaLabel: 'vs período anterior',
    semaphore: 'verde',
    glowColor: 'cyan',
    subtitle: '',
    sourceLevel: 'instagram_insights',
  },
  {
    id: 'kpi-2',
    label: 'SALDO 90 DIAS',
    value: 1240,
    unit: null,
    delta: 12.3,
    deltaLabel: 'vs período anterior',
    semaphore: 'verde',
    glowColor: 'red',
    subtitle: '↓ 8 novos + 56 saíram',
    sourceLevel: 'instagram_insights',
  },
  {
    id: 'kpi-3',
    label: 'ALCANCE 90D',
    value: 185600,
    unit: null,
    delta: -3.2,
    deltaLabel: 'vs período anterior',
    semaphore: 'ambar',
    glowColor: 'cyan',
    subtitle: '',
    sourceLevel: 'instagram_insights',
  },
  {
    id: 'kpi-4',
    label: 'CLIQUES NO LINK',
    value: 3420,
    unit: null,
    delta: 15.8,
    deltaLabel: 'vs período anterior',
    semaphore: 'verde',
    glowColor: 'red',
    subtitle: '',
    sourceLevel: 'instagram_insights',
  },
]

// ─────────────────────────────────────────────
// Quality Scores
// ─────────────────────────────────────────────

export const PROTOTYPE_QUALITY_SCORES: QualityScoreItem[] = [
  {
    id: 'score-1',
    label: 'TAXA DE ENGAJAMENTO',
    value: 4.2,
    unit: '%',
    statusText: 'Acima do threshold 2%',
    statusVariant: 'ok',
    glowColor: 'cyan',
  },
  {
    id: 'score-2',
    label: 'TAXA DE SALVAMENTO',
    value: 1.8,
    unit: '%',
    statusText: 'Dentro da média',
    statusVariant: 'neutral',
    glowColor: 'gold',
  },
  {
    id: 'score-3',
    label: 'TAXA DE COMPARTILHAMENTO',
    value: 0.9,
    unit: '%',
    statusText: 'Abaixo do esperado',
    statusVariant: 'warn',
    glowColor: 'red',
  },
]

// ─────────────────────────────────────────────
// Format Performance
// ─────────────────────────────────────────────

export const PROTOTYPE_FORMAT_PERFORMANCE: FormatPerformanceRow[] = [
  {
    id: 'fmt-1',
    format: 'Reels',
    posts: 24,
    shares: 1240,
    trendLabel: 'Candidato boost',
    trendColor: 'cyan',
  },
  {
    id: 'fmt-2',
    format: 'Carousel',
    posts: 18,
    shares: 545,
    trendLabel: 'Estável',
    trendColor: 'gold',
  },
  {
    id: 'fmt-3',
    format: 'Feed',
    posts: 12,
    shares: 180,
    trendLabel: 'Em declínio',
    trendColor: 'red',
  },
]

// ─────────────────────────────────────────────
// Insights
// ─────────────────────────────────────────────

export const PROTOTYPE_INSIGHTS: InsightData[] = [
  {
    id: 'insight-1',
    text: '1240 compartilhamentos de Reels = 69.5% da base.',
  },
  {
    id: 'insight-2',
    text: '545 compartilhamentos de Carousel = 30.5% da base.',
  },
]

// ─────────────────────────────────────────────
// Critical Alerts
// ─────────────────────────────────────────────

export const PROTOTYPE_CRITICAL_ALERTS: CriticalAlertData[] = [
  {
    id: 'alert-1',
    title: 'Queda de Engajamento',
    body: 'Taxa de engajamento caiu 12% na última semana. Considere revisar estratégia de conteúdo.',
    severity: 'warning',
  },
  {
    id: 'alert-2',
    title: 'Oportunidade: Reels',
    body: 'Reels estão com performance 3x melhor que Feed. Aumente frequência de Reels.',
    severity: 'info',
  },
]
