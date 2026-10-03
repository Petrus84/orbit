// scoreStatusCopy.ts
// ============================================================================
// Texto dos cards de Scores de Qualidade seguindo a cadeia
//   dado -> informação -> alerta -> ação precisa
// Puro e determinístico: só usa a régua que a view v_quality_scores expõe
// (ref_*). Nunca inventa limiar. Sem régua => diz isso e mostra só o dado.
//
// ⚠️ COPY DE PRODUTO: ACTION_COPY abaixo é rascunho, espelhando a frase de ação
// que o engine já usa em resolveAlgoRiskScoreAlert (12 posts, formato/tema/
// frequência). Ajuste aqui, em um único lugar.
// ============================================================================

export type SemaphoreKey = 'verde' | 'ambar' | 'vermelho'

export interface ScoreReference {
  value: number | null
  semaphore: SemaphoreKey | null
  category: string | null          // 'global' | 'all' | <setor>
  source: string | null            // 'gestao_interna' | 'category' | 'global' | ...
  direction: string | null         // 'higher_is_better' | 'lower_is_better' | ...
  greenMin: number | null
  greenMax: number | null
  redMin: number | null
  redMax: number | null
  p50: number | null
}

export interface ScoreCopy {
  text: string
  action: string | null
  note: string | null
}

const WINDOW_POSTS = 12

const ACTION_COPY = {
  vermelho: `Ação: revise os últimos ${WINDOW_POSTS} posts (formato, tema, frequência) antes de mexer em oferta ou verba.`,
  ambar: (limite: string) =>
    `Ação: acompanhe os próximos ${WINDOW_POSTS} posts; se cruzar ${limite}, trate como vermelho.`,
} as const

const fmt = (n: number): string =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function buildScoreCopy(ref: ScoreReference): ScoreCopy {
  const { value, semaphore } = ref

  if (value === null || !Number.isFinite(value)) {
    return { text: 'Sem dados suficientes para calcular', action: null, note: null }
  }
  if (semaphore === null) {
    return {
      text: 'Sem régua de mercado nem meta de gestão para esta métrica — exibindo só o dado.',
      action: null,
      note: null,
    }
  }

  const isGestao = ref.category === 'global' && ref.source === 'gestao_interna'
  const escopo = isGestao ? 'de gestão' : ref.category === 'all' ? 'geral' : 'do setor'
  const note = isGestao ? 'Meta de gestão provisória — não é benchmark de mercado.' : null

  // higher_is_better: meta = green_min, piso = red_max
  if (ref.direction === 'higher_is_better' && ref.greenMin !== null && ref.redMax !== null) {
    const meta = ref.greenMin
    const piso = ref.redMax
    if (semaphore === 'verde') {
      return { text: `Verde — na meta ${escopo} (≥ ${fmt(meta)}%)`, action: null, note }
    }
    if (semaphore === 'ambar') {
      return {
        text: `Âmbar — a ${fmt(meta - value)} p.p. da meta ${escopo} (${fmt(meta)}%), acima do piso (${fmt(piso)}%)`,
        action: ACTION_COPY.ambar(`o piso (${fmt(piso)}%)`),
        note,
      }
    }
    return {
      text: `Vermelho — abaixo do piso ${escopo} (${fmt(piso)}%); meta ${fmt(meta)}%`,
      action: ACTION_COPY.vermelho,
      note,
    }
  }

  // lower_is_better: limite vermelho = red_min
  if (ref.direction === 'lower_is_better' && ref.redMin !== null) {
    const limite = ref.redMin
    if (semaphore === 'verde') {
      return { text: `Verde — dentro do padrão ${escopo}`, action: null, note }
    }
    if (semaphore === 'ambar') {
      const pos =
        ref.p50 !== null
          ? `${value > ref.p50 ? 'acima' : 'abaixo'} da mediana ${escopo} (${fmt(ref.p50)}%); `
          : ''
      return {
        text: `Âmbar — ${pos}a ${fmt(limite - value)} p.p. do vermelho (${fmt(limite)}%)`,
        action: ACTION_COPY.ambar(`o limite (${fmt(limite)}%)`),
        note,
      }
    }
    return {
      text: `Vermelho — acima do limite ${escopo} (${fmt(limite)}%)`,
      action: ACTION_COPY.vermelho,
      note,
    }
  }

  // Direção/limites não previstos: só o semáforo, sem inventar frase.
  const label = semaphore === 'verde' ? 'Verde' : semaphore === 'ambar' ? 'Âmbar' : 'Vermelho'
  return { text: label, action: semaphore === 'vermelho' ? ACTION_COPY.vermelho : null, note }
}
