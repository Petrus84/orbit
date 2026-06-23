import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import SectionHead from '../common/SectionHead';
import FunnelChart from '../common/FunnelChart';
import FunnelSimulator from '../common/FunnelSimulator';
import type { FunnelData } from '../common/FunnelChart';
import type { SimulatorState } from '../common/FunnelSimulator';
import type { SimulationResult } from '../common/FunnelResult';

// ─── Hook contract ────────────────────────────────────────────

interface UseFunnelResult {
  data: FunnelData | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  refetch: () => void;
}

interface FunnelScreenProps {
  useFunnel: (clientId: string) => UseFunnelResult;
}

// ─── Simulation formula ───────────────────────────────────────
// vendas_est = alcance × (ctrBio/100) × (ctrBio/100) × (taxaConv/100)
// We model: visitas = alcance × ctrBio/100
//           cliques = visitas × ctrLink  (ctrLink ≈ ctrBio as simplification)
//           vendas  = cliques × taxaConv/100

function computeSimulation(state: SimulatorState, ctrLink: number): SimulationResult {
  const visitas = state.alcance * (state.ctrBio / 100);
  const cliques = visitas * (ctrLink / 100);
  const vendas  = cliques * (state.taxaConv / 100);
  return {
    alcanceSimulado: state.alcance,
    ctrBio: state.ctrBio,
    taxaConv: state.taxaConv,
    cliques: Math.round(cliques),
    vendas:  Math.round(vendas),
  };
}

// ─── Skeletons ────────────────────────────────────────────────

function ChartSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[100, 60, 30, 12].map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <div className="h-2.5 w-24 rounded bg-zinc-800" />
            <div className="h-2.5 w-16 rounded bg-zinc-800" />
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800">
            <div className="h-2 rounded-full bg-zinc-700" style={{ width: `${w}%` }} />
          </div>
          {i < 3 && <div className="mx-auto h-3 w-px bg-zinc-800" />}
        </div>
      ))}
    </div>
  );
}

function SimulatorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="h-2.5 w-40 rounded bg-zinc-800" />
            <div className="h-2.5 w-10 rounded bg-zinc-800" />
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800" />
          <div className="flex justify-between">
            <div className="h-2 w-6 rounded bg-zinc-800" />
            <div className="h-2 w-6 rounded bg-zinc-800" />
          </div>
        </div>
      ))}
      <div className="h-32 w-full rounded-2xl bg-zinc-800" />
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  return (
    <div className="col-span-2 flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center">
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

// ─── Panel wrapper ────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#18181F] p-5">
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-600">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function FunnelScreen({ useFunnel }: FunnelScreenProps): React.ReactElement {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const { data, status, error, refetch } = useFunnel(clientId);

  // ─── DEBUG LOGS ────────────────────────────────────────────
  // Logs estruturados para investigar o carregamento do funil
  useEffect(() => {
    console.group('🔍 [FunnelScreen] Estado Atual');
    console.log('📊 Status:', status);
    console.log('❌ Erro:', error);
    console.log('📈 Dados:', data);
    
    if (data) {
      console.log('✅ Dados carregados com sucesso:', {
        alcance: data.alcance,
        visitas: data.visitas,
        cliques: data.cliques,
        vendas: data.vendas,
        ctrBio: data.ctrBio,
        taxaConv: data.taxaConv,
      });
    } else if (status === 'loading') {
      console.warn('⏳ Carregando dados...');
    } else if (status === 'error') {
      console.error('🚨 Erro ao carregar:', error);
    }
    console.groupEnd();
  }, [data, status, error]);
  // ─── FIM DEBUG LOGS ────────────────────────────────────────

  const isLoading = status === 'idle' || status === 'loading';

  // Initialise simulator from real data when it arrives
  const [simState, setSimState] = useState<SimulatorState>({
    ctrBio:   5,
    taxaConv: 2,
    alcance:  10_000,
  });

  // Sync simulator defaults once data loads (only first time)
  const [synced, setSynced] = useState(false);
  if (data && !synced) {
    setSimState({
      ctrBio:   data.ctrBio,
      taxaConv: data.taxaConv,
      alcance:  data.alcance,
    });
    setSynced(true);
  }

  // ctrLink derived from real data (cliques / visitas)
  const ctrLink = useMemo(() => {
    if (!data || data.visitas === 0) return 10;
    return (data.cliques / data.visitas) * 100;
  }, [data]);

  const simResult = useMemo(
    () => computeSimulation(simState, ctrLink),
    [simState, ctrLink],
  );

  const baseVendas = data?.vendas ?? 0;

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead
        title="Funil de conversão"
        subtitle="Dados reais vs. cenário simulado"
      />

      {status === 'error' && error ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left: real funnel */}
          <Panel title="Funil real · 90 dias">
            {isLoading || !data ? (
              <ChartSkeleton />
            ) : (
              <FunnelChart data={data} />
            )}
          </Panel>

          {/* Right: simulator */}
          <Panel title="Simulador de cenários">
            {isLoading ? (
              <SimulatorSkeleton />
            ) : (
              <FunnelSimulator
                state={simState}
                onChange={setSimState}
                result={simResult}
                baseVendas={baseVendas}
              />
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}
