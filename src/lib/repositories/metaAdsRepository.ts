// ─── Meta Ads Repository ──────────────────────────────────────────────────────
// All Supabase queries for the Meta Ads screen.
// Assumes src/lib/supabaseClient.ts exports a named `supabase` client.

import { supabase } from '../supabaseClient';
import type { Campaign, MetaAdsKPI } from '../../types/metaAds';

// ─── Raw DB row shape (snake_case) ────────────────────────────────────────────

interface MetaCampaignRow {
  id: string;
  client_id: string;
  name: string;
  objective: string;
  roas: number;
  ctr: number;
  cpc: number;
  frequency: number;
  fatigue: number;
  status: string;
  cpl: number;
}

// ─── Row → Domain transformer ─────────────────────────────────────────────────

function rowToCampaign(row: MetaCampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective as Campaign['objective'],
    roas: row.roas,
    ctr: row.ctr,
    cpc: row.cpc,
    frequency: row.frequency,
    fatigue: row.fatigue,
    status: row.status as Campaign['status'],
    cpl: row.cpl,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches all campaigns for a given client, ordered by fatigue descending
 * so the most fatigued campaigns surface first.
 */
export async function fetchMetaCampaigns(clientId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from<'meta_campaigns', MetaCampaignRow>('meta_campaigns')
    .select('id, name, objective, roas, ctr, cpc, frequency, fatigue, status, cpl')
    .eq('client_id', clientId)
    .order('fatigue', { ascending: false });

  if (error) {
    console.error('[metaAdsRepository] fetchMetaCampaigns error:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(rowToCampaign);
}

/**
 * Derives the four headline KPIs from campaign rows:
 *   ROAS médio · CTR médio · CPC médio · Frequency média
 *
 * Delta values are placeholders (0) until a comparison-period endpoint exists.
 */
export async function fetchCampaignMetrics(clientId: string): Promise<MetaAdsKPI[]> {
  const campaigns = await fetchMetaCampaigns(clientId);

  if (campaigns.length === 0) {
    return buildEmptyKPIs();
  }

  const avg = (key: keyof Pick<Campaign, 'roas' | 'ctr' | 'cpc' | 'frequency'>) =>
    campaigns.reduce((sum, c) => sum + c[key], 0) / campaigns.length;

  const avgRoas = avg('roas');
  const avgCtr = avg('ctr');
  const avgCpc = avg('cpc');
  const avgFrequency = avg('frequency');

  const kpis: MetaAdsKPI[] = [
    {
      label: 'ROAS',
      value: parseFloat(avgRoas.toFixed(2)),
      unit: 'x',
      delta: 0,
      deltaLabel: 'vs período anterior',
    },
    {
      label: 'CTR',
      // Convert decimal (0.025) → percentage (2.5)
      value: parseFloat((avgCtr * 100).toFixed(2)),
      unit: '%',
      delta: 0,
      deltaLabel: 'vs período anterior',
    },
    {
      label: 'CPC',
      value: parseFloat(avgCpc.toFixed(2)),
      unit: 'R$',
      delta: 0,
      deltaLabel: 'vs período anterior',
    },
    {
      label: 'Frequency',
      value: parseFloat(avgFrequency.toFixed(2)),
      unit: 'x',
      delta: 0,
      deltaLabel: 'vs período anterior',
    },
  ];

  return kpis;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyKPIs(): MetaAdsKPI[] {
  const labels: Array<{ label: string; unit: string }> = [
    { label: 'ROAS', unit: 'x' },
    { label: 'CTR', unit: '%' },
    { label: 'CPC', unit: 'R$' },
    { label: 'Frequency', unit: 'x' },
  ];

  return labels.map(({ label, unit }) => ({
    label,
    value: 0,
    unit,
    delta: 0,
    deltaLabel: 'vs período anterior',
  }));
}
