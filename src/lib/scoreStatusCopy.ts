// scoreStatusCopy.ts
// ============================================================================
// Texto dos cards de Scores de Qualidade seguindo a cadeia
//   dado -> informação -> alerta -> ação precisa
// Puro e determinístico: só usa a régua que a view v_quality_scores expõe
// (ref_*). Nunca inventa limiar.
//
// ✅ COPY v2 (2026-10-06) — VOZ DO PRODUTO:
//   1. Fala com "você", como parceiro competente (nem robô, nem infantil).
//   2. Cada texto: o que o número diz -> quanto confiar -> o que fazer
//      (esta última só quando há base real).
//   3. Nunca promete o que não existe ("em breve" só com roadmap real).
//   4. Admite limites com dignidade: diz o que o número é e o que não é.
//   5. Jargão interno (régua, ref_thresholds) nunca aparece para o cliente.
//   Números e limiares permanecem 100% fiéis à view; só o enquadramento muda.
//
// ✅ RWP-2 (2026-10-06): régua de GESTÃO (category='global' +
// source='gestao_interna' — hoje ER Real e VPS) NUNCA gera Ação. É meta
// provisória, sem amostra de mercado, e o engine devolve 'neutro' para
// essas métricas (D8). Decisão centralizada em `actionFor`.
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
  vermelho: `Próximo passo: olhe os últimos ${WINDOW_POSTS} posts (formato, tema e frequência) antes de mexer em oferta ou verba.`,
  ambar: (limite: string) =>
    `Próximo passo: acompanhe os próximos ${WINDOW_POSTS} posts. Se passar de ${limite}, o indicador entra no vermelho.`,
} as const

const NO_DATA_TEXT =
  'Ainda não há posts suficientes neste período para calcular este indicador.'

const NO_REFERENCE_TEXT =
  'Este é o número da sua conta no período. Ainda não há uma referência confiável para classificá-lo, então preferimos não dar nota.'

const GESTAO_NOTE =
  'Meta provisória de gestão: um guia de trabalho, não um benchmark de mercado.'

const fmt = (n: number): string =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Régua de gestão provisória (não é benchmark de mercado). */
export function isGestaoReference(ref: ScoreReference): boolean {
  return ref.category === 'global' && ref.source === 'gestao_interna'
}

export function buildScoreCopy(ref: ScoreReference): ScoreCopy {
  const { value, semaphore } = ref

  if (value === null || !Number.isFinite(value)) {
    return { text: NO_DATA_TEXT, action: null, note: null }
  }
  if (semaphore === null) {
    return { text: NO_REFERENCE_TEXT, action: null, note: null }
  }

  const isGestao = isGestaoReference(ref)
  const escopo = isGestao ? 'de gestão' : ref.category === 'all' ? 'geral' : 'do setor'
  const note = isGestao ? GESTAO_NOTE : null

  // RWP-2: ponto único de decisão. Gestão => sem Ação, em qualquer ramo.
  const actionFor = (action: string | null): string | null =>
    isGestao ? null : action

  // higher_is_better: meta = green_min, piso = red_max
  if (ref.direction === 'higher_is_better' && ref.greenMin !== null && ref.redMax !== null) {
    const meta = ref.greenMin
    const piso = ref.redMax
    if (semaphore === 'verde') {
      return { text: `Na meta ${escopo} (≥ ${fmt(meta)}%). Ótimo sinal!`, action: null, note }
    }
    if (semaphore === 'ambar') {
      return {
        text: `Quase lá: faltam ${fmt(meta - value)} p.p. para a meta ${escopo} (${fmt(meta)}%), e você já está acima do piso (${fmt(piso)}%).`,
        action: actionFor(ACTION_COPY.ambar(`o piso (${fmt(piso)}%)`)),
        note,
      }
    }
    return {
      text: `Abaixo do piso ${escopo} (${fmt(piso)}%). A meta é ${fmt(meta)}%.`,
      action: actionFor(ACTION_COPY.vermelho),
      note,
    }
  }

  // lower_is_better: limite vermelho = red_min
  if (ref.direction === 'lower_is_better' && ref.redMin !== null) {
    const limite = ref.redMin
    if (semaphore === 'verde') {
      return { text: `Dentro do padrão ${escopo}. Bom sinal!`, action: null, note }
    }
    if (semaphore === 'ambar') {
      const pos =
        ref.p50 !== null
          ? `${value > ref.p50 ? 'acima' : 'abaixo'} da mediana ${escopo} (${fmt(ref.p50)}%) e `
          : ''
      return {
        text: `Atenção: ${pos}a ${fmt(limite - value)} p.p. do limite (${fmt(limite)}%).`,
        action: actionFor(ACTION_COPY.ambar(`o limite (${fmt(limite)}%)`)),
        note,
      }
    }
    return {
      text: `Acima do limite ${escopo} (${fmt(limite)}%).`,
      action: actionFor(ACTION_COPY.vermelho),
      note,
    }
  }

  // Direção/limites não previstos: só o semáforo, sem inventar frase.
  const label =
    semaphore === 'verde' ? 'Dentro do esperado' : semaphore === 'ambar' ? 'Atenção' : 'Fora do esperado'
  return {
    text: label,
    action: actionFor(semaphore === 'vermelho' ? ACTION_COPY.vermelho : null),
    note,
  }
}