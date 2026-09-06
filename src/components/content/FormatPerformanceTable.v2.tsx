/* ==========================================================================
   ORBIT · Component — FilterableFormatPerformanceTable (v2)
   Versão: 1.0.0  |  Data: 2026-09-06

   Objetivo: adicionar busca, ordenação e status por post, e permitir
   múltiplos formatos expandidos ao mesmo tempo — sem quebrar o contrato
   de dados existente (FormatPerformanceRow[]) e sem redigitar trabalho
   que o backend já faz.

   Correções em relação à proposta original ("Estratégia Híbrida —
   Patches + Componente Lean.tsx" / "Demo Interativa — Novo vs Antigo.tsx"):

   1. ❌ REMOVIDO: ordenar por "Posts" e "Shares" por post individual.
      PostSummary não tem esses campos — cada post é sempre 1 post, e
      `shares` é agregado só a nível de conta (ver SharesSummary.source =
      'account_aggregate' em src/types/orbit.ts — nunca distribuído por
      post). A demo só "funcionava" porque os dados mock inventavam esses
      dois campos por post; contra o repository real isso seria um sort
      sempre nulo. Sobrou Data e Polêmica, que são os únicos dois campos
      ordenáveis que existem de fato em PostSummary.

   2. ❌ REMOVIDO: flatten de todos os posts + reconstrução do agrupamento
      via `rows.find(r => r.postsDetail.some(p => p.id === post.id))`.
      `row.postsDetail` já vem agrupado por formato desde
      fetchPostsByFormat() no repository — filtrar/ordenar acontece AQUI,
      dentro de cada grupo já existente, sem recriar o que o backend já
      entregou pronto.

   3. ❌ REMOVIDO: thresholds de status (30/60) soltos e duplicados.
      Centralizados em POLEMIC_ATTENTION_MIN / POLEMIC_CRITICAL_MIN com
      nota explicando por que não dá pra chamar classifyMetric() (RPC
      assíncrona do Postgres) direto num useMemo client-side.

   4. ❌ REMOVIDO: cores hardcoded (#ff4444 etc). Reusa GlowColor +
      SEVERITY_TO_GLOW + <StatusPill>, o mesmo vocabulário de cor que o
      resto do dashboard já usa (StatusPill.tsx / orbit.ts).

   5. ❌ REMOVIDO: truncamento de caption duplicado (substring(0,40) na
      demo vs truncateCaption(caption,60) no componente real). Reusa
      truncateCaption + PostDetailRow exportados de FormatPerformanceTable.

   6. ✅ ADICIONADO: <label> associado a cada input/select do FilterBar
      (a demo só tinha placeholder — falha WCAG, o mesmo tipo de problema
      que o dashboard já corrigiu em Acessibilidade — Contraste).

   7. ✅ CORRIGIDO: post sem polemicScorePct (null) nunca aparece marcado
      como "OK" — antes (getStatus da demo) `null >= 60` e `null >= 30`
      avaliam false em JS, então um post sem dado virava "✓ OK" por
      acidente. Aqui, status null fica fora dos filtros ok/atenção/crítico
      e nunca ganha um <StatusPill> enganoso.
   ========================================================================== */

'use client'

import { useId, useMemo, useState } from 'react'
import { StatusPill } from '@/components/common/StatusPill'
import { PostDetailRow } from './FormatPerformanceTable'
import tableStyles from './FormatPerformanceTable.module.css'
import styles from './FormatPerformanceTable.v2.module.css'
import { SEVERITY_TO_GLOW, type GlowColor } from '@/types/orbit'
import type { FormatPerformanceRow, PostSummary } from '@/types/orbit'

export interface FilterableFormatPerformanceTableProps {
  rows: FormatPerformanceRow[]
}

type SortBy = 'date' | 'polemic'
type StatusFilter = 'all' | 'ok' | 'warning' | 'critical'

// ── Fonte única dos limiares de "Polêmica" ──────────────────────────────
// Idealmente isso viria classificado do backend, como já acontece pra
// polemicScore agregado em SectorPositioning (via classifyMetric() /
// fn_classify_metric). Mas classifyMetric() é uma RPC assíncrona do
// Postgres — não dá pra chamar por post dentro de um useMemo client-side
// sem um round-trip por linha. Até o dia em que `postsDetail` vier com o
// campo já classificado, os limiares ficam centralizados aqui, com nome,
// em vez de espalhados como "30" e "60" soltos em dois arquivos.
const POLEMIC_ATTENTION_MIN = 30
const POLEMIC_CRITICAL_MIN = 60

interface PolemicStatus {
  text: string
  glow: GlowColor
  filterKey: Exclude<StatusFilter, 'all'>
}

export function classifyPolemic(pct: number | null): PolemicStatus | null {
  if (pct == null) return null
  if (pct >= POLEMIC_CRITICAL_MIN) {
    return { text: 'Crítico', glow: SEVERITY_TO_GLOW.danger, filterKey: 'critical' }
  }
  if (pct >= POLEMIC_ATTENTION_MIN) {
    return { text: 'Atenção', glow: SEVERITY_TO_GLOW.warning, filterKey: 'warning' }
  }
  return { text: 'OK', glow: SEVERITY_TO_GLOW.success, filterKey: 'ok' }
}

export function matchesStatusFilter(pct: number | null, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  const status = classifyPolemic(pct)
  // Sem dado nunca "passa" num filtro de status específico — evita
  // classificar silêncio de dado como se fosse "OK".
  if (!status) return false
  return status.filterKey === filter
}

// ─────────────────────────────────────────────────────────────────────────
// FilterBar
// ─────────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  sortBy: SortBy
  onSortChange: (value: SortBy) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  resultCount: number
}

function FilterBar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  resultCount,
}: FilterBarProps) {
  const searchId = useId()
  const sortId = useId()
  const statusId = useId()

  return (
    <div className={styles.filterBar}>
      <div className={styles.field}>
        <label className={styles.visuallyHiddenLabel} htmlFor={searchId}>
          Buscar por legenda do post
        </label>
        <input
          id={searchId}
          type="text"
          placeholder="Buscar legenda…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.visuallyHiddenLabel} htmlFor={sortId}>
          Ordenar posts por
        </label>
        <select
          id={sortId}
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
          className={styles.select}
        >
          <option value="date">Ordenar: Data</option>
          <option value="polemic">Ordenar: Polêmica</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.visuallyHiddenLabel} htmlFor={statusId}>
          Filtrar por status de polêmica
        </label>
        <select
          id={statusId}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className={styles.select}
        >
          <option value="all">Status: Todos</option>
          <option value="ok">Status: OK</option>
          <option value="warning">Status: Atenção</option>
          <option value="critical">Status: Crítico</option>
        </select>
      </div>

      <div className={styles.resultCount} aria-live="polite">
        {resultCount} {resultCount === 1 ? 'post' : 'posts'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// FormatGroup — mesma linha/estrutura do v1, mas com expand independente
// por formato (Set em vez de string|null) e a lista já filtrada/ordenada.
// ─────────────────────────────────────────────────────────────────────────

interface FormatGroupProps {
  row: FormatPerformanceRow
  visiblePosts: PostSummary[]
  isExpanded: boolean
  onToggle: () => void
}

function FormatGroup({ row, visiblePosts, isExpanded, onToggle }: FormatGroupProps) {
  const canExpand = visiblePosts.length > 0

  return (
    <div className={styles.group}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!canExpand}
        aria-expanded={isExpanded}
        className={styles.groupHeader}
      >
        <span
          className={isExpanded ? tableStyles.chevronOpen : tableStyles.chevron}
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
            <path
              d="M7 5.5 12 10l-5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.groupTitle}>{row.format}</span>
        <span className={styles.groupCount}>
          {visiblePosts.length} {visiblePosts.length === 1 ? 'post' : 'posts'}
        </span>
        <StatusPill text={row.trendLabel} color={row.trendColor} />
      </button>

      {isExpanded && canExpand && (
        <div className={tableStyles.postList}>
          {visiblePosts.map((post) => (
            <PostDetailRow key={post.id} post={post} />
          ))}
        </div>
      )}

      {!canExpand && (
        <p className={styles.groupEmpty}>Nenhum post corresponde ao filtro atual.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

export function FilterableFormatPerformanceTable({
  rows,
}: FilterableFormatPerformanceTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.id))
  )

  // ✅ Filtra e ordena DENTRO de cada grupo já existente. Sem flatMap, sem
  // reconstrução de "a que formato pertence esse post" — row.postsDetail
  // já é a lista certa, o repository já fez esse trabalho.
  const visiblePostsByRow = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return new Map<string, PostSummary[]>(
      rows.map((row) => {
        const filtered = row.postsDetail.filter((post) => {
          const matchesSearch = q === '' || (post.caption ?? '').toLowerCase().includes(q)
          return matchesSearch && matchesStatusFilter(post.polemicScorePct, statusFilter)
        })

        const sorted = [...filtered].sort((a, b) => {
          if (sortBy === 'date') {
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          }
          // sortBy === 'polemic' — posts sem score vão pro fim, não pro
          // meio (nunca tratamos "sem dado" como "0%" fabricado).
          if (a.polemicScorePct == null && b.polemicScorePct == null) return 0
          if (a.polemicScorePct == null) return 1
          if (b.polemicScorePct == null) return -1
          return b.polemicScorePct - a.polemicScorePct
        })

        return [row.id, sorted] as const
      })
    )
  }, [rows, searchQuery, sortBy, statusFilter])

  const totalVisible = useMemo(
    () => Array.from(visiblePostsByRow.values()).reduce((sum, list) => sum + list.length, 0),
    [visiblePostsByRow]
  )

  const hasActiveFilter = searchQuery.trim() !== '' || statusFilter !== 'all'

  const toggleRow = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={styles.wrapper}>
      <p className={tableStyles.title}>PERFORMANCE POR FORMATO</p>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        resultCount={totalVisible}
      />

      {totalVisible === 0 && hasActiveFilter ? (
        <div className={styles.emptyState}>Nenhum post encontrado para esse filtro.</div>
      ) : (
        rows.map((row) => (
          <FormatGroup
            key={row.id}
            row={row}
            visiblePosts={visiblePostsByRow.get(row.id) ?? []}
            isExpanded={expandedIds.has(row.id)}
            onToggle={() => toggleRow(row.id)}
          />
        ))
      )}
    </div>
  )
}