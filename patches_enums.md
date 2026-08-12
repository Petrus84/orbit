# Criar arquivo TypeScript com tipos corrigidos

codigo_ts = '''// ============================================================================
// 📋 TIPOS DE ENUMS - ORBIT SYSTEM
// ============================================================================
// Arquivo: src/lib/types/enums-orbit.ts
// Propósito: Centralizar todos os enums do sistema com type safety
// Data: 2026-08-11
// Status: ✅ ALINHADO COM BANCO DE DADOS
// ============================================================================

/**
 * Plataforma de publicidade
 * Origem: orbit.ads_platform (enum no PostgreSQL)
 * Uso: Identificar qual plataforma (Meta, Google, TikTok, LinkedIn)
 */
export type AdsPlatform = 'meta' | 'google' | 'tiktok' | 'linkedin'

/**
 * Tipo de alerta gerado pelo sistema
 * Origem: orbit.alert_type (enum no PostgreSQL)
 * Uso: Classificar alertas por tipo de problema
 */
export type AlertType = 
  | 'ctr_below_threshold'
  | 'engagement_collapse'
  | 'avatar_misalignment'
  | 'creative_fatigue'
  | 'roas_below_minimum'
  | 'follower_churn_high'
  | 'polemic_score_high'
  | 'boost_opportunity'
  | 'budget_pace'

/**
 * Severidade do alerta
 * Origem: orbit.alert_severity (enum no PostgreSQL)
 * ⚠️ CORRIGIDO: Removidos 13 valores inválidos
 * Uso: Priorizar alertas no dashboard
 */
export type AlertSeverity = 'critical' | 'info' | 'success' | 'warning'

/**
 * Status de um ativo (anúncio, criativo, campanha)
 * Origem: orbit.asset_status (enum no PostgreSQL)
 * Uso: Controlar ciclo de vida de ativos
 */
export type AssetStatus = 'active' | 'paused' | 'archived' | 'draft' | 'under_review'

/**
 * Objetivo da campanha de publicidade
 * Origem: orbit.campaign_objective (enum no PostgreSQL)
 * Uso: Classificar campanhas por objetivo
 */
export type CampaignObjective = 
  | 'awareness'
  | 'reach'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'app_promotion'
  | 'sales'
  | 'video_views'

/**
 * Nível de confiança dos dados ingeridos
 * Origem: orbit.confidence_level (enum no PostgreSQL)
 * Uso: Indicar qualidade/confiabilidade dos dados
 * L0 = Confiança Alta (dados diretos da API)
 * L1 = Confiança Média (dados processados)
 * L2 = Confiança Baixa (dados estimados/interpolados)
 */
export type ConfidenceLevel = 'L0' | 'L1' | 'L2'

/**
 * Formato de conteúdo publicado
 * Origem: orbit.content_format (enum no PostgreSQL)
 * Uso: Agrupar análises por tipo de conteúdo
 */
export type ContentFormat = 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv'

/**
 * Causa raiz da fadiga criativa
 * Origem: orbit.fatigue_cause (enum no PostgreSQL)
 * Uso: Diagnosticar por que criativo está fatigado
 */
export type FatigueCause = 
  | 'creative_saturation'
  | 'segmentation_issue'
  | 'offer_issue'
  | 'healthy'

/**
 * Categoria de gênero do público
 * Origem: orbit.gender_category (enum no PostgreSQL)
 * Uso: Análise demográfica de audiência
 */
export type GenderCategory = 'male' | 'female' | 'non_binary' | 'mixed'

/**
 * Status de saúde de uma conta/métrica
 * Origem: orbit.health_status (enum no PostgreSQL)
 * Uso: Indicador visual de saúde geral
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

/**
 * Script que realizou a ingestão de dados
 * Origem: orbit.ingest_script (enum no PostgreSQL)
 * Uso: Rastreabilidade de origem dos dados
 */
export type IngestScript = 'ingest-l0-v2' | 'ingest-insights' | 'extract-demographics' | 'manual'

/**
 * Fonte de origem do período de dados
 * Origem: orbit.period_source (enum no PostgreSQL)
 * Uso: Identificar de onde vieram os dados (API, export, manual)
 */
export type PeriodSource = 
  | 'instagram_export'
  | 'meta_api'
  | 'google_ads_api'
  | 'ga4_api'
  | 'manual_input'

// ============================================================================
// TYPE GUARDS - Validação em Runtime
// ============================================================================

/**
 * Valida se valor é uma AdsPlatform válida
 */
export function isAdsPlatform(value: unknown): value is AdsPlatform {
  return typeof value === 'string' && ['meta', 'google', 'tiktok', 'linkedin'].includes(value)
}

/**
 * Valida se valor é um AlertType válido
 */
export function isAlertType(value: unknown): value is AlertType {
  const validTypes = [
    'ctr_below_threshold',
    'engagement_collapse',
    'avatar_misalignment',
    'creative_fatigue',
    'roas_below_minimum',
    'follower_churn_high',
    'polemic_score_high',
    'boost_opportunity',
    'budget_pace'
  ]
  return typeof value === 'string' && validTypes.includes(value)
}

/**
 * Valida se valor é uma AlertSeverity válida
 */
export function isAlertSeverity(value: unknown): value is AlertSeverity {
  return typeof value === 'string' && ['critical', 'info', 'success', 'warning'].includes(value)
}

/**
 * Valida se valor é um AssetStatus válido
 */
export function isAssetStatus(value: unknown): value is AssetStatus {
  return typeof value === 'string' && ['active', 'paused', 'archived', 'draft', 'under_review'].includes(value)
}

/**
 * Valida se valor é um CampaignObjective válido
 */
export function isCampaignObjective(value: unknown): value is CampaignObjective {
  const validObjectives = ['awareness', 'reach', 'traffic', 'engagement', 'leads', 'app_promotion', 'sales', 'video_views']
  return typeof value === 'string' && validObjectives.includes(value)
}

/**
 * Valida se valor é um ConfidenceLevel válido
 */
export function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return typeof value === 'string' && ['L0', 'L1', 'L2'].includes(value)
}

/**
 * Valida se valor é um ContentFormat válido
 */
export function isContentFormat(value: unknown): value is ContentFormat {
  return typeof value === 'string' && ['reel', 'static_post', 'carousel', 'story', 'live', 'igtv'].includes(value)
}

/**
 * Valida se valor é um FatigueCause válido
 */
export function isFatigueCause(value: unknown): value is FatigueCause {
  return typeof value === 'string' && ['creative_saturation', 'segmentation_issue', 'offer_issue', 'healthy'].includes(value)
}

/**
 * Valida se valor é uma GenderCategory válida
 */
export function isGenderCategory(value: unknown): value is GenderCategory {
  return typeof value === 'string' && ['male', 'female', 'non_binary', 'mixed'].includes(value)
}

/**
 * Valida se valor é um HealthStatus válido
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === 'string' && ['healthy', 'warning', 'critical', 'unknown'].includes(value)
}

/**
 * Valida se valor é um IngestScript válido
 */
export function isIngestScript(value: unknown): value is IngestScript {
  return typeof value === 'string' && ['ingest-l0-v2', 'ingest-insights', 'extract-demographics', 'manual'].includes(value)
}

/**
 * Valida se valor é um PeriodSource válido
 */
export function isPeriodSource(value: unknown): value is PeriodSource {
  const validSources = ['instagram_export', 'meta_api', 'google_ads_api', 'ga4_api', 'manual_input']
  return typeof value === 'string' && validSources.includes(value)
}

// ============================================================================
// MAPEAMENTOS PARA DISPLAY
// ============================================================================

/**
 * Traduz AlertSeverity para label em português
 */
export const alertSeverityLabels: Record<AlertSeverity, string> = {
  critical: 'Crítico',
  info: 'Informação',
  success: 'Sucesso',
  warning: 'Aviso'
}

/**
 * Traduz ContentFormat para label em português
 */
export const contentFormatLabels: Record<ContentFormat, string> = {
  reel: 'Reels',
  static_post: 'Estático',
  carousel: 'Carrossel',
  story: 'Stories',
  live: 'Live',
  igtv: 'IGTV'
}

/**
 * Traduz HealthStatus para label em português
 */
export const healthStatusLabels: Record<HealthStatus, string> = {
  healthy: 'Saudável',
  warning: 'Atenção',
  critical: 'Crítico',
  unknown: 'Desconhecido'
}

/**
 * Cores para cada HealthStatus
 */
export const healthStatusColors: Record<HealthStatus, string> = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  unknown: '#6b7280'
}
'''

# Salvar arquivo TypeScript