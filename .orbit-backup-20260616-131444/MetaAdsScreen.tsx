import React from 'react';
import { useParams } from 'react-router-dom';
import SectionHead from '../common/SectionHead';
import KPICard from '../common/KPICard';
import CampaignTable from '../common/CampaignTable';
import FatigueFormula from '../common/FatigueFormula';
import type { KPI } from '../common/KPICard';
import type { Campaign } from '../common/CampaignRow';

// ─── Hook contract ────────────────────────────────────────────

interface MetaAdsData {
  kpis: KPI[];
  campaigns: Campaign[];
}

interface UseMetaAdsResult {
  data: MetaAdsData | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  refetch: () => void;
}

interface MetaAdsScreenProps {
  useMetaAds: (clientId: string) => UseMetaAdsResult;
}

// ─── Skeletons ────────────────────────────────────────────────

function KPISkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#18181F] p-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-2.5 w-20 rounded bg-zinc-800" />
        <div className="h-4 w-6 rounded-full bg-zinc-800" />
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-24 rounded bg-zinc-800" />
          <div className="h-2.5 w-16 rounded bg-zinc-800" />
        </div>
        <div className="h-6 w-16 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

function TableSkeleton(): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#18181F] animate-pulse">
      <div className="border-b border-zinc-800 px-4 py-2.5">
        <div className="grid grid-cols-8 gap-3">
          {[40, 24, 14, 14, 14, 20, 24, 10].map((w, i) => (
            <div key={i} className={`h-2.5 rounded bg-zinc-800`} style={{ width: `${w * 0.8}%` }} />
          ))}
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-b border-zinc-800/60 px-4 py-3">
          <div className="grid grid-cols-8 items-center gap-3">
            <div className="h-3 w-32 rounded bg-zinc-800" />
            <div className="h-3 w-16 rounded bg-zinc-800" />
            <div className="h-3 w-10 rounded bg-zinc-800" />
            <div className="h-3 w-10 rounded bg-zinc-800" />
            <div className="h-3 w-10 rounded bg-zinc-800" />
            <div className="h-2 w-full rounded-full bg-zinc-800" />
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="h-6 w-20 rounded-full bg-zinc-800 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center">
      <p className="font-sans text-sm text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-red-500/40 bg-red-500/20 px-4 py-1.5 font-sans text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
      >
        Tentar novamente
      </button>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-600">
      {children}
    </p>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function MetaAdsScreen({ useMetaAds }: MetaAdsScreenProps): React.ReactElement {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const { data, status, error, refetch } = useMetaAds(clientId);

  const isLoading = status === 'idle' || status === 'loading';

  const handleCampaignAction = (id: string) => {
    // Navigate to campaign detail or open drawer — implement in router layer
    console.info('Campaign action:', id);
  };

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      {/* Header */}
      <SectionHead
        title="Meta Ads"
        subtitle={
          status === 'success' && data
            ? `${data.campaigns.length} campanha${data.campaigns.length !== 1 ? 's' : ''} ativas`
            : undefined
        }
      />

      {/* Error */}
      {status === 'error' && error && (
        <ErrorState message={error} onRetry={refetch} />
      )}

      {/* ── KPI Cards ── */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Indicadores de mídia paga</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading
            ? [0, 1, 2, 3].map((i) => <KPISkeleton key={i} />)
            : (data?.kpis ?? []).map((kpi) => (
                <KPICard key={kpi.label} kpi={kpi} />
              ))}
        </div>
      </section>

      {/* ── Campaign Table ── */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Diagnóstico por campanha</SectionLabel>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <CampaignTable
            campaigns={data?.campaigns ?? []}
            onAction={handleCampaignAction}
          />
        )}
      </section>

      {/* ── Fatigue Formula ── */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Metodologia</SectionLabel>
        <FatigueFormula />
      </section>
    </main>
  );
}
