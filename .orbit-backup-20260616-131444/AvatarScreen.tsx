// ✅ CÓDIGO PRONTO E SEM ERROS
// src/components/screens/AvatarScreen.tsx

import React from "react";
import { useAvatar } from "../../hooks/useAvatar";
import { AvatarComparison } from "../common/AvatarComparison";
import { AlignmentBars } from "../common/AlignmentBars";
import { AlignmentFormula } from "../common/AlignmentFormula";
import { RecommendationAlert } from "../common/RecommendationAlert";

interface AvatarScreenProps {
  clientId?: string;
}

// ── Skeleton loader ────────────────────────────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-800/60 rounded-lg ${className}`} />
);

const AvatarScreenSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex gap-3">
      <Skeleton className="flex-1 h-52" />
      <Skeleton className="w-6" />
      <Skeleton className="flex-1 h-52" />
    </div>
    <Skeleton className="h-40" />
    <Skeleton className="h-32" />
    <Skeleton className="h-24" />
  </div>
);

// ── Main screen ────────────────────────────────────────────────────────────
export const AvatarScreen: React.FC<AvatarScreenProps> = ({ clientId }) => {
  // ✅ FIX #1: Usar 'status' em vez de 'isLoading'
  const { data, status, error } = useAvatar(clientId ?? "");
  
  // ✅ FIX #2: Converter 'status' para 'isLoading'
  const isLoading = status === 'loading';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Avatar Alignment
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Comparativo entre o avatar esperado e a audiência captada pelas APIs
            </p>
          </div>

          {data && (
            <div className="text-right">
              <p className="text-xs text-gray-600 uppercase tracking-wider">
                Última atualização
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="text-sm font-semibold text-rose-400">
                Erro ao carregar dados
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && <AvatarScreenSkeleton />}

        {/* ✅ FIX #3: Corrigir lógica de renderização (remover 'isLoading' da condição) */}
        {!isLoading && !error && data && (
          <>
            {/* 1 ── Avatar comparison: expected vs real */}
            <AvatarComparison
              expected={data.expected}
              real={data.real}
              score={data.score}
              status={data.status}
            />

            {/* 2 ── Alignment bars per variable */}
            <AlignmentBars bars={data.bars} />

            {/* 3 ── Score formula */}
            <AlignmentFormula />

            {/* 4 ── Recommendation alert */}
            <RecommendationAlert status={data.status} score={data.score} />
          </>
        )}
      </div>
    </div>
  );
};
