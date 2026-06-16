import React from 'react';
import { useRouter } from 'next/navigation';      // ✅ FIX #1
import Image from 'next/image';                   // ✅ FIX #2
import Semaphore from './Semaphore';
import type { SemaphoreStatus } from './Semaphore';

export interface Client {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  status: 'critical' | 'warning' | 'healthy';
  metrics: {
    follower_balance: number;
    engagement_real: number;
    ctr_link: number;
  };
}

interface ClientCardProps {
  client: Client;
}

function formatFollowerBalance(value: number): string {
  const sign = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1000) {
    return `${sign}${(value / 1000).toFixed(1)}k`;
  }
  return `${sign}${value}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface MetricColProps {
  label: string;
  value: string;
  dimmed?: boolean;
}

function MetricCol({ label, value, dimmed }: MetricColProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${
          dimmed ? 'text-zinc-500' : 'text-white'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function ClientCard({ client }: ClientCardProps): React.ReactElement {
  const router = useRouter();  // ✅ FIX #1: useRouter do Next.js

  const semaphoreStatus: SemaphoreStatus = client.status;

  const ctrDisplay =
    client.metrics.ctr_link === 0 ? '—' : formatPercent(client.metrics.ctr_link);

  return (
    <button
      type="button"
      onClick={() => router.push(`/clients/${client.id}`)}  // ✅ FIX #1: router.push
      className="group flex w-full flex-col gap-4 rounded-2xl bg-[#18181F] p-4 text-left transition-colors hover:bg-[#1F1F28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8FF57]"
    >
      {/* Header: avatar + name + semaphore */}
      <div className="flex items-center gap-3">
        {client.avatarUrl ? (
          // ✅ FIX #2: <Image> do Next.js (não <img>)
          <Image
            src={client.avatarUrl}
            alt={client.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 font-sans text-sm font-bold text-zinc-300"
          >
            {client.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-sans text-sm font-semibold text-white">
            {client.name}
          </span>
          <span className="truncate font-sans text-xs text-zinc-500">{client.handle}</span>
        </div>

        <Semaphore status={semaphoreStatus} showLabel={false} />
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-white/5" />

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCol
          label="Saldo seg."
          value={formatFollowerBalance(client.metrics.follower_balance)}
          dimmed={client.metrics.follower_balance === 0}
        />
        <MetricCol
          label="Eng. real"
          value={formatPercent(client.metrics.engagement_real)}
          dimmed={client.metrics.engagement_real === 0}
        />
        <MetricCol
          label="CTR link"
          value={ctrDisplay}
          dimmed={client.metrics.ctr_link === 0}
        />
      </div>
    </button>
  );
}
