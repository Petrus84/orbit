"use client";

import React, { useState } from "react";
import { StatusPill } from "@/components/common/StatusPill";
import styles from "./FormatPerformanceTable.module.css";
import { SEVERITY_TO_GLOW, type GlowColor } from "@/types/orbit";
import type { FormatPerformanceRow, PostSummary } from "@/types/orbit";
import { formatPtBr } from "@/lib/format";
import { provenanceLine } from "@/lib/provenanceText";
import { CONFIANCA } from "@/lib/ui-labels";
import type { MetricProvenance } from "@/types/orbit";

// RN-23: proveniência da tabela. Posts, interações e tendência vêm de ig_posts
// no cabeçalho (mesma população e janela).
const COUNTS_PROVENANCE: MetricProvenance = {
  source: "cálculo feito post a post",
  period: "header_window",
  method:
    "posts por formato no período escolhido; interações = curtidas + comentários + compartilhamentos + salvamentos nos posts com os quatro valores; mínimo 5 posts por formato",
};
const TREND_PROVENANCE: MetricProvenance = {
  source: "cálculo feito post a post",
  period: "header_window",
  method:
    "compara a mediana de curtidas + comentários da metade mais recente dos posts do formato com a da metade mais antiga; a seta muda quando a diferença passa de 15%; exige 3 posts com os dois valores em cada metade e mínimo de 5 posts no formato. Não usa a nota de utilidade",
};

export interface FormatPerformanceTableProps {
  rows: FormatPerformanceRow[];
  expandable?: boolean;
}

type StatusFilter = "all" | "ok" | "warning" | "critical";

interface PolemicStatus {
  text: string;
  glow: GlowColor;
  filterKey: Exclude<StatusFilter, "all">;
}

const POLEMIC_ATTENTION_MIN = 30;
const POLEMIC_CRITICAL_MIN = 60;

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const FORMAT_ICON: Record<string, React.ReactNode> = {
  Reels: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M8.5 8.2v3.6l3-1.8-3-1.8Z" fill="currentColor" />
    </svg>
  ),
  Estático: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="3.5"
        width="13"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="7.3" cy="7.3" r="1.1" fill="currentColor" />
      <path
        d="M4.5 13.5 8 10l2.5 2.5L14 9l1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  ),
  Carrossel: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="4.5"
        width="11"
        height="11"
        rx="1.3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M16 6.5v7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
};

function DefaultIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="3.5"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function BoostIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="11"
      height="11"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 2.5c-2.8 2-4.2 4.8-4.2 7.8 0 1.5.4 2.7 1 3.7L5 16.7l2.4-.8c.9.5 1.9.8 2.6.8s1.7-.3 2.6-.8l2.4.8-1.8-2.7c.6-1 1-2.2 1-3.7 0-3-1.4-5.8-4.2-7.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9" r="1.4" fill="currentColor" />
    </svg>
  );
}

function dateParts(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
    month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
  };
}

export function truncateCaption(
  caption: string | null | undefined,
  maxLength: number = 220,
): string {
  if (!caption || caption.trim().length === 0) return "—";
  if (caption.length <= maxLength) return caption;
  return `${caption.substring(0, maxLength)}…`;
}

export function classifyPolemic(pct: number | null): PolemicStatus | null {
  if (pct == null) return null;
  if (pct >= POLEMIC_CRITICAL_MIN) {
    return {
      text: "Crítico",
      glow: SEVERITY_TO_GLOW.danger,
      filterKey: "critical",
    };
  }
  if (pct >= POLEMIC_ATTENTION_MIN) {
    return {
      text: "Atenção",
      glow: SEVERITY_TO_GLOW.warning,
      filterKey: "warning",
    };
  }
  return { text: "OK", glow: SEVERITY_TO_GLOW.success, filterKey: "ok" };
}

// Legenda maior que isso ganha "ver mais" (2 linhas por padrão).
const CAPTION_CLAMP_MIN = 110;

const fmtSec = (v: number): string =>
  `${formatPtBr(v, Number.isInteger(v) ? 0 : 1)} s`;

const METER_CLASS: Record<PolemicStatus["filterKey"], string> = {
  ok: styles.meterOk ?? "",
  warning: styles.meterWarning ?? "",
  critical: styles.meterCritical ?? "",
};

/**
 * Uma linha de post = uma grade de colunas (data · post · curtidas ·
 * comentários · polêmica · repr./visual. · tempo assistido). Rótulos vivem no
 * cabeçalho da lista, não repetidos em cada linha. `showRatio`/`showWatch`
 * vêm da lista (a coluna some se NENHUM post do formato tem o dado); sem a
 * lista, cada linha decide pelo próprio post.
 */
export function PostDetailRow({
  post,
  showRatio,
  showWatch,
}: {
  post: PostSummary;
  showRatio?: boolean;
  showWatch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasScore =
    post.likes != null && post.likes > 0 && post.comments != null;
  const polemic =
    hasScore && post.polemicScorePct != null
      ? classifyPolemic(post.polemicScorePct)
      : null;
  const avg = post.avgWatchSec ?? null;
  const hasWatch = avg != null;
  const ratioOn = showRatio ?? post.playToViewRatio != null;
  const watchOn = showWatch ?? hasWatch;
  const caption = truncateCaption(post.caption, 1200);
  const isLong = caption.length > CAPTION_CLAMP_MIN;
  const { day, month } = dateParts(post.publishedAt);
  const ret = post.retentionPct ?? null;
  const dur = post.durationSec ?? null;

  const watchLabel =
    avg != null
      ? `Tempo assistido: ${fmtSec(avg)}${dur != null ? ` de ${fmtSec(dur)}` : ""} (${CONFIANCA.L0})${
          ret != null
            ? ` · retenção ${formatPtBr(ret, 0)}% (${CONFIANCA.L1})`
            : ""
        }`
      : undefined;

  return (
    <div
      className={[
        styles.postRow,
        post.isBoostCandidate ? styles.postRowBoost : "",
      ].join(" ")}
      role="row"
    >
      <span className={styles.cDate} role="cell">
        <span className={styles.dateDay}>{day}</span>
        <span className={styles.dateMonth}>{month}</span>
      </span>

      <span className={styles.cPost} role="cell">
        {post.isBoostCandidate && (
          <span
            className={styles.postBoostBadge}
            title="Candidato a impulsionamento (Boost)"
          >
            <BoostIcon />
            Boost
          </span>
        )}
        <span
          className={[
            styles.caption,
            isLong && !open ? styles.captionClamp : "",
          ].join(" ")}
        >
          {caption}
        </span>
        {isLong && (
          <button
            type="button"
            className={styles.moreBtn}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "ver menos" : "ver mais"}
          </button>
        )}
      </span>

      <span
        className={[styles.cNum, styles.cLikes].join(" ")}
        role="cell"
        data-label="Curtidas"
      >
        {post.likes != null ? (
          <span className={post.likes === 0 ? styles.numZero : styles.num}>
            {post.likes.toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className={styles.numNone} title="Curtidas não informadas">
            —
          </span>
        )}
      </span>

      <span
        className={[styles.cNum, styles.cComments].join(" ")}
        role="cell"
        data-label="Comentários"
      >
        {post.comments != null ? (
          <span className={post.comments === 0 ? styles.numZero : styles.num}>
            {post.comments.toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className={styles.numNone} title="Comentários não informados">
            —
          </span>
        )}
      </span>

      <span className={styles.cPolemic} role="cell" data-label="Polêmica">
        {post.polemicScorePct != null && hasScore ? (
          <>
            <span
              className={[
                styles.num,
                polemic?.filterKey === "critical"
                  ? styles.polCritical
                  : polemic?.filterKey === "warning"
                    ? styles.polWarning
                    : "",
              ].join(" ")}
            >
              {`${formatPtBr(post.polemicScorePct, 1)}%`}
            </span>
            <span className={styles.meter} aria-hidden="true">
              <span
                className={[
                  styles.meterFill,
                  METER_CLASS[polemic?.filterKey ?? "ok"],
                ].join(" ")}
                style={{ width: `${Math.min(100, post.polemicScorePct)}%` }}
              />
            </span>
          </>
        ) : (
          <span className={styles.numNone}>—</span>
        )}
      </span>

      {ratioOn && (
        <span
          className={[styles.cNum, styles.cRatio].join(" ")}
          role="cell"
          data-label="Repr./visual."
        >
          {post.playToViewRatio != null ? (
            <span
              className={styles.num}
              title={`Reproduções por visualização: ${formatPtBr(post.playToViewRatio, 2)}`}
            >
              {`${formatPtBr(post.playToViewRatio, 2)}×`}
            </span>
          ) : (
            <span className={styles.numNone}>—</span>
          )}
        </span>
      )}

      {watchOn && (
        <span
          className={styles.cWatch}
          role="cell"
          data-label="Tempo assistido"
          title={watchLabel}
        >
          {avg != null ? (
            <>
              <span className={styles.watchTime}>
                {fmtSec(avg)}
                {dur != null && (
                  <span className={styles.watchOf}>{` de ${fmtSec(dur)}`}</span>
                )}
              </span>
              {ret != null && (
                <span className={styles.watchRet}>
                  <span className={styles.meter} aria-hidden="true">
                    <span
                      className={[styles.meterFill, styles.meterRet].join(" ")}
                      style={{ width: `${Math.max(0, Math.min(100, ret))}%` }}
                    />
                  </span>
                  <span className={styles.watchRetText}>
                    {`${formatPtBr(ret, 0)}%`}
                  </span>
                </span>
              )}
            </>
          ) : (
            <span className={styles.numNone}>—</span>
          )}
        </span>
      )}
    </div>
  );
}

function PostList({ posts }: { posts: PostSummary[] }) {
  const showWatch = posts.some((p) => p.avgWatchSec != null);
  const showRatio = posts.some((p) => p.playToViewRatio != null);
  return (
    <div
      className={[
        styles.postList,
        showWatch ? "" : styles.noWatch,
        showRatio ? "" : styles.noRatio,
      ].join(" ")}
      role="table"
      aria-label="Posts do formato"
    >
      <div className={styles.postHead} role="row">
        <span role="columnheader">Data</span>
        <span role="columnheader">Post</span>
        <span className={styles.hNum} role="columnheader">
          Curtidas
        </span>
        <span className={styles.hNum} role="columnheader">
          Comentários
        </span>
        <span
          className={styles.hNum}
          role="columnheader"
          title="Comentários ÷ curtidas"
        >
          Polêmica
        </span>
        {showRatio && (
          <span
            className={styles.hNum}
            role="columnheader"
            title="Reproduções por visualização do reel"
          >
            Repr./visual.
          </span>
        )}
        {showWatch && (
          <span className={styles.hWatch} role="columnheader">
            Tempo assistido
            <span className={styles.seal}>{CONFIANCA.L0}</span>
            <span className={styles.sealSep}>·</span>
            retenção
            <span className={styles.seal}>{CONFIANCA.L1}</span>
          </span>
        )}
      </div>
      {posts.map((post) => (
        <PostDetailRow
          key={post.id}
          post={post}
          showRatio={showRatio}
          showWatch={showWatch}
        />
      ))}
    </div>
  );
}

function InteractionsCell({ row }: { row: FormatPerformanceRow }) {
  const known = row.interactionsKnownPosts;
  const total = row.interactionsTotalPosts;
  const value = row.interactions;

  if (known === 0 || value == null) {
    return (
      <span
        className={styles.interactionsEmpty}
        title="Curtidas, comentários, compartilhamentos e salvamentos ainda não informados para estes posts"
      >
        <span aria-hidden="true">—</span>
        <span style={visuallyHidden}>dados ainda não informados</span>
      </span>
    );
  }

  const isPartial = known < total;

  return (
    <>
      <span className={styles.interactionsValue}>
        {value.toLocaleString("pt-BR")}
      </span>
      {isPartial && (
        <span
          className={styles.interactionsCoverage}
          title="Só entram posts que têm curtidas, comentários, compartilhamentos e salvamentos"
        >
          {`em ${known} de ${total} ${total === 1 ? "post" : "posts"}`}
        </span>
      )}
    </>
  );
}

export function FormatPerformanceTable({
  rows,
  expandable = true,
}: FormatPerformanceTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>DESEMPENHO POR FORMATO</p>
      <table className={styles.table} aria-label="Desempenho por formato">
        <thead>
          <tr>
            <th className={styles.th} aria-label="Expandir"></th>
            <th className={styles.th}>FORMATO</th>
            <th className={styles.th}>POSTS</th>
            <th className={styles.th}>INTERAÇÕES</th>
            <th className={styles.th}>TENDÊNCIA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expandedId === row.id;
            const canExpand = expandable && row.postsDetail.length > 0;
            const toggle = () =>
              canExpand && setExpandedId(isExpanded ? null : row.id);

            return (
              <React.Fragment key={row.id}>
                <tr
                  className={[
                    styles.tr,
                    canExpand ? styles.trClickable : "",
                    isExpanded ? styles.trOpen : "",
                  ].join(" ")}
                  onClick={toggle}
                  {...(canExpand
                    ? {
                        tabIndex: 0,
                        "aria-expanded": isExpanded,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle();
                          }
                        },
                      }
                    : {})}
                >
                  <td className={styles.tdChevron}>
                    {canExpand && (
                      <svg
                        viewBox="0 0 20 20"
                        width="14"
                        height="14"
                        fill="none"
                        aria-hidden="true"
                        className={
                          isExpanded ? styles.chevronOpen : styles.chevron
                        }
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
                  <td className={[styles.td, styles.tdFormat].join(" ")}>
                    <span className={styles.formatIcon}>
                      {FORMAT_ICON[row.format] ?? <DefaultIcon />}
                    </span>
                    {row.format}
                  </td>
                  <td className={styles.td}>{row.posts}</td>
                  <td className={styles.td}>
                    <InteractionsCell row={row} />
                  </td>
                  <td className={styles.td}>
                    <StatusPill text={row.trendLabel} color={row.trendColor} />
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={5} className={styles.tdDetail}>
                      <PostList posts={row.postsDetail} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <p className={styles.metadataSource}>
        Posts e interações: {provenanceLine(COUNTS_PROVENANCE)}
      </p>
      <p className={styles.metadataSource}>
        Tendência: {provenanceLine(TREND_PROVENANCE)}
      </p>
    </div>
  );
}
