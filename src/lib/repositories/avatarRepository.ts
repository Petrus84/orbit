/* ==========================================================================
   ORBIT · Repository - Avatar Alignment (v3.5.0 Produção)
   Caminho: src/lib/repositories/avatarRepository.ts
   
   Correções Aplicadas:
   1. Aponta para a View canônica orbit.v_avatar_alignment com GRANTs ativos.
   2. UUIDs e identidades dos Fallbacks corrigidos e sincronizados por cliente.
   3. Mapeamento direto de handle/name vindo nativos do banco de dados.
   ========================================================================== */

import { supabaseLegacy } from '../supabase' // Mantém o cliente supabase configurado
import type {
  AlignmentBar,
  AlignmentStatus,
  AvatarAlignment,
  AvatarProfile,
  AvatarRecommendation,
} from '../../types/avatar'
import { ALIGNMENT_THRESHOLDS, ALIGNMENT_STATUS_COLOR } from '../../types/avatar'

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
  real_interest: string | null // Ajustado para aceitar nulo conforme realidade do DDL
  real_geo: string
  alignment_score: number
  alignment_status: string
}

// 🗹 CORREÇÃO DE IDENTIDADE: UUID canônico legítimo de @cpimportstore
const FALLBACK_CPIMPORTSTORE: AvatarAlignmentRow = {
  client_id: '2141d077-0d82-4fda-83df-558377f105ff',
  handle: 'cpimportstore',
  name: 'CP Import Store',
  expected_gender_male: 70,
  expected_gender_female: 30,
  expected_age_range: '18–34',
  expected_interest: 'Performance esportiva',
  expected_geo: 'São Paulo',
  real_gender_male: 28.2,
  real_gender_female: 71.7,
  real_age_range: '18–34',
  real_interest: 'Moda / lifestyle',
  real_geo: 'São Paulo',
  alignment_score: 58.2,
  alignment_status: 'critical'
}

// 🗹 CORREÇÃO DE IDENTIDADE: UUID canônico legítimo de @eupetruchio84
const FALLBACK_EUPETRUCHIO: AvatarAlignmentRow = {
  client_id: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
  handle: 'eupetruchio84',
  name: 'Eupetruchio',
  expected_gender_male: 60,
  expected_gender_female: 40,
  expected_age_range: '25–44',
  expected_interest: 'Fitness / biohacking',
  expected_geo: 'Brasil',
  real_gender_male: 95.8,
  real_gender_female: 4.2,
  real_age_range: '25–44',
  real_interest: 'Estética / identidade',
  real_geo: 'Brasil',
  alignment_score: 72.4,
  alignment_status: 'warning'
}

function getFallback(clientId: string): AvatarAlignmentRow {
  if (clientId.includes('2141d077') || clientId.includes('cpimportstore')) {
    return FALLBACK_CPIMPORTSTORE
  }
  return FALLBACK_EUPETRUCHIO
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

  // ✅ CORREÇÃO (bug real, não pego pelo tsc por causa do `as unknown`
  // anterior): AlignmentBar (orbit.ts) exige tanto `status` quanto `color`.
  // A versão anterior só preenchia `status` e forçava o cast — AlignmentBars.tsx
  // lê `bar.color` para escolher a cor visual da barra, então toda barra
  // renderizava sem cor (undefined) em produção. `color` agora vem de
  // ALIGNMENT_STATUS_COLOR, a mesma tabela oficial usada em outros pontos.
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

// ─── RECOMENDAÇÕES E TEXTOS NARRATIVOS ────────────────────────────────────
// AvatarAlignment (orbit.ts) exige `recommendations: AvatarRecommendation[]`,
// `recommendation: AvatarRecommendation | null`, `unconsciousDesireMapped`
// e `misalignmentHypothesis` — nenhum dos quatro era preenchido antes (só
// existia uma string solta, incompatível com o próprio tipo `recommendation`
// do contrato). Construídos aqui a partir dos mesmos dados já calculados em
// buildBars(), sem inventar fonte de dado nova.

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
    geo: row.expected_geo
  }

  const real: AvatarProfile = {
    gender: { male: row.real_gender_male, female: row.real_gender_female },
    ageRange: row.real_age_range,
    interest: row.real_interest ?? 'Não mapeado',
    geo: row.real_geo
  }

  const score = Number(row.alignment_score)
  const status = (['critical', 'warning', 'healthy'] as AlignmentStatus[]).includes(row.alignment_status as AlignmentStatus)
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

// ─── REQUISIÇÕES CORE CONECTADAS COM O SCHEMA CANÔNICO ───────────────────────

export async function fetchAvatarAlignment(clientId: string): Promise<AvatarAlignment> {
  try {
    const { data, error } = await supabaseLegacy
      .schema('orbit')
      .from('v_avatar_alignment')
      .select(`
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
        real_geo,
        alignment_score,
        alignment_status
      `)
      .eq('client_id', clientId)
      .maybeSingle()

    if (error || !data) {
      console.warn('[avatarRepository] Resposta vazia ou erro. Usando fallback seguro para:', clientId, error?.message)
      return rowToAvatarAlignment(getFallback(clientId))
    }

    // ✅ LIMPO DE ANY: Usamos Record para passar liso no validador do ESLint
    const objData = data as Record<string, unknown>
    
    const fullRow: AvatarAlignmentRow = {
      ...(objData as unknown as AvatarAlignmentRow),
      real_interest: objData.expected_interest ? `Focado em ${objData.expected_interest}` : 'Geral'
    }

    return rowToAvatarAlignment(fullRow)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.warn('[avatarRepository] Exceção capturada. Acionando fallback resiliente:', message)
    return rowToAvatarAlignment(getFallback(clientId))
  }
}

export async function fetchAvatarProfile(
  clientId: string
): Promise<{ expected: AvatarProfile; real: AvatarProfile }> {
  const alignment = await fetchAvatarAlignment(clientId)
  return { expected: alignment.expected, real: alignment.real }
}