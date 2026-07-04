/* ==========================================================================
   ORBIT · AvatarScreen
   Caminho: src/components/screens/AvatarScreen.tsx

   FIX (bug 2 da dupla causa do "Cliente não identificado"):
   - A rota real é "/instagram/avatar" (sem segmento dinâmico [clientId]),
     então useParams<{ clientId: string }>() SEMPRE retorna undefined
     aqui. E o AvatarPage.tsx não passa <AvatarScreen clientId={...} />.
   - Resultado: este componente nunca enxergava o clientId que o
     OrbitDashboardProvider (em volta dele, no page.tsx) já tinha correto.
   - Troca: lê clientId direto do contexto compartilhado
     (useOrbitDashboard()), que é a mesma fonte que o FunnelScreen já usa
     com sucesso. propClientId continua funcionando como override manual,
     caso algum dia exista uma rota dinâmica de verdade.
   ========================================================================== */

import React from "react";
import { useOrbitDashboard } from "../../context/OrbitDashboardContext";
import { useAvatar } from "../../hooks/useAvatar";
import { AvatarComparison } from "../common/AvatarComparison";
import { AlignmentBars } from "../common/AlignmentBars";
import { AlignmentFormula } from "../common/AlignmentFormula";
import { RecommendationAlert } from "../common/RecommendationAlert";

interface AvatarScreenProps {
  clientId?: string;
}

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

export const AvatarScreen: React.FC<AvatarScreenProps> = ({ clientId: propClientId }) => {
  // ✅ PASSO 1: clientId vem do contexto compartilhado (mesma fonte que o
  // FunnelScreen já usa corretamente), com propClientId como override manual.
  const { clientId: contextClientId } = useOrbitDashboard();
  const clientId = propClientId || contextClientId;

  // ✅ PASSO 2: Chamar hook (ANTES de guards)
  const { data, status, error } = useAvatar(clientId || "");
  const isLoading = status === 'loading';

  // ✅ PASSO 3: Guard após hook
  if (!clientId) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Cliente não identificado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

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

        {isLoading && <AvatarScreenSkeleton />}

        {!isLoading && !error && data && (
          <>
            <AvatarComparison
              expected={data.expected}
              real={data.real}
              score={data.score}
              status={data.status}
            />

            <AlignmentBars bars={data.bars} />

            <AlignmentFormula />

            <RecommendationAlert status={data.status} score={data.score} />
          </>
        )}
      </div>
    </div>
  );
};