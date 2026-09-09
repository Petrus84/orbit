/* ==========================================================================
   ORBIT · Repository - Avatar Alignment (v4.0 Sem Fallback Tóxico)
   
   Mudanças Críticas:
   1. Elimina fallback silencioso — retorna erro explícito
   2. Valida estrutura de dados antes de usar
   3. Diferencia entre "sem dados" e "erro de conexão"
   4. real_interest vem do banco, não é fabricado
   ========================================================================== */

import { supabase } from '@/lib/supabase'
import { repairMojibake } from '@/lib/textRepair'
import type {
  AlignmentBar,
  AlignmentStatus,
  AvatarAlignment,
  AvatarProfile,
  AvatarRecommendation,
} from '@/types/avatar'
import { ALIGNMENT_THRESHOLDS, ALIGNMENT_STATUS_COLOR } from '@/types/avatar'

interface AvatarAlignmentRow {
  client_id: string
  handle: string
  name: string
  expected_gender_male: number
  expected_gender_female: number
  expected_age_range: string
  expected_interest: string | null
  expected_geo: string
  real_gender_male: number
  real_gender_female: number
  real_age_range: string
  real_interest: string | null
  real_geo: string
  alignment_score: number
  alignment_status: string
}

// ─── TIPOS DE ERRO EXPLÍCITOS ─────────────────────────────────────────────

export class AvatarRepositoryError extends Error {
  constructor(
    public code: 'NO_DATA' | 'VALIDATION_FAILED' | 'NETWORK_ERROR' | 'UNKNOWN',
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AvatarRepositoryError'
  }
}

// ─── VALIDAÇÃO DE DADOS ───────────────────────────────────────────────────

function validateAvatarRow(data: unknown): AvatarAlignmentRow {
  if (!data || typeof data !== 'object') {
    throw new AvatarRepositoryError(
      'VALIDATION_FAILED',
      'Dados recebidos não são um objeto válido',
      { received: typeof data }
    )
  }

  const obj = data as Record<string, unknown>

  // Validar campos obrigatórios
  const requiredFields = [
    'client_id',
    'handle',
    'name',
    'expected_gender_male',
    'expected_gender_female',
    'expected_age_range',
    'expected_geo',
    'real_gender_male',
    'real_gender_female',
    'real_age_range',
    'real_geo',
    'alignment_score',
    'alignment_status',
  ]

  const missing = requiredFields.filter((field) => !(field in obj))
  if (missing.length > 0) {
    throw new AvatarRepositoryError(
      'VALIDATION_FAILED',
      `Campos obrigatórios faltando: ${missing.join(', ')}`,
      { missing }
    )
  }

  // Validar tipos numéricos
  if (typeof obj.expected_gender_male !== 'number' || obj.expected_gender_male < 0 || obj.expected_gender_male > 100) {
    throw new AvatarRepositoryError(
      'VALIDATION_FAILED',
      'expected_gender_male deve ser número entre 0-100',
      { received: obj.expected_gender_male }
    )
  }

  if (typeof obj.alignment_score !== 'number' || obj.alignment_score < 0 || obj.alignment_score > 100) {
    throw new AvatarRepositoryError(
      'VALIDATION_FAILED',
      'alignment_score deve ser número entre 0-100',
      { received: obj.alignment_score }
    )
  }

  // Validar status
  const validStatuses = ['critical', 'warning', 'healthy']
  if (!validStatuses.includes(String(obj.alignment_status).toLowerCase())) {
    throw new AvatarRepositoryError(
      'VALIDATION_FAILED',
      `alignment_status deve ser um de: ${validStatuses.join(', ')}`,
      { received: obj.alignment_status }
    )
  }

  return {
    client_id: String(obj.client_id),
    handle: String(obj.handle),
    name: String(obj.name),
    expected_gender_male: Number(obj.expected_gender_male),
    expected_gender_female: Number(obj.expected_gender_female),
    expected_age_range: String(obj.expected_age_range),
    expected_interest: obj.expected_interest ? String(obj.expected_interest) : null,
    expected_geo: String(obj.expected_geo),
    real_gender_male: Number(obj.real_gender_male),
    real_gender_female: Number(obj.real_gender_female),
    real_age_range: String(obj.real_age_range),
    real_interest: obj.real_interest ? String(obj.real_interest) : null, // ✅ Vem do banco
    // ✅ CORRIGIDO 09/09 (punch list item 5️⃣) — mesmo reparo de mojibake
    // usado em captions/top_cities; real_geo vem de ig_audience_snapshots
    // e sofre o mesmo problema de encoding no ingest.
    real_geo: repairMojibake(String(obj.real_geo)) ?? String(obj.real_geo),
    alignment_score: Number(obj.alignment_score),
    alignment_status: String(obj.alignment_status),
  }
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function scoreToStatus(score: number): AlignmentStatus {
  if (score < ALIGNMENT_THRESHOLDS.critical) return 'critical'
  if (score < ALIGNMENT_THRESHOLDS.warning) return 'warning'
  return 'healthy'
}

function varianceToStatus(variance: number): AlignmentStatus {
  if (variance >= 30) return 'critical'
  if (variance >= 15) return 'warning'
  return 'healthy'
}

function categoricalVariance(expected: string, real: string): number {
  return expected.trim().toLowerCase() === real.trim().toLowerCase() ? 0 : 100
}

function buildBars(row: AvatarAlignmentRow): AlignmentBar[] {
  const genderVariance = Math.abs(row.real_gender_male - row.expected_gender_male)
  const ageVariance = categoricalVariance(row.expected_age_range, row.real_age_range)
  const interestVariance = categoricalVariance(row.expected_interest ?? '', row.real_interest ?? '')
  const geoVariance = categoricalVariance(row.expected_geo, row.real_geo)

  const toBar = (label: string, expected: number, real: number, variance: number): AlignmentBar => {
    const status = varianceToStatus(variance)
    return { label, expected, real, variance, status, color: ALIGNMENT_STATUS_COLOR[status] }
  }

  return [
    toBar('Gênero (masculino %)', row.expected_gender_male, row.real_gender_male, genderVariance),
    toBar('Faixa Etária', 100, ageVariance === 0 ? 100 : 0, ageVariance),
    toBar('Interesse', 100, interestVariance === 0 ? 100 : 0, interestVariance),
    toBar('Localização', 100, geoVariance === 0 ? 100 : 0, geoVariance),
  ]
}

const BAR_ICON: Record<AlignmentStatus, string> = {
  critical: '🔴',
  warning: '🟡',
  healthy: '🟢',
}

function buildRecommendations(bars: AlignmentBar[]): AvatarRecommendation[] {
  const problematic = bars.filter((b) => b.status !== 'healthy')

  if (problematic.length === 0) {
    return [
      {
        id: 'alinhamento-saudavel',
        title: 'Alinhamento saudável',
        description: 'Seu público real está bem alinhado com o avatar esperado. Continue monitorando.',
        icon: BAR_ICON.healthy,
        type: 'healthy',
      },
    ]
  }

  return problematic.map((bar) => ({
    id: bar.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-'),
    title: `Revisar ${bar.label}`,
    description:
      bar.status === 'critical'
        ? `Divergência crítica em "${bar.label}" (${bar.variance.toFixed(0)}%). Revise a segmentação imediatamente.`
        : `Atenção para "${bar.label}" (${bar.variance.toFixed(0)}%). Ajuste os critérios de público nas campanhas ativas.`,
    icon: BAR_ICON[bar.status],
    type: bar.status,
  }))
}

function pickTopRecommendation(recommendations: AvatarRecommendation[]): AvatarRecommendation | null {
  const critical = recommendations.find((r) => r.type === 'critical')
  if (critical) return critical
  const warning = recommendations.find((r) => r.type === 'warning')
  if (warning) return warning
  return null
}

function buildUnconsciousDesireMapped(row: AvatarAlignmentRow): string {
  return row.expected_interest
    ? `O avatar esperado busca "${row.expected_interest}" — esse é o desejo inconsciente mapeado que orienta a segmentação atual.`
    : 'Nenhum interesse esperado mapeado para este cliente ainda.'
}

function buildMisalignmentHypothesis(row: AvatarAlignmentRow, bars: AlignmentBar[]): string {
  if (bars.every((b) => b.status === 'healthy')) {
    return 'Sem hipótese de desalinhamento relevante — audiência real e esperada convergem nas variáveis monitoradas.'
  }

  const worst = [...bars].sort((a, b) => b.variance - a.variance)[0]
  return `A maior divergência está em "${worst.label}" (esperado vs. real). Hipótese: a audiência captada reflete "${row.real_interest ?? 'um interesse não mapeado'}", diferente do avatar esperado — provável desalinhamento de criativo ou segmentação de campanha.`
}

function rowToAvatarAlignment(row: AvatarAlignmentRow): AvatarAlignment {
  const expected: AvatarProfile = {
    gender: { male: row.expected_gender_male, female: row.expected_gender_female },
    ageRange: row.expected_age_range,
    interest: row.expected_interest ?? 'Não mapeado',
    geo: row.expected_geo,
  }

  const real: AvatarProfile = {
    gender: { male: row.real_gender_male, female: row.real_gender_female },
    ageRange: row.real_age_range,
    interest: row.real_interest ?? 'Não mapeado',
    geo: row.real_geo,
  }

  const score = Number(row.alignment_score)
  const status = (['critical', 'warning', 'healthy'] as AlignmentStatus[]).includes(
    row.alignment_status as AlignmentStatus
  )
    ? (row.alignment_status as AlignmentStatus)
    : scoreToStatus(score)

  const bars = buildBars(row)
  const recommendations = buildRecommendations(bars)
  const recommendation = pickTopRecommendation(recommendations)

  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'avatar-alignment-id',
    clientId: row.client_id,
    expected,
    real,
    score,
    status,
    bars,
    recommendations,
    recommendation,
    unconsciousDesireMapped: buildUnconsciousDesireMapped(row),
    misalignmentHypothesis: buildMisalignmentHypothesis(row, bars),
  }
}

// ─── REQUISIÇÕES CORE SEM FALLBACK TÓXICO ─────────────────────────────────

export async function fetchAvatarAlignment(clientId: string): Promise<AvatarAlignment> {
  if (!clientId) {
    throw new AvatarRepositoryError(
      'VALIDATION_FAILED',
      'clientId é obrigatório',
      { received: clientId }
    )
  }

  try {
    const { data, error } = await supabase
      .schema('orbit')
      .schema('orbit')
      .from('v_avatar_alignment')
      .select(
        `
        client_id,
        handle,
        name,
        expected_gender_male,
        expected_gender_female,
        expected_age_range,
        expected_interest,
        expected_geo,
        real_gender_male,
        real_gender_female,
        real_age_range,
        real_interest,
        real_geo,
        alignment_score,
        alignment_status
      `
      )
      .eq('client_id', clientId)
      .maybeSingle()

    // ✅ TRATAMENTO EXPLÍCITO: Sem dados
    if (!data) {
      if (error) {
        throw new AvatarRepositoryError(
          'NETWORK_ERROR',
          `Erro ao consultar banco de dados: ${error.message}`,
          { supabaseError: error }
        )
      }

      throw new AvatarRepositoryError(
        'NO_DATA',
        `Nenhum alinhamento de avatar encontrado para clientId: ${clientId}`,
        { clientId }
      )
    }

    // ✅ VALIDAÇÃO: Estrutura de dados
    const validatedRow = validateAvatarRow(data)

    // ✅ CONVERSÃO: Sem fabricação de dados
    return rowToAvatarAlignment(validatedRow)
  } catch (err) {
    // Se já é AvatarRepositoryError, relança como está
    if (err instanceof AvatarRepositoryError) {
      console.error(`[avatarRepository] ${err.code}: ${err.message}`, err.details)
      throw err
    }

    // Outros erros são UNKNOWN
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error(`[avatarRepository] UNKNOWN: ${message}`, err)
    throw new AvatarRepositoryError(
      'UNKNOWN',
      `Erro inesperado ao buscar alinhamento de avatar: ${message}`,
      { originalError: err }
    )
  }
}

export async function fetchAvatarProfile(
  clientId: string
): Promise<{ expected: AvatarProfile; real: AvatarProfile }> {
  const alignment = await fetchAvatarAlignment(clientId)
  return { expected: alignment.expected, real: alignment.real }
}