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
// source='gestao_interna' — hoje ER Real e VPS) NUNCA gera Ação. Decisão
// centralizada em `actionFor`.
//
// ✅ RWP-4 (2026-10-08): "do setor" SÓ quando a régua é uma célula REAL de
// setor. Decisão em `hasSectorCell`, ponto único.
//
// ✅ COPY v3 (2026-10-16) — FRESCOR + FIM DO "BOM SINAL":
//   - "Bom sinal!" / "Ótimo sinal!" removidos. O card fala de UM indicador;
//     o veredito animado lia como parecer sobre a conta inteira e aparecia
//     ao lado de ER vermelho e de banner de queda. Verde agora só informa o
//     fato (na meta / dentro do padrão) com o número da régua.
//   - Novo campo opcional `dataAgeDays` (hoje − period_end do dado que
//     alimenta o card). Mesma data e mesmos cortes de data_outdated e da
//     janela de v_client_health (STALENESS_DAYS) — UMA regra de frescor.
//       · fresh/unknown: copy normal.
//       · aging  (> warn):     acrescenta "Dado de N dias."
//       · stale  (> critical): idem + remove a Ação + nota de coleta
//         antiga. Dado congelado não sustenta recomendação (ele deve gerar
//         data_outdated, não um alerta de desempenho).
//   - Campo ausente (undefined/null) = sem ressalva; chamadores antigos
//     continuam compilando e se comportando como antes (exceto o texto verde).
// ============================================================================

export type SemaphoreKey = "verde" | "ambar" | "vermelho";

export interface ScoreReference {
  value: number | null;
  semaphore: SemaphoreKey | null;
  category: string | null; // 'global' | 'all' | <setor>
  source: string | null; // 'gestao_interna' | 'category' | 'global' | ...
  direction: string | null; // 'higher_is_better' | 'lower_is_better' | ...
  greenMin: number | null;
  greenMax: number | null;
  redMin: number | null;
  redMax: number | null;
  p50: number | null;
  /** Dias entre hoje e o period_end do dado do card. Opcional. */
  dataAgeDays?: number | null;
}

export interface ScoreCopy {
  text: string;
  action: string | null;
  note: string | null;
}

const WINDOW_POSTS = 12;

// Cortes de frescor — fonte única. O avaliador de alertas (data_outdated) e
// a view de saúde devem usar estes mesmos números (>14 warning, >30 critical).
export const STALENESS_DAYS = { warn: 14, critical: 30 } as const;

export type Staleness = "unknown" | "fresh" | "aging" | "stale";

export function stalenessOf(ageDays: number | null | undefined): Staleness {
  if (ageDays == null || !Number.isFinite(ageDays)) return "unknown";
  if (ageDays > STALENESS_DAYS.critical) return "stale";
  if (ageDays > STALENESS_DAYS.warn) return "aging";
  return "fresh";
}

const ACTION_COPY = {
  vermelho: `Próximo passo: olhe os últimos ${WINDOW_POSTS} posts (formato, tema e frequência) antes de mexer em oferta ou verba.`,
  // `condicao` já vem conjugada: "cair abaixo do piso (X%)" ou "passar do limite (X%)".
  ambar: (condicao: string) =>
    `Próximo passo: acompanhe os próximos ${WINDOW_POSTS} posts. Se ${condicao}, o indicador entra no vermelho.`,
} as const;

const NO_DATA_TEXT =
  "Ainda não há posts suficientes neste período para calcular este indicador.";

const NO_REFERENCE_TEXT =
  "Este é o número da sua conta no período. Ainda não há uma referência confiável para classificá-lo, então preferimos não dar nota.";

const GESTAO_NOTE =
  "Meta provisória de gestão: um guia de trabalho, não um benchmark de mercado.";

// Sem célula de setor: a comparação é com o conjunto geral de contas.
const NO_SECTOR_NOTE =
  "Ainda não temos uma referência do seu setor para este indicador, então comparamos com o conjunto geral de contas — sem mediana do setor.";

const STALE_NOTE =
  "Esse número vem de uma coleta antiga e pode ter mudado. Atualize os dados antes de decidir com base nele.";

// Sentinelas de "sem setor" em ref_thresholds.category (D9: 'all' e 'global').
const NON_SECTOR_CATEGORIES: ReadonlySet<string> = new Set([
  "all",
  "global",
  "unclassified",
]);

const fmt = (n: number): string =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Régua de gestão provisória (não é benchmark de mercado). */
export function isGestaoReference(ref: ScoreReference): boolean {
  return ref.category === "global" && ref.source === "gestao_interna";
}

// ── Texto base (sem frescor) ────────────────────────────────────────────
// Pré-condição: value finito e semaphore != null (checado em buildScoreCopy).
function baseCopy(
  ref: ScoreReference,
  value: number,
  semaphore: SemaphoreKey,
): ScoreCopy {
  const isGestao = isGestaoReference(ref);
  // RWP-4: célula real de setor = categoria presente e que não é sentinela.
  const hasSectorCell =
    !isGestao &&
    ref.category !== null &&
    !NON_SECTOR_CATEGORIES.has(ref.category);
  const escopo = isGestao ? "de gestão" : hasSectorCell ? "do setor" : "geral";
  const note = isGestao ? GESTAO_NOTE : hasSectorCell ? null : NO_SECTOR_NOTE;

  // RWP-2: ponto único de decisão. Gestão => sem Ação, em qualquer ramo.
  const actionFor = (action: string | null): string | null =>
    isGestao ? null : action;

  // higher_is_better: meta = green_min, piso = red_max
  if (
    ref.direction === "higher_is_better" &&
    ref.greenMin !== null &&
    ref.redMax !== null
  ) {
    const meta = ref.greenMin;
    const piso = ref.redMax;
    if (semaphore === "verde") {
      return {
        text: `Na meta ${escopo} (≥ ${fmt(meta)}%).`,
        action: null,
        note,
      };
    }
    if (semaphore === "ambar") {
      return {
        text: `Quase lá: faltam ${fmt(meta - value)} p.p. para a meta ${escopo} (${fmt(meta)}%), e você já está acima do piso (${fmt(piso)}%).`,
        action: actionFor(
          ACTION_COPY.ambar(`cair abaixo do piso (${fmt(piso)}%)`),
        ),
        note,
      };
    }
    return {
      text: `Abaixo do piso ${escopo} (${fmt(piso)}%). A meta é ${fmt(meta)}%.`,
      action: actionFor(ACTION_COPY.vermelho),
      note,
    };
  }

  // lower_is_better: limite vermelho = red_min
  if (ref.direction === "lower_is_better" && ref.redMin !== null) {
    const limite = ref.redMin;
    if (semaphore === "verde") {
      return {
        text: `Dentro do padrão ${escopo} (abaixo de ${fmt(limite)}%).`,
        action: null,
        note,
      };
    }
    if (semaphore === "ambar") {
      const pos =
        hasSectorCell && ref.p50 !== null
          ? `${value > ref.p50 ? "acima" : "abaixo"} da mediana do setor (${fmt(ref.p50)}%) e `
          : "";
      return {
        text: `Atenção: ${pos}a ${fmt(limite - value)} p.p. do limite (${fmt(limite)}%).`,
        action: actionFor(
          ACTION_COPY.ambar(`passar do limite (${fmt(limite)}%)`),
        ),
        note,
      };
    }
    return {
      text: `Acima do limite ${escopo} (${fmt(limite)}%).`,
      action: actionFor(ACTION_COPY.vermelho),
      note,
    };
  }

  // Direção/limites não previstos: só o semáforo, sem inventar frase.
  const label =
    semaphore === "verde"
      ? "Dentro do esperado"
      : semaphore === "ambar"
        ? "Atenção"
        : "Fora do esperado";
  return {
    text: label,
    action: actionFor(semaphore === "vermelho" ? ACTION_COPY.vermelho : null),
    note,
  };
}

// ── Camada de frescor ───────────────────────────────────────────────────
function applyFreshness(copy: ScoreCopy, ref: ScoreReference): ScoreCopy {
  const staleness = stalenessOf(ref.dataAgeDays);
  if (staleness === "unknown" || staleness === "fresh") return copy;

  const days = Math.round(ref.dataAgeDays as number);
  const text = `${copy.text.replace(/\.?$/, ".")} Dado de ${days} dias.`;

  if (staleness === "aging") return { ...copy, text };

  // stale: congelado não sustenta recomendação.
  return {
    text,
    action: null,
    note: [STALE_NOTE, copy.note].filter(Boolean).join(" "),
  };
}

export function buildScoreCopy(ref: ScoreReference): ScoreCopy {
  const { value, semaphore } = ref;

  if (value === null || !Number.isFinite(value)) {
    return { text: NO_DATA_TEXT, action: null, note: null };
  }
  if (semaphore === null) {
    return { text: NO_REFERENCE_TEXT, action: null, note: null };
  }

  return applyFreshness(baseCopy(ref, value, semaphore), ref);
}
