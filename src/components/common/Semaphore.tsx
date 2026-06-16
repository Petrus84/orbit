import React from 'react';

export type SemaphoreStatus = 'critical' | 'warning' | 'healthy';

interface SemaphoreProps {
  status: SemaphoreStatus;
  /** Mostra o label textual ao lado do dot (default: true) */
  showLabel?: boolean;
}

interface SemaphoreConfig {
  color: string;
  glowClass: string;
  label: string;
}

/**
 * Labels reaproveitados pelo Badge para manter o vocabulário
 * consistente entre o dot do semáforo e o badge de status.
 */
export const STATUS_LABELS: Record<SemaphoreStatus, string> = {
  critical: 'Crítico',
  warning: 'Atenção',
  healthy: 'Saudável',
};

const STATUS_CONFIG: Record<SemaphoreStatus, SemaphoreConfig> = {
  critical: {
    color: '#FF4444',
    glowClass: 'shadow-[0_0_8px_2px_rgba(255,68,68,0.55)]',
    label: STATUS_LABELS.critical,
  },
  warning: {
    color: '#FFB020',
    glowClass: 'shadow-[0_0_8px_2px_rgba(255,176,32,0.55)]',
    label: STATUS_LABELS.warning,
  },
  healthy: {
    color: '#2ECC71',
    glowClass: 'shadow-[0_0_8px_2px_rgba(46,204,113,0.55)]',
    label: STATUS_LABELS.healthy,
  },
};

export default function Semaphore({ status, showLabel = true }: SemaphoreProps): React.ReactElement {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.glowClass}`}
        style={{ backgroundColor: config.color }}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="font-sans text-xs font-medium" style={{ color: config.color }}>
          {config.label}
        </span>
      )}
    </div>
  );
}
