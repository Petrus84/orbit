import React from 'react';
import CampaignRow from './CampaignRow';
import type { Campaign } from './CampaignRow';

interface CampaignTableProps {
  campaigns: Campaign[];
  onAction?: (id: string) => void;
}

const COLUMNS = [
  { key: 'name',      label: 'Campanha',    align: 'text-left'  },
  { key: 'objective', label: 'Objetivo',    align: 'text-left'  },
  { key: 'roas',      label: 'ROAS',        align: 'text-left'  },
  { key: 'ctr',       label: 'CTR',         align: 'text-left'  },
  { key: 'frequency', label: 'Freq.',       align: 'text-left'  },
  { key: 'fatigue',   label: 'Fadiga',      align: 'text-left'  },
  { key: 'diagnosis', label: 'Diagnóstico', align: 'text-left'  },
  { key: 'action',    label: '',            align: 'text-right' },
] as const;

function EmptyRow(): React.ReactElement {
  return (
    <tr>
      <td colSpan={8} className="py-12 text-center">
        <span className="font-sans text-sm text-zinc-600">Nenhuma campanha encontrada.</span>
      </td>
    </tr>
  );
}

export default function CampaignTable({ campaigns, onAction }: CampaignTableProps): React.ReactElement {
  // Sort: critical first, then warning, then healthy
  const ORDER: Record<Campaign['status'], number> = { critical: 0, warning: 1, healthy: 2 };
  const sorted = [...campaigns].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  const criticalCount = campaigns.filter((c) => c.status === 'critical').length;
  const warningCount  = campaigns.filter((c) => c.status === 'warning').length;

  return (
    <div className="flex flex-col gap-3">
      {/* Summary chips */}
      {campaigns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="font-sans text-xs text-zinc-600">
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
          </span>
          {criticalCount > 0 && (
            <span className="rounded-full border border-red-500/30 bg-red-900/20 px-2 py-0.5 font-sans text-[10px] font-semibold text-red-400">
              {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-900/20 px-2 py-0.5 font-sans text-[10px] font-semibold text-amber-400">
              {warningCount} em atenção
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[var(--bg-card)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-3 py-2.5 first:pl-4 last:pr-4 font-sans text-[10px] font-semibold uppercase tracking-widest text-zinc-600 ${col.align}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <EmptyRow />
              ) : (
                sorted.map((campaign) => (
                  <CampaignRow key={campaign.id} campaign={campaign} onAction={onAction} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
