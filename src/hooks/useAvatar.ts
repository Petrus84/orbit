// ─── useAvatar ────────────────────────────────────────────────────────────────
// Custom React hook for the Avatar Alignment screen.
// Handles fetching, retry with exponential backoff, and race-condition safety
// under React 18 StrictMode (double-invoke of effects).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAvatarAlignment } from '../lib/repositories/avatarRepository';
import type { AvatarAlignment, FetchStatus } from '../types/avatar';

// ─── Public shape ─────────────────────────────────────────────────────────────

export interface UseAvatarReturn {
  data: AvatarAlignment | null;
  status: FetchStatus;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
/** Base delay in ms; actual delay = BASE_DELAY_MS * 2^attempt */
const BASE_DELAY_MS = 500;

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAvatar(clientId: string): UseAvatarReturn {
  const [data, setData] = useState<AvatarAlignment | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * isMountedRef — flipped to false in the cleanup so async continuations
   * after an unmount do not trigger state updates.
   * Critical under React 18 StrictMode, which unmounts/remounts in dev.
   */
  const isMountedRef = useRef<boolean>(false);

  /**
   * fetchIdRef — each call to load() increments this counter.
   * Async branches capture their own id and bail if a newer fetch has started,
   * preventing stale results from overwriting fresher ones.
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
      // Exponential backoff before retries (skip on first attempt)
      if (attempt > 0) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }

      // Abort if unmounted or superseded
      if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return;

      try {
        const alignment = await fetchAvatarAlignment(clientId);

        // Final guard before committing state
        if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return;

        setData(alignment);
        setStatus('success');
        setError(null);
        setLastUpdated(new Date());
        return; // ← success: exit retry loop
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[useAvatar] attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          lastError.message,
        );
      }
    }

    // All retries exhausted
    if (isMountedRef.current && thisFetchId === fetchIdRef.current) {
      setStatus('error');
      setError(lastError?.message ?? 'Erro desconhecido ao carregar alinhamento de avatar.');
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

  /** Trigger a fresh fetch manually — e.g. from a "Atualizar" button. */
  const refetch = useCallback((): void => {
    void load();
  }, [load]);

  return {
    data,
    status,
    error,
    lastUpdated,
    refetch,
  };
}
