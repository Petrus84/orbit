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

   v5.1 (correções pós-dump — 20/09/2026):
   - 🚫 Sem "não configurado" mascarado: avatar esperado incompleto, audiência
     real ausente ou score não calculado (view devolve NULL/'unknown') agora
     lançam NO_DATA com a lista do que falta — em vez de exibir 0% / "Crítico"
     fabricado. A decisão é tomada sobre o dado CRU, antes de o mapper trocar
     null por 0 / 'N/A'.
   - 🔎 Só compara o que existe dos dois lados: eixo sem valor esperado ou
     real é omitido das barras (antes virava divergência de 100%). "N/A" e
     "Não especificado" contam como vazio.
   - 📐 Faixa etária compara por SOBREPOSIÇÃO de intervalos (ex.: 18–65 vs
     18–24 = alinhado), não por igualdade de texto.
   - 🔤 Mojibake reparado (repairMojibake) nos textos de geolocalização.
   - 🧹 Copy sem vocabulário psicográfico ("desejo inconsciente").

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
import { repairMojibake } from '@/lib/textRepair'

type AvatarViewRow = ReturnType<typeof avatarAlignmentViewRowSchema.parse>

/** Eixos que existem dos DOIS lados (esperado e real) e podem ser comparados. */
interface ComparableAxes {
  gender: boolean
  age: boolean
  geo: boolean
  interest: boolean
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

// Textos que significam "sem valor": null real, literais "null"/"undefined"
// vindos de ingestão corrompida, e os placeholders que o mapper/UI já usaram
// ('N/A', 'Não especificado'). Nunca fazer `String(valor)` aqui: se `valor`
// puder ser `null`/`undefined`, `String(null) === 'null'` fabricaria o
// texto sentinela que este guard evita.
const EMPTY_TEXT_SENTINELS = new Set([
  '',
  'null',
  'undefined',
  'n/a',
  'não especificado',
  'nao especificado',
])

function isBlankText(value: string | null | undefined): boolean {
  if (value == null) return true
  return EMPTY_TEXT_SENTINELS.has(value.trim().toLowerCase())
}

function normalizeGeoText(value: string | null | undefined): string {
  if (value == null || isBlankText(value)) return 'Não especificado'
  const trimmed = value.trim()
  return repairMojibake(trimmed) ?? trimmed
}

function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/** "18–24", "25-34", "55+" → [min, max]; texto fora do padrão → null. */
function parseAgeRange(text: string): [number, number] | null {
  const match = text.replace(/\s/g, '').match(/^(\d{1,3})(?:[–-](\d{1,3})|\+)$/)
  if (!match || match[1] === undefined) return null
  const min = Number(match[1])
  const max = match[2] !== undefined ? Number(match[2]) : 120
  return [min, max]
}

/** true/false quando ambos os intervalos são legíveis; null quando não dá para comparar. */
function ageRangesOverlap(expected: string, real: string): boolean | null {
  const a = parseAgeRange(expected)
  const b = parseAgeRange(real)
  if (!a || !b) return null
  return a[0] <= b[1] && b[0] <= a[1]
}

function detectComparableAxes(raw: AvatarViewRow): ComparableAxes {
  return {
    gender: raw.expected_gender_male != null && raw.real_gender_male != null,
    age: raw.expected_age_range != null && raw.real_age_range != null,
    geo: !isBlankText(raw.expected_geo) && !isBlankText(raw.real_geo),
    interest: !isBlankText(raw.expected_interest) && !isBlankText(raw.real_interest),
  }
}

function buildBars(row: AvatarAlignmentRow, axes: ComparableAxes): AlignmentBar[] {
  const toBar = (label: string, expected: number, real: number, variance: number): AlignmentBar => {
    const status = varianceToStatus(variance)
    return { label, expected, real, variance, status, color: ALIGNMENT_STATUS_COLOR[status] }
  }

  const bars: AlignmentBar[] = []

  if (axes.gender) {
    const variance = Math.abs(row.real_gender_male - row.expected_gender_male)
    bars.push(toBar('Gênero (masculino %)', row.expected_gender_male, row.real_gender_male, variance))
  }

  if (axes.age) {
    const overlap = ageRangesOverlap(row.expected_age_range, row.real_age_range)
    if (overlap !== null) {
      bars.push(toBar('Faixa Etária', 100, overlap ? 100 : 0, overlap ? 0 : 100))
    }
  }

  if (axes.interest) {
    const variance = categoricalVariance(
      foldText(row.expected_interest ?? ''),
      foldText(row.real_interest ?? '')
    )
    bars.push(toBar('Interesse', 100, variance === 0 ? 100 : 0, variance))
  }

  if (axes.geo) {
    const variance = categoricalVariance(
      foldText(normalizeGeoText(row.expected_geo)),
      foldText(normalizeGeoText(row.real_geo))
    )
    bars.push(toBar('Localização', 100, variance === 0 ? 100 : 0, variance))
  }

  return bars
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
  return !isBlankText(row.expected_interest)
    ? `Interesse esperado do avatar: "${row.expected_interest}".`
    : 'Nenhum interesse esperado configurado para este cliente ainda.'
}

function buildMisalignmentHypothesis(row: AvatarAlignmentRow, bars: AlignmentBar[]): string {
  if (bars.length === 0) {
    return 'Sem variáveis comparáveis entre o avatar esperado e a audiência real neste período.'
  }

  if (bars.every((b) => b.status === 'healthy')) {
    return 'Sem hipótese de desalinhamento relevante — audiência real e esperada convergem nas variáveis monitoradas.'
  }

  const worst = [...bars].sort((a, b) => b.variance - a.variance)[0]
  if (!worst) {
    return 'Sem dados suficientes para apontar a maior divergência.'
  }
  const observed = !isBlankText(row.real_interest)
    ? ` Hipótese: a audiência captada reflete "${row.real_interest}", diferente do avatar esperado —`
    : ' Hipótese:'
  return `A maior divergência está em "${worst.label}" (esperado vs. real).${observed} provável desalinhamento de criativo ou segmentação de campanha.`
}

function rowToAvatarAlignment(row: AvatarAlignmentRow, axes: ComparableAxes): AvatarAlignment {
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

  const bars = buildBars(row, axes)
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
        'Nenhum registro de avatar encontrado para este cliente.',
        { clientId }
      )
    }

    // ✅ BARREIRA ZOD: valida o shape cru da view antes de mapear
    const parsedRow = avatarAlignmentViewRowSchema.parse(data)

    // ✅ "NÃO CONFIGURADO" HONESTO: decidido sobre o dado CRU (antes de o mapper
    // trocar null por 0 / 'N/A'). Sem avatar esperado completo, sem audiência
    // real ou sem score calculado pela view (NULL / 'unknown'), não há
    // alinhamento a mostrar — a tela tem estado dedicado para NO_DATA; nunca
    // exibir 0% "Crítico" fabricado. A mensagem diz exatamente o que falta.
    const missingExpected = [
      parsedRow.expected_gender_male == null ? 'gênero' : null,
      parsedRow.expected_age_range == null ? 'faixa etária' : null,
      isBlankText(parsedRow.expected_geo) ? 'localização' : null,
    ].filter((item): item is string => item !== null)
    const missingReal =
      parsedRow.real_gender_male == null && parsedRow.real_age_range == null
    const scoreComputed =
      parsedRow.alignment_score != null && parsedRow.alignment_status !== 'unknown'

    if (missingExpected.length > 0 || missingReal || !scoreComputed) {
      const message =
        missingExpected.length > 0
          ? `Avatar esperado incompleto — falta definir: ${missingExpected.join(', ')}.`
          : missingReal
            ? 'Sem audiência real (snapshot com faixa etária) para comparar com o avatar esperado.'
            : 'O avatar e a audiência existem, mas o alinhamento ainda não foi calculado para este cliente.'
      throw new AvatarRepositoryError('NO_DATA', message, {
        clientId,
        missingExpected,
        missingReal,
        scoreComputed,
      })
    }

    const axes = detectComparableAxes(parsedRow)

    // ✅ MAPPER: view row → AvatarAlignmentRow (Contract, orbit.ts)
    const contractRow = mapAvatarAlignmentViewRowToContract(parsedRow)

    // ✅ CONVERSÃO: Contract → AvatarAlignment (domínio de UI)
    return rowToAvatarAlignment(contractRow, axes)
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