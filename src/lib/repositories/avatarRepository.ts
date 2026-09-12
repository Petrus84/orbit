/* ==========================================================================
   ORBIT · Repository - Avatar Alignment (v5.0 Conectado ao Mapper)

   v5.0 (conexão ao mapper — 11/09/2026):
   - 🔌 Repositório religado a @/lib/mappers/avatarAlignment. A interface
     local `AvatarAlignmentRow` + `validateAvatarRow()` (validação manual
     campo a campo, escrita à mão) foram substituídas por
     `avatarAlignmentViewRowSchema.parse()` (barreira Zod, gerada a partir
     do shape real de `Database['orbit']['Views']['v_avatar_alignment']`)
     seguido de `mapAvatarAlignmentViewRowToContract()`.
   - ➕ Adicionado `id` à query de select: o schema do mapper exige a coluna
     `id` (presente na view) mesmo que este repositório não a consuma
     diretamente — sem ela, `avatarAlignmentViewRowSchema.parse()` falha
     porque a chave está ausente do objeto, não apenas nula.
   - 🛡️ `OrbitValidationError` (lançado pelo mapper quando `client_id` vem
     nulo — join quebrado) e `ZodError` (schema drift real do Postgres)
     agora são capturados e traduzidos para `AvatarRepositoryError` com
     code 'VALIDATION_FAILED', mantendo a mesma taxonomia de erro que o
     resto do app já espera deste repositório.

   Mudanças Críticas (mantidas de v4.0):
   1. Elimina fallback silencioso — retorna erro explícito
   2. Diferencia entre "sem dados" e "erro de conexão"
   3. real_interest vem do banco, não é fabricado
   ========================================================================== */

import { supabase } from '@/lib/supabase'
import { ZodError } from 'zod'
import type {
  AlignmentBar,
  AlignmentStatus,
  AvatarAlignment,
  AvatarProfile,
  AvatarRecommendation,
} from '@/types/avatar'
import { ALIGNMENT_THRESHOLDS, ALIGNMENT_STATUS_COLOR } from '@/types/avatar'
import type { AvatarAlignmentRow } from '@/types/orbit'
import {
  avatarAlignmentViewRowSchema,
  mapAvatarAlignmentViewRowToContract,
} from '@/lib/mappers/avatarAlignment'
import { OrbitValidationError } from '@/lib/mappers/shared/types'

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

// PR-B / N1 (expected_geo/real_geo = "null"): o mapper (avatarAlignment.mapper.ts)
// só substitui `null` real por 'N/A' — uma linha em que a VIEW devolve o
// texto literal "null"/"undefined" (dado corrompido na ingestão, não o
// `null` do JS) passa pela barreira Zod como string válida e chega aqui
// intacta. Normalizado no ponto de consumo, sem tocar mapper/schema
// (fora do escopo deste PR). Nunca fazer `String(valor)` nesse caminho:
// se `valor` puder ser `null`/`undefined`, `String(null) === 'null'`
// fabricaria exatamente o texto sentinela que este guard evita.
const EMPTY_GEO_SENTINELS = new Set(['', 'null', 'undefined'])

function normalizeGeoText(value: string | null | undefined): string {
  if (value == null) return 'Não especificado'
  const trimmed = value.trim()
  return EMPTY_GEO_SENTINELS.has(trimmed.toLowerCase()) ? 'Não especificado' : trimmed
}

function buildBars(row: AvatarAlignmentRow): AlignmentBar[] {
  const genderVariance = Math.abs(row.real_gender_male - row.expected_gender_male)
  const ageVariance = categoricalVariance(row.expected_age_range, row.real_age_range)
  const interestVariance = categoricalVariance(row.expected_interest ?? '', row.real_interest ?? '')
  // Normalizado antes de comparar: sem isso, "null" (expected) === "null"
  // (real) bateria como alinhamento saudável (variance 0) em vez de
  // sinalizar ausência de dado dos dois lados.
  const geoVariance = categoricalVariance(
    normalizeGeoText(row.expected_geo),
    normalizeGeoText(row.real_geo)
  )

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
  if (!worst) {
    return 'Sem dados suficientes para apontar a maior divergência.'
  }
  return `A maior divergência está em "${worst.label}" (esperado vs. real). Hipótese: a audiência captada reflete "${row.real_interest ?? 'um interesse não mapeado'}", diferente do avatar esperado — provável desalinhamento de criativo ou segmentação de campanha.`
}

function rowToAvatarAlignment(row: AvatarAlignmentRow): AvatarAlignment {
  const expected: AvatarProfile = {
    gender: { male: row.expected_gender_male, female: row.expected_gender_female },
    ageRange: row.expected_age_range,
    interest: row.expected_interest ?? 'Não mapeado',
    geo: normalizeGeoText(row.expected_geo),
  }

  const real: AvatarProfile = {
    gender: { male: row.real_gender_male, female: row.real_gender_female },
    ageRange: row.real_age_range,
    interest: row.real_interest ?? 'Não mapeado',
    geo: normalizeGeoText(row.real_geo),
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
      .from('v_avatar_alignment')
      .select(
        `
        id,
        client_id,
        handle,
        name,
        expected_gender_male,
        expected_gender_female,
        expected_age_range,
        expected_interest,
        expected_geo,
        expected_geo_pct,
        real_gender_male,
        real_gender_female,
        real_age_range,
        real_interest,
        real_geo,
        real_geo_pct,
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

    // ✅ BARREIRA ZOD: valida o shape cru da view antes de mapear
    const parsedRow = avatarAlignmentViewRowSchema.parse(data)

    // ✅ MAPPER: view row → AvatarAlignmentRow (Contract, orbit.ts)
    const contractRow = mapAvatarAlignmentViewRowToContract(parsedRow)

    // ✅ CONVERSÃO: Contract → AvatarAlignment (domínio de UI)
    return rowToAvatarAlignment(contractRow)
  } catch (err) {
    // Se já é AvatarRepositoryError, relança como está
    if (err instanceof AvatarRepositoryError) {
      console.error(`[avatarRepository] ${err.code}: ${err.message}`, err.details)
      throw err
    }

    // client_id nulo na view (JOIN quebrado) — sinalizado pelo mapper
    if (err instanceof OrbitValidationError) {
      const wrapped = new AvatarRepositoryError(
        'VALIDATION_FAILED',
        err.message,
        { details: err.details }
      )
      console.error(`[avatarRepository] ${wrapped.code}: ${wrapped.message}`, wrapped.details)
      throw wrapped
    }

    // Schema drift real do Postgres — coluna removida/tipo trocado
    if (err instanceof ZodError) {
      const wrapped = new AvatarRepositoryError(
        'VALIDATION_FAILED',
        'Payload de orbit.v_avatar_alignment fora do schema esperado',
        { zodIssues: err.issues }
      )
      console.error(`[avatarRepository] ${wrapped.code}: ${wrapped.message}`, wrapped.details)
      throw wrapped
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