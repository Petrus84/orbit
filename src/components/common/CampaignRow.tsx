import React from 'react';
import FatigueIndicator from './FatigueIndicator';

import type { CampaignObjective } from '../../lib/types/enums-orbit'

export type CampaignStatus = 'healthy' | 'warning' | 'critical';

export interface Campaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  roas?: number;
  ctr: number;
  frequency: number;
  fatigue: number;
  status: CampaignStatus;
}

interface CampaignRowProps {
  campaign: Campaign;
  onAction?: (id: string) => void;
}

const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  awareness:    'Awareness',
  reach:        'Alcance',
  traffic:      'Tráfego',
  engagement:   'Engajamento',
  leads:        'Leads',
  app_promotion: 'Promoção App',
  sales:        'Vendas',
  video_views:  'Visualizações',
  conversion:   'Conversão',
  retargeting:  'Retargeting',
  other:        'Outro',
};

const OBJECTIVE_COLORS: Record<CampaignObjective, string> = {
  awareness:    'text-blue-400',
  reach:        'text-cyan-400',
  traffic:      'text-teal-300',
  engagement:   'text-pink-400',
  leads:        'text-[#C8FF57]',
  app_promotion: 'text-violet-400',
  sales:        'text-emerald-300',
  video_views:  'text-indigo-400',
  conversion:   'text-amber-400',
  retargeting:  'text-purple-400',
  other:        'text-zinc-300',
};

const STATUS_DIAG: Record<CampaignStatus, { text: string; color: string }> = {
  healthy:  { text: 'Saudável',    color: 'text-emerald-400' },
  warning:  { text: 'Monitorar',   color: 'text-amber-400'   },
  critical: { text: 'Renovar criativos', color: 'text-red-400' },
};

const FREQ_COLOR = (freq: number): string => {
  if (freq >= 4) return 'text-red-400';
  if (freq >= 2.5) return 'text-amber-400';
  return 'text-zinc-300';
};

export default function CampaignRow({ campaign, onAction }: CampaignRowProps): React.ReactElement {
  const diag = STATUS_DIAG[campaign.status];

  return (
    <tr className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/20">
      {/* Campaign name */}
      <td className="py-3 pl-4 pr-3">
        <span className="font-sans text-sm font-medium text-white">{campaign.name}</span>
      </td>

      {/* Objective */}
      <td className="px-3 py-3">
        <span className={`font-sans text-xs font-medium ${OBJECTIVE_COLORS[campaign.objective]}`}>
          {OBJECTIVE_LABELS[campaign.objective]}
        </span>
      </td>

      {/* ROAS */}
      <td className="px-3 py-3">
        <span className="font-mono text-sm tabular-nums text-zinc-300">
          {campaign.roas !== undefined ? `${campaign.roas.toFixed(2)}×` : '—'}
        </span>
      </td>

      {/* CTR */}
      <td className="px-3 py-3">
        <span className="font-mono text-sm tabular-nums text-zinc-300">
          {campaign.ctr.toFixed(2)}%
        </span>
      </td>

      {/* Frequency */}
      <td className="px-3 py-3">
        <span className={`font-mono text-sm font-semibold tabular-nums ${FREQ_COLOR(campaign.frequency)}`}>
          {campaign.frequency.toFixed(1)}×
        </span>
      </td>

      {/* Fatigue */}
      <td className="px-3 py-3">
        <FatigueIndicator fatigue={campaign.fatigue} />
      </td>

      {/* Diagnosis */}
      <td className="px-3 py-3">
        <span className={`font-sans text-xs font-medium ${diag.color}`}>{diag.text}</span>
      </td>

      {/* Action */}
      <td className="py-3 pl-3 pr-4 text-right">
        {campaign.status !== 'healthy' && onAction && (
          <button
            type="button"
            onClick={() => onAction(campaign.id)}
            className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
              campaign.status === 'critical'
                ? 'border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
            }`}
          >
            Ver detalhes
          </button>
        )}
      </td>
    </tr>
  );
}
