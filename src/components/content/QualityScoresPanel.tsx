/* ==========================================================================
   ORBIT · Component — QualityScoresPanel
   Painel de scores de qualidade de conteúdo (Overview)
   Versão: 1.0.5  |  Data: 2026-10-05

   MUDANÇA v1.0.5 (RWP-1 + fix TS2322):
   - RWP-1: filtro por regex normalizada sobre id E label oculta o tile
     Utilidade e o Play-to-view do Overview. Só afeta a renderização —
     o array `scores` não é mutado (dados em memória intactos).
   - TS2322 ×8: CSS Modules são tipados como { [key: string]: string }; com
     noUncheckedIndexedAccess cada `styles.x` vira `string | undefined`.
     Helper `cls()` resolve com fallback '' e devolve sempre `string`.
   - Mapas agora cobrem TODO o GlowColor (faltava 'green').
   - Tipos importados de orbit.ts (GlowColor, StatusVariant) em vez de
     derivados por indexação.
   ========================================================================== */

import { GlassCard }     from '@/components/common/GlassCard'
import { GlowingNumber } from '@/components/kpi/GlowingNumber'
import styles            from './QualityScoresPanel.module.css'
import type {
  GlowColor,
  QualityScoreItem,
  StatusVariant,
} from '@/types/orbit'

export interface QualityScoresPanelProps {
  scores: QualityScoreItem[]
}

/* ═══════════════════════════════════════════════════════════════
   CSS MODULE — acesso tipado seguro
   ═══════════════════════════════════════════════════════════════ */

/**
 * Resolve uma classe do CSS Module garantindo `string`.
 * Com noUncheckedIndexedAccess, `styles[name]` é `string | undefined`;
 * o `?? ''` elimina o undefined (classe ausente = nenhuma classe aplicada).
 */
function cls(name: string): string {
  return styles[name] ?? ''
}

/* ═══════════════════════════════════════════════════════════════
   MAPAS — GlowColor → classes (cobertura total do union)
   ═══════════════════════════════════════════════════════════════ */

const GLOW_COLOR_CLASS_MAP: Record<GlowColor, string> = {
  cyan:  cls('boxCyan'),
  red:   cls('boxRed'),
  gold:  cls('boxGold'),
  green: cls('boxGreen'),
  none:  cls('boxNeutral'),
}

const GLOW_COLOR_STATUS_MAP: Record<GlowColor, string> = {
  cyan:  cls('statusOk'),
  gold:  cls('statusWarn'),
  red:   cls('statusDanger'),
  green: cls('statusSuccess'),
  none:  cls('statusNeutral'),
}

const STATUS_ICON: Record<StatusVariant, string> = {
  ok: '▲',
  warn: '▲',
  neutral: '—',
}

/* ═══════════════════════════════════════════════════════════════
   RWP-1 — FILTRO DE SCORES OCULTOS NO OVERVIEW
   ═══════════════════════════════════════════════════════════════ */

/**
 * Normaliza texto para comparação: minúsculas, sem acentos e com qualquer
 * sequência não alfanumérica convertida em espaço único.
 *   'Play-to-View'      → 'play to view'
 *   'play_to_view_ratio'→ 'play to view ratio'
 *   'Score Utilidade'   → 'score utilidade'
 */
function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Padrões de scores ocultos no Overview (RWP-1 / KCR-C5).
 * - utilidade | utility → tile Utilidade (inclui utility_score_pct).
 * - play to view | playtoview → Play-to-view (KCR-C2: só em
 *   FormatPerformanceTable, por post).
 * `\b` evita falso positivo por substring.
 * Para ocultar outro score, adicione um padrão aqui.
 */
const HIDDEN_SCORE_PATTERNS: readonly RegExp[] = [
  /\butil(?:idade|ity)\b/,
  /\bplay ?to ?view\b/,
]

function isHiddenText(text: string): boolean {
  const normalized = normalizeForMatch(text)
  return HIDDEN_SCORE_PATTERNS.some((pattern) => pattern.test(normalized))
}

/** Um score é visível se NEM o id NEM o label casam com padrão oculto. */
function isScoreVisible(score: QualityScoreItem): boolean {
  return !isHiddenText(score.id) && !isHiddenText(score.label)
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS DE CLASSE
   ═══════════════════════════════════════════════════════════════ */

function getScoreBoxClass(glowColor: GlowColor): string {
  return GLOW_COLOR_CLASS_MAP[glowColor]
}

function getStatusClass(glowColor: GlowColor): string {
  return GLOW_COLOR_STATUS_MAP[glowColor]
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE
   ═══════════════════════════════════════════════════════════════ */

export function QualityScoresPanel({ scores }: QualityScoresPanelProps) {
  // RWP-1: filtra só na renderização; `scores` não é alterado.
  const visibleScores = scores.filter(isScoreVisible)

  return (
    <GlassCard glowColor="cyan" className={styles.panel}>
      <p className={styles.panelTitle}>SCORES DE QUALIDADE DE CONTEÚDO</p>

      <div className={styles.grid}>
        {visibleScores.map((score) => (
          <div
            key={score.id}
            className={[styles.scoreBox, getScoreBoxClass(score.glowColor)].join(' ')}
          >
            <p className={styles.scoreLabel}>{score.label}</p>

            <div className={styles.scoreValue}>
              {typeof score.value === 'number' ? (
                <GlowingNumber
                  value={score.value}
                  unit={score.unit}
                  color={score.glowColor}
                  size="md"
                />
              ) : (
                <span className={styles.naValue}>{score.value}</span>
              )}
            </div>

            <p
              className={[
                styles.statusText,
                getStatusClass(score.glowColor),
              ].join(' ')}
            >
              {STATUS_ICON[score.statusVariant]} {score.statusText}
            </p>

            {score.actionText && (
              <p className={styles.actionText}>{score.actionText}</p>
            )}

            {score.referenceNote && (
              <p className={styles.referenceNote}>{score.referenceNote}</p>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}