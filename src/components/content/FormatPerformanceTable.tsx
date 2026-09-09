/* ==========================================================================
   ORBIT · Component — FormatPerformanceTable
   Tabela: FORMATO · POSTS · SHARES · TREND (com StatusPill), expansível por
   linha para mostrar os posts individuais daquele formato.
   Versão: 2.2.0  |  Data: 2026-09-06

   MUDANÇA v2.2.0 (campo calculado exposto):
   - `PostSummary.isBoostCandidate` existe desde 06/09/2026: validado por
     Zod em PostRowRawSchema, mapeado pelo repository
     (`isBoostCandidate: post.is_boost_candidate ?? false`) — pipeline
     completo, banco → tipo → mapper. Nunca chegava a renderizar em lugar
     nenhum: o motor de boost decidia e a tela escondia a decisão.
   - PostDetailRow agora mostra um badge "Boost" quando
     `post.isBoostCandidate === true`. Reusado por
     FormatPerformanceTable.v2.tsx (FilterableFormatPerformanceTable) sem
     mudança nenhuma no arquivo v2 — mesmo ponto único de renderização de
     post, corrigido uma vez só.
   - Sem "e se for false" ambíguo: campo é `boolean` não-nulo (mapper já
     aplica `?? false`), então a única decisão de UI é mostrar/esconder o
     badge — nunca um terceiro estado.

   MUDANÇA v2.1.2 (fix de compilação):
   - Adicionada prop opcional `expandable?: boolean` (default true). Os call
     sites em src/app/instagram/page.tsx (e outro arquivo espelhado,
     src/page.tsx, fora deste pacote) já chamavam
     `<FormatPerformanceTable expandable={false} />` seguindo a integração
     "Opção B" sugerida em Estratégia Híbrida — Patches + Componente Lean,
     mas a prop nunca tinha sido implementada no componente de verdade,
     só na proposta em markdown. Agora `expandable={false}` desativa o
     accordion de verdade (canExpand = false), em vez de só compilar.

   MUDANÇA v2.1.1 (patches de UX — sem alterar contrato de dados):
   - FIX .postCaption: `flex: 2` → `flex: 0 1 480px` (module.css). Era o
     único item com flex-grow na linha, então sempre esticava até preencher
     o espaço livre, deixando um vão vazio antes do % em captions curtas.
   - Score de post agora vem rotulado ("Polêmica: 33.3%" em vez de "33.3%"
     solto, sem unidade nem contexto).
   - truncateCaption() e PostDetailRow agora exportados — usados também por
     FormatPerformanceTable.v2.tsx (FilterableFormatPerformanceTable), pra
     não duplicar a lógica de truncamento com um número mágico diferente.

   MUDANÇA v2.1.0:
   - PostDetailRow agora exibe caption do post (se disponível)
   - Caption aparece com tooltip (title) para posts com texto longo
   - Layout: Data | Likes/Comments | Caption | Score Polêmica
   - CSS: .postCaption com truncamento, hover e dotted border

   MUDANÇA v2.0.0:
   - Linha por formato agora expande (clique/chevron) mostrando
     postsDetail[] — data, likes, comments, Score Polêmica.
   - Ícone por formato (SVG inline, sem dependência nova).
   - Score Polêmica só aparece quando likes E comments existem — nunca
     mostra número inventado. Sem likes → "sem likes".
   - postsDetail já vem filtrado por confidence_level (L0/L1) no repository
     (fetchPostsByFormat) — a contagem do card e o tamanho da lista expandida
     usam a mesma régua, não divergem (ORB-DEBT revisado, ver ledger).
   - trend_label/trend_color continuam vindos direto da view — ainda
     hardcoded no banco ('Estável'/'gold'), fora do escopo deste componente
     (ORB-DEBT-047, registrado, não resolvido aqui).
   ========================================================================== */

'use client'

import React, { useState } from 'react'
import { StatusPill } from '@/components/common/StatusPill'
import styles from './FormatPerformanceTable.module.css'
import type { FormatPerformanceRow, PostSummary } from '@/types/orbit'

export interface FormatPerformanceTableProps {
  rows: FormatPerformanceRow[]
  /**
   * Quando `false`, desativa o accordion por completo: nenhuma linha expande,
   * chevron não aparece, clique não faz nada — usado na Visão Geral pra
   * mostrar só os agregados por formato, sem o drill-down de posts.
   * Default: `true` (comportamento atual, sem mudança pra quem já usa o
   * componente sem passar essa prop).
   */
  expandable?: boolean
}

const FORMAT_ICON: Record<string, React.ReactNode> = {
  Reels: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8.5 8.2v3.6l3-1.8-3-1.8Z" fill="currentColor"/>
    </svg>
  ),
  Estático: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="7.3" cy="7.3" r="1.1" fill="currentColor"/>
      <path d="M4.5 13.5 8 10l2.5 2.5L14 9l1.5 1.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </svg>
  ),
  Carrossel: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="11" height="11" rx="1.3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M16 6.5v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
}

function DefaultIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

function BoostIcon() {
  return (
    <svg viewBox="0 0 20 20" width="11" height="11" fill="none" aria-hidden="true">
      <path
        d="M10 2.5c-2.8 2-4.2 4.8-4.2 7.8 0 1.5.4 2.7 1 3.7L5 16.7l2.4-.8c.9.5 1.9.8 2.6.8s1.7-.3 2.6-.8l2.4.8-1.8-2.7c.6-1 1-2.2 1-3.7 0-3-1.4-5.8-4.2-7.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9" r="1.4" fill="currentColor" />
    </svg>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * ✅ v2.3.0: teto de segurança, não mais a truncagem "de verdade".
 * Antes (maxLength=60) este corte acontecia SEMPRE, independente de
 * quanto espaço de tela existia — e o CSS reservava uma caixa de largura
 * fixa (480px) pra um texto que quase nunca chegava perto disso. Duas
 * truncagens pra suposições diferentes, uma delas cega ao layout real.
 *
 * Agora quem decide onde cortar visualmente é o CSS (.postCaption com
 * `overflow:hidden; text-overflow:ellipsis` numa coluna de grid
 * `minmax(0, 1fr)`, que preenche exatamente o espaço disponível) —
 * responsivo, sem número mágico de caracteres. Este maxLength só existe
 * pra não jogar uma string de milhares de caracteres pro DOM/title numa
 * legenda patologicamente longa; 220 é uma folga generosa acima de
 * qualquer coluna real, não um limite visual.
 */
export function truncateCaption(caption: string | null | undefined, maxLength: number = 220): string {
  if (!caption || caption.trim().length === 0) return '—'
  if (caption.length <= maxLength) return caption
  return `${caption.substring(0, maxLength)}…`
}

/**
 * ✅ PostDetailRow — Data | Likes/Comments | Caption | Score Polêmica | Boost
 *
 * Ponto único de renderização de post individual: usado tanto por
 * FormatPerformanceTable (v1) quanto por FilterableFormatPerformanceTable
 * (v2). Qualquer campo novo de PostSummary que precise aparecer na UI entra
 * aqui uma vez só — nunca duplicado entre os dois arquivos.
 */
export function PostDetailRow({ post }: { post: PostSummary }) {
  const hasScore = post.likes != null && post.likes > 0 && post.comments != null
  const captionDisplay = truncateCaption(post.caption)

  return (
    <div className={styles.postRow}>
      {/* Data do post */}
      <span className={styles.postDate}>{formatDate(post.publishedAt)}</span>

      {/* Likes e Comments */}
      <span className={styles.postMetrics}>
        {post.likes != null ? `${post.likes} likes` : 'sem likes'}
        {post.comments != null ? ` · ${post.comments} comments` : ''}
      </span>

      {/* Caption com tooltip */}
      <span
        className={styles.postCaption}
        title={post.caption || 'Sem legenda'}
      >
        {captionDisplay}
      </span>

      {/* ✅ v2.3.0: slot de largura FIXA no grid, sempre renderizado —
          com ou sem o badge dentro. Antes o badge era um item condicional
          dentro de um flex row, então sua ausência/presença deslocava
          .postScore horizontalmente entre uma linha com Boost e outra
          sem; "Polêmica: X%" não alinhava na coluna. O slot resolve isso:
          o grid sempre reserva a mesma largura pra essa célula, o badge
          só decide se pinta algo dentro dela ou não. */}
      <span className={styles.postBoostSlot}>
        {post.isBoostCandidate && (
          <span className={styles.postBoostBadge} title="Candidato a impulsionamento (Boost)">
            <BoostIcon />
            Boost
          </span>
        )}
      </span>

      {/* Score Polêmica — rotulado (antes era só "33.3%" sem contexto) */}
      <span className={hasScore ? styles.postScore : styles.postScoreMuted}>
        {hasScore ? `Polêmica: ${post.polemicScorePct?.toFixed(1)}%` : '—'}
      </span>
    </div>
  )
}

export function FormatPerformanceTable({ rows, expandable = true }: FormatPerformanceTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>PERFORMANCE POR FORMATO</p>

      <table className={styles.table} aria-label="Performance por formato">
        <thead>
          <tr>
            <th className={styles.th}></th>
            <th className={styles.th}>FORMATO</th>
            <th className={styles.th}>POSTS</th>
            <th className={styles.th}>SHARES</th>
            <th className={styles.th}>SAVES</th>
            <th className={styles.th}>TREND</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expandedId === row.id
            const canExpand = expandable && row.postsDetail.length > 0

            return (
              <React.Fragment key={row.id}>
                <tr
                  className={[styles.tr, canExpand ? styles.trClickable : ''].join(' ')}
                  onClick={() => canExpand && setExpandedId(isExpanded ? null : row.id)}
                >
                  <td className={styles.tdChevron}>
                    {canExpand && (
                      <svg
                        viewBox="0 0 20 20"
                        width="14"
                        height="14"
                        fill="none"
                        aria-hidden="true"
                        className={isExpanded ? styles.chevronOpen : styles.chevron}
                      >
                        <path
                          d="M7 5.5 12 10l-5 4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </td>
                  <td className={[styles.td, styles.tdFormat].join(' ')}>
                    <span className={styles.formatIcon}>
                      {FORMAT_ICON[row.format] ?? <DefaultIcon />}
                    </span>
                    {row.format}
                  </td>
                  <td className={styles.td}>{row.posts}</td>
                  <td className={styles.td}>{row.shares}</td>
                  <td className={styles.td}>{row.saves}</td>
                  <td className={styles.td}>
                    <StatusPill text={row.trendLabel} color={row.trendColor} />
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={6} className={styles.tdDetail}>
                      <div className={styles.postList}>
                        {row.postsDetail.map((post) => (
                          <PostDetailRow key={post.id} post={post} />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}