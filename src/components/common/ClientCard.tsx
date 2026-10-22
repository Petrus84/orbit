/**
 * ============================================================================
 * ClientCard
 * ============================================================================
 *
 * v2.3.0 (tipagem de status):
 * - 🐛 CORRIGIDO: o componente tratava 'unknown' como membro de
 *   ClientHealthStatus (que é healthy/warning/critical/info). Agora o status
 *   de domínio é `ClientHealthStatus | null` e a conversão para o vocabulário
 *   visual é feita por toSemaphoreStatus() (null → 'unknown').
 * - Prop `healthStatus` aceita `null` (Client.status é nullable).
 * - Mapas de classe cobrem 'info'.
 *
 * v2.2.0 (17/10/2026 — formatação pt-BR + vocabulário único):
 * - Saldo de seguidores via formatCompactPtBr; labels via term().
 *
 * v2.1.0 (13/10/2026 — NULL ≠ 0):
 * - engagement_real e follower_balance nulos → '—'. Zero real continua "0.0%".
 *
 * v2.0.x: props opcionais healthStatus/snapshotCount/lastSnapshotDate,
 * badge de status com STATUS_LABELS, filete de acento por status.
 * ============================================================================
 */

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Semaphore, { STATUS_LABELS, toSemaphoreStatus } from "./Semaphore";
import type { SemaphoreStatus } from "./Semaphore";
import type { Client, ClientHealthStatus } from "@/types/client";
import { term } from "@/lib/ui-labels";
import { formatCompactPtBr } from "@/lib/format";
import styles from "./ClientCard.module.css";

export interface ClientCardProps {
  client: Client;
  healthStatus?: ClientHealthStatus | null;
  snapshotCount?: number;
  lastSnapshotDate?: string | null;
}

// NULL = ausência de dado ('—'). 0 = métrica zerada, dado real ('0.0%' / '+0').
// Nunca colapsar um no outro.
const EMPTY_METRIC = "—";

function formatFollowerBalance(value: number | null | undefined): string {
  if (value == null) return EMPTY_METRIC;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatCompactPtBr(value)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return EMPTY_METRIC;
  return `${value.toFixed(1)}%`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "--";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "--";
  }
}

const STATUS_BADGE_CLASS: Record<SemaphoreStatus, string> = {
  healthy: styles.statusHealthy ?? "",
  warning: styles.statusWarning ?? "",
  critical: styles.statusCritical ?? "",
  info: styles.statusInfo ?? styles.statusUnknown ?? "",
  unknown: styles.statusUnknown ?? "",
};

// Filete de 3px no topo do card (cores --neon-cyan/--neon-gold/--neon-red).
const ACCENT_CLASS: Record<SemaphoreStatus, string> = {
  healthy: styles.accentHealthy ?? "",
  warning: styles.accentWarning ?? "",
  critical: styles.accentCritical ?? "",
  info: styles.accentInfo ?? styles.accentUnknown ?? "",
  unknown: styles.accentUnknown ?? "",
};

interface MetricColProps {
  label: string;
  value: string;
  dimmed?: boolean;
}

function MetricCol({
  label,
  value,
  dimmed,
}: MetricColProps): React.ReactElement {
  return (
    <div className={styles.metricCol}>
      <span className={styles.metricLabel}>{label}</span>
      <span
        className={[
          styles.metricValue,
          dimmed ? styles.metricValueDimmed : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

export default function ClientCard({
  client,
  healthStatus: propHealthStatus,
  snapshotCount: propSnapshotCount,
  lastSnapshotDate: propLastSnapshotDate,
}: ClientCardProps): React.ReactElement {
  const router = useRouter();

  // Props têm prioridade; depois o client. null (sem dado) vira 'unknown'
  // somente aqui, na borda visual.
  const semaphoreStatus: SemaphoreStatus = toSemaphoreStatus(
    propHealthStatus ?? client.status,
  );
  const snapshotCount = propSnapshotCount ?? client.snapshotCount ?? 0;
  const lastSnapshotDate =
    propLastSnapshotDate ?? client.lastSnapshotDate ?? null;

  return (
    <button
      type="button"
      onClick={() => router.push(`/clients/${client.id}`)}
      className={`${styles.card} ${ACCENT_CLASS[semaphoreStatus]}`}
      aria-label={`Abrir cliente ${client.name}`}
    >
      <div className={styles.header}>
        {client.avatar ? (
          <Image
            src={client.avatar}
            alt={client.name}
            width={40}
            height={40}
            className={styles.avatarImage}
          />
        ) : (
          <div aria-hidden="true" className={styles.avatarFallback}>
            {client.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className={styles.identity}>
          <span className={styles.name}>{client.name}</span>
          <span className={styles.handle}>{client.handle}</span>
        </div>

        <span className={styles.semaphoreWrap}>
          <Semaphore status={semaphoreStatus} showLabel={false} />
          <span
            className={`${styles.statusBadge} ${STATUS_BADGE_CLASS[semaphoreStatus]}`}
          >
            {STATUS_LABELS[semaphoreStatus]}
          </span>
        </span>
      </div>

      <div className={styles.divider} />

      {snapshotCount > 0 && lastSnapshotDate && (
        <div className={styles.snapshotInfo}>
          <span className={styles.snapshotLabel}>Dados até</span>
          <span className={styles.snapshotValue}>
            {formatDate(lastSnapshotDate)} · {snapshotCount}
          </span>
        </div>
      )}

      <div className={styles.metricsRow}>
        <MetricCol
          label={term("saldo_seguidores")}
          value={formatFollowerBalance(client.metrics.follower_balance)}
          dimmed={
            client.metrics.follower_balance == null ||
            client.metrics.follower_balance === 0
          }
        />
        <MetricCol
          label={term("er_real")}
          value={formatPercent(client.metrics.engagement_real)}
          dimmed={
            client.metrics.engagement_real == null ||
            client.metrics.engagement_real === 0
          }
        />
        <MetricCol
          label={term("ctr_link")}
          value={formatPercent(client.metrics.ctr_link)}
          dimmed={client.metrics.ctr_link == null}
        />
      </div>
    </button>
  );
}
