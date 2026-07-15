// ═══════════════════════════════════════════════════════════════════════════
// ORBIT · Repository - Avatar Alignment (v5.0.1 — PENDING STATE ADDED)
//
// v5.0.1 (2026-07-14):
// - ✅ NOVO: AlignmentStatus agora inclui 'pending' (types/orbit.ts v1.2.1)
// - ✅ NOVO: createNullState usa status: 'pending' (não 'critical')
// - ✅ NOVO: scoreToStatus retorna 'pending' quando score === null
// - ✅ NOVO: buildRecommendation usa switch(status) com case 'pending'
// - 🔧 FIX: Removida duplicação de scoreToStatus() (estava declarada 2x)
// - ✅ MANTIDO: RPC call a orbit.compute_avatar_alignment() (fonte única)
// - ✅ MANTIDO: unconsciousDesire / alignmentHypothesis leitura do DB
//
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '../supabase'
import type {
  AlignmentBar,
  AlignmentColor,
  AlignmentStatus,
  AvatarAlignment,
  AvatarProfile,
  GenderSplit,
} from '../../types/avatar'
import { ALIGNMENT_THRESHOLDS } from '../../types/avatar'

// ── Raw shapes das duas fontes (orbit.clients + orbit.ig_audience_snapshots) ─

interface OrbitClientExpectedRow {
  id: string
  avatar_expected_gender: 'male' | 'female' | 'non_binary' | 'mixed' | null
  avatar_expected_gender_pct: number | null
  avatar_expected_age_min: number | null
  avatar_expected_age_max: number | null
  avatar_expected_geo_primary: string | null
  avatar_expected_geo_pct: number | null
  avatar_expected_interest: string | null
  avatar_unconscious_desire: string | null
  avatar_alignment_hypothesis: string | null
}

interface OrbitAudienceSnapshotRow {
  id: string
  client_id: string
  period_end: string
  gender_male_pct: number | null
  gender_female_pct: number | null
  age_13_17_pct: number | null
  age_18_24_pct: number | null
  age_25_34_pct: number | null
  age_35_44_pct: number | null
  age_45_54_pct: number | null
  age_55_plus_pct: number | null
  top_cities: { name: string; pct: number }[] | null
}

interface AlignmentScoresRpcResult {
  gender_score: number | null
  age_score: number | null
  geo_score: number | null
  composite: number | null
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/**
 * Estado N/A semântico quando não há registro nenhum pro cliente
 * (nem em orbit.clients, o que não deveria acontecer, nem snapshot de
 * audiência ainda importado).
 *
 * ✅ v5.0.1: status = 'pending' (não 'critical')
 * Semântica correta: sem dados = pendente, não crítico
 */
const createNullState = (cid: string): AvatarAlignment => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'avatar-alignment-id',
  clientId: cid,
  expected: {
    gender: { male: 0, female: 0 },
    ageRange: 'N/A',
    interest: 'N/A',
    geo: 'N/A',
  },
  real: {
    gender: { male: 0, female: 0 },
    ageRange: 'N/A',
    interest: 'N/A',
    geo: 'N/A',
  },
  score: 0,
  status: 'pending',
  bars: [],
  recommendation: 'Aguardando cálculo de alinhamento. Configure o avatar esperado em orbit.clients e execute extract-demographics.ts para gerar o primeiro snapshot de audiência.',
  unconsciousDesire: null,
  alignmentHypothesis: null,
})

function varianceToColor(alignmentScore: number | null): AlignmentColor {
  if (alignmentScore === null) return 'red'
  const variance = 100 - alignmentScore
  if (variance >= 30) return 'red'
  if (variance >= 15) return 'amber'
  return 'green'
}

/**
 * Converte enum + percentual único (orbit.clients) num GenderSplit {male,female}.
 * Limitação honesta: o schema guarda só UM gênero-alvo + UM percentual esperado
 * pra ele, não os dois lados. Pra 'male'/'female' isso dá pra inferir o
 * complemento (100 - pct). Pra 'non_binary'/'mixed' não tem como inferir com
 * precisão — dividimos o restante meio a meio e isso fica registrado aqui,
 * não escondido.
 */
function expectedGenderSplit(
  gender: OrbitClientExpectedRow['avatar_expected_gender'],
  pct: number | null
): GenderSplit {
  const p = pct ?? 50
  if (gender === 'male') return { male: p, female: 100 - p }
  if (gender === 'female') return { male: 100 - p, female: p }
  // non_binary / mixed / null: sem base pra split binário preciso
  return { male: 50, female: 50 }
}

function expectedAgeRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'N/A'
  if (min !== null && max !== null) return `${min}-${max}`
  return String(min ?? max)
}

/**
 * orbit.ig_audience_snapshots guarda a distribuição etária real como % por
 * faixa (age_18_24_pct, age_25_34_pct...), não como uma faixa categórica
 * única. Pra exibir ao lado da faixa "esperada" (que É categórica em
 * orbit.clients), pegamos a faixa de maior %. Isso é uma simplificação de
 * exibição, não um dado que o banco guarda pronto — documentado aqui de
 * propósito, porque é exatamente o tipo de conversão que se perde se
 * ninguém escrever o porquê.
 */
function dominantRealAgeRange(row: OrbitAudienceSnapshotRow): string {
  const buckets: [string, number | null][] = [
    ['13-17', row.age_13_17_pct],
    ['18-24', row.age_18_24_pct],
    ['25-34', row.age_25_34_pct],
    ['35-44', row.age_35_44_pct],
    ['45-54', row.age_45_54_pct],
    ['55+', row.age_55_plus_pct],
  ]
  const known = buckets.filter((b): b is [string, number] => b[1] !== null)
  if (known.length === 0) return 'N/A'
  return known.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
}

function topCity(topCities: OrbitAudienceSnapshotRow['top_cities']): string {
  if (!topCities || topCities.length === 0) return 'N/A'
  const sorted = [...topCities].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
  return sorted[0]?.name ?? 'N/A'
}

/**
 * ✅ v5.0.1: Retorna 'pending' quando score === null
 * (antes retornava 'critical', o que era semanticamente incorreto)
 */
function scoreToStatus(score: number | null): AlignmentStatus {
  if (score === null) return 'pending'
  if (score < ALIGNMENT_THRESHOLDS.critical) return 'critical'
  if (score < ALIGNMENT_THRESHOLDS.warning) return 'warning'
  return 'healthy'
}

function buildBars(scores: AlignmentScoresRpcResult, expected: AvatarProfile, real: AvatarProfile): AlignmentBar[] {
  return [
    {
      label: 'Gênero (masculino %)',
      expected: expected.gender.male,
      real: real.gender.male,
      variance: scores.gender_score === null ? 100 : 100 - scores.gender_score,
      color: varianceToColor(scores.gender_score),
    },
    {
      label: 'Faixa Etária',
      expected: 100,
      real: expected.ageRange === real.ageRange ? 100 : 0,
      variance: scores.age_score === null ? 100 : 100 - scores.age_score,
      color: varianceToColor(scores.age_score),
    },
    {
      label: 'Localização',
      expected: 100,
      real: expected.geo === real.geo ? 100 : 0,
      variance: scores.geo_score === null ? 100 : 100 - scores.geo_score,
      color: varianceToColor(scores.geo_score),
    },
  ]
}

/**
 * ✅ v5.0.1: switch(status) com case 'pending' explícito
 * (antes checava score === null separadamente, sem tratamento de status)
 *
 * TypeScript força que todos os casos de AlignmentStatus sejam cobertos.
 * Se você adicionar um novo status e esquecer aqui, a build quebra.
 */
function buildRecommendation(status: AlignmentStatus, score: number | null, bars: AlignmentBar[]): string {
  switch (status) {
    case 'pending':
      return 'Aguardando cálculo de alinhamento. Configure o avatar esperado em orbit.clients e execute extract-demographics.ts para gerar o primeiro snapshot de audiência.'

    case 'critical': {
      const critical = bars.filter((b) => b.color === 'red').map((b) => b.label)
      return critical.length > 0
        ? `Divergência crítica em: ${critical.join(', ')}. Revise a segmentação imediatamente.`
        : 'Alinhamento crítico detectado. Revise segmentação.'
    }

    case 'healthy':
      return 'Seu público real está bem alinhado com o avatar esperado. Continue monitorando.'

    case 'warning': {
      const warning = bars.filter((b) => b.color === 'amber').map((b) => b.label)
      return warning.length > 0
        ? `Atenção para: ${warning.join(', ')}. Ajuste os critérios de público nas campanhas ativas.`
        : 'Alinhamento abaixo do esperado. Revise segmentação e criativos.'
    }
  }
}

// ─── REQUISIÇÕES CORE ──────────────────────────────────────────────────────

/**
 * ✅ Busca alinhamento de avatar — fonte: orbit (schema canônico)
 *
 * Duas queries:
 *  1. orbit.clients        → lado "esperado" (definido manualmente pela agência)
 *  2. orbit.ig_audience_snapshots (mais recente) → lado "real"
 *
 * Scores calculados via RPC: orbit.compute_avatar_alignment(client_id, audience_id)
 */
export async function fetchAvatarAlignment(clientId: string): Promise<AvatarAlignment> {
  try {
    console.log(`[avatarRepository] Buscando alinhamento (orbit) para: ${clientId}`)

    const { data: clientRow, error: clientError } = await supabase
      .schema('orbit')
      .from('clients')
      .select(`
        id,
        avatar_expected_gender,
        avatar_expected_gender_pct,
        avatar_expected_age_min,
        avatar_expected_age_max,
        avatar_expected_geo_primary,
        avatar_expected_geo_pct,
        avatar_expected_interest,
        avatar_unconscious_desire,
        avatar_alignment_hypothesis
      `)
      .eq('id', clientId)
      .maybeSingle<OrbitClientExpectedRow>()

    if (clientError) {
      console.error(`[avatarRepository] [DB ERROR] orbit.clients para ${clientId}:`, clientError.message)
      return createNullState(clientId)
    }

    if (!clientRow) {
      console.warn(`[avatarRepository] [NO DATA] Cliente não encontrado em orbit.clients: ${clientId}`)
      return createNullState(clientId)
    }

    const { data: snapshotRow, error: snapshotError } = await supabase
      .schema('orbit')
      .from('ig_audience_snapshots')
      .select(`
        id,
        client_id,
        period_end,
        gender_male_pct,
        gender_female_pct,
        age_13_17_pct,
        age_18_24_pct,
        age_25_34_pct,
        age_35_44_pct,
        age_45_54_pct,
        age_55_plus_pct,
        top_cities
      `)
      .eq('client_id', clientId)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle<OrbitAudienceSnapshotRow>()

    if (snapshotError) {
      console.error(`[avatarRepository] [DB ERROR] ig_audience_snapshots para ${clientId}:`, snapshotError.message)
      return createNullState(clientId)
    }

    if (!snapshotRow) {
      console.warn(`[avatarRepository] [NO DATA] Sem snapshot de audiência ainda para: ${clientId}`)
      return createNullState(clientId)
    }

    // ✅ Chama a função no Postgres em vez de reimplementar a fórmula aqui.
    // Fonte única de verdade pro cálculo continua sendo orbit.compute_avatar_alignment().
    const { data: scores, error: rpcError } = await supabase
      .schema('orbit')
      .rpc('compute_avatar_alignment', {
        p_client_id: clientId,
        p_audience_id: snapshotRow.id,
      })
      .maybeSingle<AlignmentScoresRpcResult>()

    if (rpcError) {
      console.error(`[avatarRepository] [RPC ERROR] compute_avatar_alignment para ${clientId}:`, rpcError.message)
    }

    const resolvedScores: AlignmentScoresRpcResult = scores ?? {
      gender_score: null,
      age_score: null,
      geo_score: null,
      composite: null,
    }

    const expected: AvatarProfile = {
      gender: expectedGenderSplit(clientRow.avatar_expected_gender, clientRow.avatar_expected_gender_pct),
      ageRange: expectedAgeRange(clientRow.avatar_expected_age_min, clientRow.avatar_expected_age_max),
      interest: clientRow.avatar_expected_interest ?? 'Não mapeado',
      geo: clientRow.avatar_expected_geo_primary ?? 'N/A',
    }

    const real: AvatarProfile = {
      gender: {
        male: snapshotRow.gender_male_pct ?? 0,
        female: snapshotRow.gender_female_pct ?? 0,
      },
      ageRange: dominantRealAgeRange(snapshotRow),
      interest: 'Não mapeado', // orbit.ig_audience_snapshots não rastreia interesse — não existe no export nativo
      geo: topCity(snapshotRow.top_cities),
    }

    const score = resolvedScores.composite
    const status = scoreToStatus(score)
    const bars = buildBars(resolvedScores, expected, real)
    const recommendation = buildRecommendation(status, score, bars)

    console.log(`[avatarRepository] ✅ Alinhamento carregado (orbit) para ${clientId} — score: ${score ?? 'null (pendente)'}`)

    return {
      id: snapshotRow.id,
      clientId,
      expected,
      real,
      score: score ?? 0,
      status,
      bars,
      recommendation,
      unconsciousDesire: clientRow.avatar_unconscious_desire,
      alignmentHypothesis: clientRow.avatar_alignment_hypothesis,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erro desconhecido'
    console.error(`[avatarRepository] [EXCEPTION] Erro crítico para ${clientId}:`, errorMessage)
    return createNullState(clientId)
  }
}

export async function fetchAvatarProfile(
  clientId: string
): Promise<{ expected: AvatarProfile; real: AvatarProfile }> {
  const alignment = await fetchAvatarAlignment(clientId)
  return { expected: alignment.expected, real: alignment.real }
}
