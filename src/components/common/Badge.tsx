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
  // ✅ CORREÇÃO (L5): BadgeVariant = SemaphoreStatus = ClientHealthStatus
  // tem 4 valores (healthy/warning/critical/unknown), mas faltava a
  // entrada 'unknown' — quebrava Sidebar.tsx, AlertasScreen.tsx e
  // qualquer outro consumidor de Badge para clientes sem dado recente.
  // Cor neutra/cinza, mesmo padrão que Semaphore.tsx já usa para 'unknown'.
  unknown: 'bg-zinc-800/50 text-zinc-400 border border-zinc-600/30',
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