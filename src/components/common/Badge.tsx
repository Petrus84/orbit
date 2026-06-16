import React from 'react';
import type { SemaphoreStatus } from './Semaphore';

export type BadgeVariant = SemaphoreStatus;

interface BadgeProps {
  text: string;
  variant: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  critical: 'bg-red-900/30 text-red-400 border border-red-500/30',
  warning: 'bg-amber-900/30 text-amber-400 border border-amber-500/30',
  healthy: 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30',
};

export default function Badge({ text, variant }: BadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-sans text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {text}
    </span>
  );
}
