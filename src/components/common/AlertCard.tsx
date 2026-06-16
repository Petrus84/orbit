import React from 'react';
import AlertIcon from './AlertIcon';
import type { AlertType } from './AlertIcon';

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Alert {
  id: string;
  clientId: string;
  type: AlertType;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: AlertAction[];
  triggeredAt: string;
  acknowledged: boolean;
}

interface AlertCardProps {
  alert: Alert;
}

type SeverityTokens = {
  wrapper: string;
  dot: string;
  primaryBtn: string;
  secondaryBtn: string;
  timeColor: string;
};

const SEVERITY_TOKENS: Record<Alert['severity'], SeverityTokens> = {
  critical: {
    wrapper:      'border-red-500/30 bg-red-900/10',
    dot:          'bg-red-400 shadow-[0_0_6px_2px_rgba(255,68,68,0.45)]',
    primaryBtn:   'border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30',
    secondaryBtn: 'border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800',
    timeColor:    'text-red-400/70',
  },
  warning: {
    wrapper:      'border-amber-500/30 bg-amber-900/10',
    dot:          'bg-amber-400 shadow-[0_0_6px_2px_rgba(255,176,32,0.45)]',
    primaryBtn:   'border-amber-500/40 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
    secondaryBtn: 'border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800',
    timeColor:    'text-amber-400/70',
  },
  info: {
    wrapper:      'border-blue-500/30 bg-blue-900/10',
    dot:          'bg-blue-400 shadow-[0_0_6px_2px_rgba(74,144,255,0.45)]',
    primaryBtn:   'border-blue-500/40 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
    secondaryBtn: 'border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800',
    timeColor:    'text-blue-400/70',
  },
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  return `${Math.floor(diffH / 24)}d atrás`;
}

export default function AlertCard({ alert }: AlertCardProps): React.ReactElement {
  const tokens = SEVERITY_TOKENS[alert.severity];

  return (
    <article
      className={`flex gap-3 rounded-2xl border p-4 transition-opacity ${tokens.wrapper} ${
        alert.acknowledged ? 'opacity-50' : 'opacity-100'
      }`}
    >
      {/* Left column: icon + severity dot */}
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <AlertIcon type={alert.type} />
        <span className={`h-1.5 w-1.5 rounded-full ${tokens.dot}`} aria-hidden="true" />
      </div>

      {/* Right column: content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-sans text-sm font-semibold leading-snug text-white">
            {alert.title}
          </p>
          <span className={`shrink-0 font-sans text-[10px] tabular-nums ${tokens.timeColor}`}>
            {formatRelativeTime(alert.triggeredAt)}
          </span>
        </div>

        {/* Description */}
        <p className="font-sans text-xs leading-relaxed text-zinc-400">
          {alert.description}
        </p>

        {/* Actions */}
        {alert.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {alert.actions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
                  action.variant === 'primary' || action.variant === undefined
                    ? tokens.primaryBtn
                    : tokens.secondaryBtn
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
