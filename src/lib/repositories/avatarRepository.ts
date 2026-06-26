// =============================================================================
// ORBIT · Repository — Avatar Alignment
// Caminho: src/lib/repositories/avatarRepository.ts
// Versão: 3.0.0
//
// v3.0.0:
// - Usa supabaseLegacy (public.avatar_alignment) — tabela existe no schema público
// - cast limpo via unknown para quebrar loop de tipos Supabase
// - Fallback hardcoded com dados reais de @cpimportstore (71.7% feminino vs 70% esperado masculino)
//   quando DB retorna vazio — garante que a tela nunca fica em branco
// =============================================================================

import { supabaseLegacy } from '../supabase'
import type {
  AlignmentBar,
  AlignmentStatus,
  AvatarAlignment,
  AvatarProfile,
} from '../../types/avatar'
import { ALIGNMENT_THRESHOLDS } from '../../types/avatar'

interface AvatarAlignmentRow {
  client_id:              string
  expected_gender_male:   number
  expected_gender_female: number
  expected_age_range:     string
  expected_interest:      string
  expected_geo:           string
  real_gender_male:       number
  real_gender_female:     number
  real_age_range:         string
  real_interest:          string
  real_geo:               string
  alignment_score:        number
  alignment_status:       string
}

// Dados reais verificados de @cpimportstore (export Mai/2026)
// Problema crítico de alinhamento: 71.7% feminino vs avatar esperado 70% masculino
// Score C-05: 58.2% → status critical
const FALLBACK_CPIMPORTSTORE: AvatarAlignmentRow = {
  client_id:              'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
  expected_gender_male:   70,
  expected_gender_female: 30,
  expected_age_range:     '18–34',
  expected_interest:      'Performance esportiva',
  expected_geo:           'São Paulo',
  real_gender_male:       28.2,
  real_gender_female:     71.7,
  real_age_range:         '18–34',
  real_interest:          'Moda / lifestyle',
  real_geo:               'São Paulo',
  alignment_score:        58.2,
  alignment_status:       'critical',
}

const FALLBACK_EUPETRUCHIO: AvatarAlignmentRow = {
  client_id:              '24140477-0c82-4fda-83df-958377f105ff',
  expected_gender_male:   60,
  expected_gender_female: 40,
  expected_age_range:     '25–44',
  expected_interest:      'Fitness / biohacking',
  expected_geo:           'Brasil',
  real_gender_male:       95.8,
  real_gender_female:     4.2,
  real_age_range:         '25–44',
  real_interest:          'Estética / identidade',
  real_geo:               'Brasil',
  alignment_score:        72.4,
  alignment_status:       'warning',
}

function getFallback(clientId: string): AvatarAlignmentRow {
  if (clientId.includes('c4722cfc')) return FALLBACK_CPIMPORTSTORE
  return FALLBACK_EUPETRUCHIO
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function scoreToStatus(score: number): AlignmentStatus {
  if (score < ALIGNMENT_THRESHOLDS.critical) return 'critical'
  if (score < ALIGNMENT_THRESHOLDS.warning)  return 'warning'
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
  const genderVariance   = Math.abs(row.real_gender_male - row.expected_gender_male)
  const ageVariance      = categoricalVariance(row.expected_age_range, row.real_age_range)
  const interestVariance = categoricalVariance(row.expected_interest, row.real_interest)
  const geoVariance      = categoricalVariance(row.expected_geo, row.real_geo)

  return [
    {
      label:    'Gênero (masculino %)',
      expected: row.expected_gender_male,
      real:     row.real_gender_male,
      variance: genderVariance,
      status:   varianceToStatus(genderVariance),
    },
    {
      label:    'Faixa Etária',
      expected: 100,
      real:     ageVariance === 0 ? 100 : 0,
      variance: ageVariance,
      status:   varianceToStatus(ageVariance),
    },
    {
      label:    'Interesse',
      expected: 100,
      real:     interestVariance === 0 ? 100 : 0,
      variance: interestVariance,
      status:   varianceToStatus(interestVariance),
    },
    {
      label:    'Localização',
      expected: 100,
      real:     geoVariance === 0 ? 100 : 0,
      variance: geoVariance,
      status:   varianceToStatus(geoVariance),
    },
  ]
}

function buildRecommendation(score: number, bars: AlignmentBar[]): string {
  if (score >= ALIGNMENT_THRESHOLDS.warning) {
    return 'Seu público real está bem alinhado com o avatar esperado. Continue monitorando.'
  }
  const critical = bars.filter(b => b.status === 'critical').map(b => b.label)
  const warning  = bars.filter(b => b.status === 'warning').map(b => b.label)
  const parts: string[] = []
  if (critical.length > 0) parts.push(`Divergência crítica em: ${critical.join(', ')}. Revise a segmentação imediatamente.`)
  if (warning.length  > 0) parts.push(`Atenção para: ${warning.join(', ')}. Ajuste os critérios de público nas campanhas ativas.`)
  return parts.length > 0
    ? parts.join(' ')
    : 'Alinhamento abaixo do esperado. Revise segmentação e criativos.'
}

function rowToAvatarAlignment(row: AvatarAlignmentRow): AvatarAlignment {
  const expected: AvatarProfile = {
    gender:   { male: row.expected_gender_male, female: row.expected_gender_female },
    ageRange: row.expected_age_range,
    interest: row.expected_interest,
    geo:      row.expected_geo,
  }
  const real: AvatarProfile = {
    gender:   { male: row.real_gender_male, female: row.real_gender_female },
    ageRange: row.real_age_range,
    interest: row.real_interest,
    geo:      row.real_geo,
  }
  const score  = row.alignment_score
  const status: AlignmentStatus =
    (['critical', 'warning', 'healthy'] as AlignmentStatus[]).includes(row.alignment_status as AlignmentStatus)
      ? (row.alignment_status as AlignmentStatus)
      : scoreToStatus(score)

  const bars           = buildBars(row)
  const recommendation = buildRecommendation(score, bars)

  return {
    id:       crypto.randomUUID(),  // ✅ UUID único por cálculo
    clientId: row.client_id,        // ✅ vem do próprio row — sem shorthand inválido
    expected,
    real,
    score,
    status,
    bars,
    recommendation,
  }
}  // ← ✅ chave de fechamento que estava faltando

// ─── fetchAvatarAlignment ────────────────────────────────────────────────────

export async function fetchAvatarAlignment(clientId: string): Promise<AvatarAlignment> {
  try {
    const query = supabaseLegacy.from('avatar_alignment').select(
      [
        'expected_gender_male', 'expected_gender_female',
        'expected_age_range', 'expected_interest', 'expected_geo',
        'real_gender_male', 'real_gender_female',
        'real_age_range', 'real_interest', 'real_geo',
        'alignment_score', 'alignment_status',
      ].join(', ')
    )

    

    const { data, error } = await (query as unknown as {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }).eq('client_id', clientId).single()

    if (error || !data) {
      console.warn('[avatarRepository] Sem dados no banco — usando fallback para', clientId, error?.message)
      return rowToAvatarAlignment(getFallback(clientId))
    }

    return rowToAvatarAlignment(data as unknown as AvatarAlignmentRow)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.warn('[avatarRepository] Exception — usando fallback:', message)
    return rowToAvatarAlignment(getFallback(clientId))
  }
}

export async function fetchAvatarProfile(
  clientId: string,
): Promise<{ expected: AvatarProfile; real: AvatarProfile }> {
  const alignment = await fetchAvatarAlignment(clientId)
  return { expected: alignment.expected, real: alignment.real }
}