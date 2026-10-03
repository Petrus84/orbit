import React from 'react';

export interface DiagnosticAlertData {
  id: string;
  title: string;
  body: string;
  severity: 'critical' | 'warning' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

interface DiagnosticAlertProps {
  alert: DiagnosticAlertData;
  index: number; // 1-based display number
}

type SeverityTokens = {
  number: string;
  numberBg: string;
  border: string;
  actionBtn: string;
};

const SEVERITY_TOKENS: Record<DiagnosticAlertData['severity'], SeverityTokens> = {
  critical: {
    number:    'text-red-400',
    numberBg:  'bg-red-500/15',
    border:    'border-red-500/25',
    actionBtn: 'border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25',
  },
  warning: {
    number:    'text-amber-400',
    numberBg:  'bg-amber-500/15',
    border:    'border-amber-500/25',
    actionBtn: 'border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
  },
  info: {
    number:    'text-blue-400',
    numberBg:  'bg-blue-500/15',
    border:    'border-blue-500/25',
    actionBtn: 'border-blue-500/40 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25',
  },
};

export default function DiagnosticAlert({ alert, index }: DiagnosticAlertProps): React.ReactElement {
  const tokens = SEVERITY_TOKENS[alert.severity];

  return (
    <div className={`flex gap-3 rounded-2xl border bg-[var(--bg-card)] p-4 ${tokens.border}`}>
      {/* Index number */}
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${tokens.numberBg} ${tokens.number}`}
        aria-label={`Diagnóstico ${index}`}
      >
        {index}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-sans text-sm font-semibold leading-snug text-white">
          {alert.title}
        </p>
        <p className="font-sans text-xs leading-relaxed text-zinc-400">
          {alert.body}
        </p>
        {alert.actionLabel && alert.onAction && (
          <div className="pt-1">
            <button
              type="button"
              onClick={alert.onAction}
              className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${tokens.actionBtn}`}
            >
              {alert.actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
