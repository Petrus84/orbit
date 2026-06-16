// ─── useMetaAds ───────────────────────────────────────────────────────────────
// Custom React hook for the Meta Ads screen.
// Handles fetching, retry with exponential backoff, and race-condition safety
// under React 18 StrictMode (double-invoke of effects).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMetaCampaigns, fetchCampaignMetrics } from '../lib/repositories/metaAdsRepository';
import type { Campaign, FetchStatus, MetaAdsKPI } from '../types/metaAds';

// ─── Public shape ─────────────────────────────────────────────────────────────

export interface UseMetaAdsReturn {
  campaigns: Campaign[];
  kpis: MetaAdsKPI[];
  status: FetchStatus;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
/** Base delay in ms; actual delay = BASE_DELAY * 2^attempt */
const BASE_DELAY_MS = 500;

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMetaAds(clientId: string): UseMetaAdsReturn {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [kpis, setKpis] = useState<MetaAdsKPI[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * isMountedRef — flipped to false in the cleanup function so that
   * async continuations after an unmount do not trigger state updates.
   * This is especially important under React 18 StrictMode, which unmounts
   * and remounts every component in development.
   */
  const isMountedRef = useRef<boolean>(false);

  /**
   * fetchIdRef — increments on every call to `load()`.
   * Each async branch captures its own id and checks it before committing
   * state, discarding results from superseded fetches (classic race guard).
   */
  const fetchIdRef = useRef<number>(0);

  // ─── Core fetch with retry ───────────────────────────────────────────────

  const load = useCallback(async (): Promise<void> => {
    if (!clientId) return;

    fetchIdRef.current += 1;
    const thisFetchId = fetchIdRef.current;

    if (isMountedRef.current) {
      setStatus('loading');
      setError(null);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Back off before retrying (not before the first attempt)
      if (attempt > 0) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }

      // Abort if the component unmounted or a newer fetch started
      if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return;

      try {
        const [fetchedCampaigns, fetchedKpis] = await Promise.all([
          fetchMetaCampaigns(clientId),
          fetchCampaignMetrics(clientId),
        ]);

        // Final guard before committing state
        if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return;

        setCampaigns(fetchedCampaigns);
        setKpis(fetchedKpis);
        setStatus('success');
        setError(null);
        setLastUpdated(new Date());
        return; // ← success: exit the retry loop
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[useMetaAds] attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          lastError.message,
        );
      }
    }

    // All retries exhausted
    if (isMountedRef.current && thisFetchId === fetchIdRef.current) {
      setStatus('error');
      setError(lastError?.message ?? 'Erro desconhecido ao carregar campanhas.');
    }
  }, [clientId]);

  // ─── Effect ──────────────────────────────────────────────────────────────

  useEffect(() => {
  isMountedRef.current = true;

  // 📄 Adia a execução para evitar renderizações síncronas em cascata
  setTimeout(() => {
    void load();
  }, 0);

  return () => {
    isMountedRef.current = false;
  };
}, [load]); // certifique-se de manter as dependências corretas do seu hook

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Trigger a fresh fetch manually (e.g. from a "Refresh" button). */
  const refetch = useCallback((): void => {
    void load();
  }, [load]);

  return {
    campaigns,
    kpis,
    status,
    error,
    lastUpdated,
    refetch,
  };
}
