/* ==========================================================================
 ORBIT · Component — FormatPerformanceTable
 Tabela: FORMATO · POSTS · SHARES · TREND (com StatusPill), expansível por
 linha para mostrar os posts individuais daquele formato.
 Versão: 2.1.0  |  Data: 2026-09-06

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
// ✅ NOVO 06/09/2026: a mesma tabela é usada em dois lugares — Visão Geral
// (deve ser só um resumo, sem expandir) e Por post (expande e mostra
// caption/boost de cada post). `expandable=false` desliga o clique, o
// chevron e a linha de detalhe — sem duplicar o componente inteiro.
// Default `true` preserva o comportamento existente em "Por post".
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

function formatDate(iso: string): string {
const d = new Date(iso)
return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * ✅ Trunca caption para exibição — mostra primeiras 60 caracteres
 * Caption completo fica no title (tooltip)
 */
function truncateCaption(caption: string | null | undefined, maxLength: number = 60): string {
if (!caption || caption.trim().length === 0) return '—'
if (caption.length <= maxLength) return caption
return `${caption.substring(0, maxLength)}…`
}

/**
 * ✅ PostDetailRow agora inclui caption
 * Layout: Data | Likes/Comments | Caption | Score Polêmica
 */
function PostDetailRow({ post }: { post: PostSummary }) {
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

    {/* ✅ NOVO v2.1.0: Caption com tooltip */}
    <span
      className={styles.postCaption}
      title={post.caption || 'Sem legenda'}
    >
      {captionDisplay}
    </span>

    {/* ✅ NOVO 06/09/2026: is_boost_candidate já calculado no banco, mas
        nunca aparecia na tela — o post ficava marcado só no Supabase. */}
    {post.isBoostCandidate && (
      <span className={styles.boostBadge} title="Candidato a impulsionamento">
        🚀 Boost
      </span>
    )}

    {/* Score Polêmica */}
    <span className={hasScore ? styles.postScore : styles.postScoreMuted}>
      {hasScore ? `${post.polemicScorePct?.toFixed(1)}%` : '—'}
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
          <th className={styles.th}>TREND</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isExpanded = expandable && expandedId === row.id
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
                <td className={styles.td}>
                  <StatusPill text={row.trendLabel} color={row.trendColor} />
                </td>
              </tr>

              {isExpanded && (
                <tr>
                  <td colSpan={5} className={styles.tdDetail}>
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