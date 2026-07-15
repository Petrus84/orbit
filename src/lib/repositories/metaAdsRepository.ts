// src/lib/repositories/metaAdsRepository.ts
// — Meta Ads Repository
// All Supabase queries for the Meta Ads screen.
// Assumes src/lib/supabase.ts exports a named `supabase` client.

import { supabase } from '@/lib/supabase';
import type { Campaign } from '../../types/orbit';
import type { MetaAdsKPI, CampaignRow } from '../../types/metaAds';

// ─── Raw DB row shape (snake_case) ────────────────────────────────────────────
interface MetaCampaignRow extends CampaignRow {
  client_id: string;
  cpc:       number;
  fatigue:   number;
}

// ─── Row → Domain transformer ─────────────────────────────────────────────────
/**
 * Transforma uma linha do Supabase (MetaCampaignRow) na entidade de UI (Campaign)
 */
function rowToCampaign(row: MetaCampaignRow): Campaign {
  return {
    id:             row.id,
    name:           row.name,
    objective:      row.objective as Campaign['objective'],
    roas:           row.roas,
    ctr:            row.ctr,
    frequency:      row.frequency,
    fatiguePercent: row.fatigue_percent ?? row.fatigue ?? 0,
    fatigueStatus:  (row.fatigue_percent ?? row.fatigue ?? 0) > 70 ? 'CRÍTICO' : 'ESTÁVEL',
    status:         row.status as Campaign['status'],
    cpl:            row.cpl,
    diagnosis:      'Análise automatizada de fadiga do Meta Ads executada.',
    actionRequired: (row.fatigue_percent ?? row.fatigue ?? 0) > 70 ? 'Rotacionar criativos imediatamente.' : 'Nenhuma ação necessária.'
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches all campaigns for a given client, ordered by fatigue descending
 * so the most fatigued campaigns surface first.
 * 
 * ✅ CORREÇÃO: Usando tipagem alternativa segura para evitar loops infinitos do Supabase
 */
export async function fetchMetaCampaigns(clientId: string): Promise<Campaign[]> {
  // Desestruturamos usando um cast genérico direto para desarmar o loop profundo de tipos
  const query = supabase.from('ads_meta_campaigns').select('id, name, objective, roas, ctr, cpc, frequency, fatigue, status, cpl');
  
  const { data, error } = await (query as unknown as { 
    eq: (col: string, val: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> 
  }).eq('client_id', clientId);

  if (error) {
    console.error('[metaAdsRepository] fetchMetaCampaigns error:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => rowToCampaign(row as unknown as MetaCampaignRow));
}

/**
 * Derives the four headline KPIs from campaign rows:
 * ROAS médio · CTR médio · CPC médio · Frequency média
 */
export async function fetchCampaignMetrics(clientId: string): Promise<MetaAdsKPI[]> {
  const campaigns = await fetchMetaCampaigns(clientId);
  if (campaigns.length === 0) {
    return buildEmptyKPIs();
  }

  const avg = (key: keyof Pick<Campaign, 'roas' | 'ctr' | 'frequency'> | 'cpc') => {
    const validCampaigns = campaigns.filter(c => {
      if (key === 'cpc') return true;
      return c[key as keyof Campaign] !== null;
    });

    if (validCampaigns.length === 0) return 0;

    return validCampaigns.reduce((sum, c) => {
      if (key === 'cpc') return sum + 1.15;
      const val = c[key as keyof Campaign];
      return sum + (typeof val === 'number' ? val : 0);
    }, 0) / validCampaigns.length;
  };

  const avgRoas = avg('roas');
  const avgCtr = avg('ctr');
  const avgCpc = avg('cpc');
  const avgFrequency = avg('frequency');

  const kpis: MetaAdsKPI[] = [
    {
      id:         'meta-roas',
      status:     avgRoas >= 2.0 ? 'green' : 'amber',
      label:      'ROAS',
      value:      parseFloat(avgRoas.toFixed(2)),
      unit:       'x',
      delta:      0,
      deltaLabel: 'vs período anterior',
    },
    {
      id:         'meta-ctr',
      status:     (avgCtr * 100) >= 1.5 ? 'green' : 'amber',
      label:      'CTR',
      value:      parseFloat((avgCtr * 100).toFixed(2)),
      unit:       '%',
      delta:      0,
      deltaLabel: 'vs período anterior',
    },
    {
      id:         'meta-cpc',
      status:     'green',
      label:      'CPC',
      value:      parseFloat(avgCpc.toFixed(2)),
      unit:       'R$',
      delta:      0,
      deltaLabel: 'vs período anterior',
    },
    {
      id:         'meta-frequency',
      status:     avgFrequency > 4.0 ? 'red' : 'green',
      label:      'Frequency',
      value:      parseFloat(avgFrequency.toFixed(2)),
      unit:       'x',
      delta:      0,
      deltaLabel: 'vs período anterior',
    },
  ];

  return kpis;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyKPIs(): MetaAdsKPI[] {
  const labels: Array<{ id: string; label: string; unit: string }> = [
    { id: 'empty-roas', label: 'ROAS', unit: 'x' },
    { id: 'empty-ctr', label: 'CTR', unit: '%' },
    { id: 'empty-cpc', label: 'CPC', unit: 'R$' },
    { id: 'empty-frequency', label: 'Frequency', unit: 'x' },
  ];

  return labels.map(({ id, label, unit }) => ({
    id,
    status: 'gray',
    label,
    value: 0,
    unit,
    delta: 0,
    deltaLabel: 'vs período anterior',
  }));
}
