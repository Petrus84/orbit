// src/components/screens/AvatarScreen.tsx
// ✅ VERSÃO 3.0: Compatível com código existente + correções do repositório e hook
//
// Mudanças:
// - Adiciona errorCode e isRetrying do hook v2.0
// - Mantém a lógica de contexto (useOrbitDashboard)
// - Mantém a estrutura Tailwind existente
// - Adiciona 4 estados de erro distintos
// - Adiciona feedback visual de retry

'use client'

import React from 'react'
import { useOrbitDashboard } from '../../context/OrbitDashboardContext'
import { useAvatar } from '../../hooks/useAvatar'
import { AvatarComparison } from '../common/AvatarComparison'
import { AlignmentBars } from '../common/AlignmentBars'
import { AlignmentFormula } from '../common/AlignmentFormula'
import { RecommendationAlert } from '../common/RecommendationAlert'

interface AvatarScreenProps {
  clientId?: string
}

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-800/60 rounded-lg ${className}`} />
)

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
)

export const AvatarScreen: React.FC<AvatarScreenProps> = ({ clientId: propClientId }) => {
  // ✅ PASSO 1: Obter clientId do contexto ou prop
  const { clientId: contextClientId } = useOrbitDashboard()
  const clientId = propClientId || contextClientId

  // ✅ PASSO 2: Chamar hook com TODOS os novos campos
  const { data, status, error, errorCode, isRetrying, refetch } = useAvatar(clientId || '')

  // ✅ PASSO 3: Derivar estados
  const isLoading = status === 'loading' && !isRetrying
  const isError = status === 'error'
  const isSuccess = status === 'success' && data

  // ─── GUARD: Cliente não identificado ──────────────────────────────────────

  if (!clientId) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">❓</p>
          <p className="text-gray-400">Cliente não identificado</p>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Carregando ───────────────────────────────────────────────────

  if (isLoading) {
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
          </div>
          <AvatarScreenSkeleton />
        </div>
      </div>
    )
  }

  // ─── ESTADO: Tentando reconectar ──────────────────────────────────────────

  if (isRetrying) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4 animate-spin">🔄</p>
          <p className="text-gray-300 text-lg">Tentando reconectar...</p>
          <p className="text-gray-500 text-sm mt-2">Por favor, aguarde.</p>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Erro NO_DATA (Cliente sem avatar) ────────────────────────────

  if (isError && errorCode === 'NO_DATA') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4">📊</p>
          <h2 className="text-2xl font-bold text-white mb-2">Avatar não configurado</h2>
          <p className="text-gray-400 mb-6">
            Este cliente ainda não possui um alinhamento de avatar configurado no sistema.
          </p>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-300 mb-3">O que fazer:</p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>✓ Verifique se o cliente foi criado corretamente</li>
              <li>✓ Confirme que os dados de avatar foram sincronizados</li>
              <li>✓ Configure um novo avatar para este cliente se necessário</li>
            </ul>
          </div>
          <button
            onClick={refetch}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            🔄 Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Erro NETWORK_ERROR (Conexão) ─────────────────────────────────

  if (isError && errorCode === 'NETWORK_ERROR') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4">🌐</p>
          <h2 className="text-2xl font-bold text-white mb-2">Erro de conexão</h2>
          <p className="text-gray-400 mb-6">
            Não foi possível conectar ao servidor para buscar os dados de avatar.
          </p>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-300 mb-3">Possíveis causas:</p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>✓ Sua conexão com a internet pode estar instável</li>
              <li>✓ O servidor pode estar temporariamente indisponível</li>
              <li>✓ Verifique sua conexão e tente novamente</li>
            </ul>
          </div>
          <button
            onClick={refetch}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            🔗 Reconectar
          </button>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Erro VALIDATION_FAILED (Dados inválidos) ──────────────────────

  if (isError && errorCode === 'VALIDATION_FAILED') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-2xl font-bold text-white mb-2">Dados inválidos recebidos</h2>
          <p className="text-gray-400 mb-6">
            O servidor retornou dados que não passaram na validação.
          </p>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-300 mb-2">Detalhes do erro:</p>
            <code className="text-xs text-gray-400 break-words block">{error}</code>
          </div>
          <div className="space-y-3">
            <button
              onClick={refetch}
              className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              🔄 Tentar Novamente
            </button>
            <p className="text-xs text-gray-500">
              Se o problema persistir, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Erro UNKNOWN (Genérico) ──────────────────────────────────────

  if (isError && errorCode === 'UNKNOWN') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4">❌</p>
          <h2 className="text-2xl font-bold text-white mb-2">Erro desconhecido</h2>
          <p className="text-gray-400 mb-6">
            Ocorreu um erro inesperado ao carregar o alinhamento de avatar.
          </p>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-gray-300 mb-2">Mensagem:</p>
            <code className="text-xs text-gray-400 break-words block">{error}</code>
          </div>
          <div className="space-y-3">
            <button
              onClick={refetch}
              className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              🔄 Tentar Novamente
            </button>
            <p className="text-xs text-gray-500">
              Verifique o console do navegador para mais detalhes.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Erro genérico (sem errorCode) ───────────────────────────────

  if (isError && !errorCode) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="text-sm font-semibold text-rose-400">Erro ao carregar dados</p>
              <p className="text-xs text-gray-400 mt-0.5">{error || 'Erro desconhecido'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Sucesso ─────────────────────────────────────────────────────

  if (isSuccess) {
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

            <div className="text-right">
              <p className="text-xs text-gray-600 uppercase tracking-wider">
                Última atualização
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <AvatarComparison
            expected={data.expected}
            real={data.real}
            score={data.score}
            status={data.status}
            unconsciousDesireMapped={data.unconsciousDesireMapped}
            misalignmentHypothesis={data.misalignmentHypothesis}
          />

          <AlignmentBars bars={data.bars} />

          <AlignmentFormula />

          <RecommendationAlert status={data.status} score={data.score} />

          <div className="flex justify-center pt-4">
            <button
              onClick={refetch}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg font-medium transition-colors text-sm"
            >
              🔄 Atualizar Dados
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Idle (nunca deveria chegar aqui) ────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <p className="text-gray-400">Pronto para carregar dados de avatar.</p>
    </div>
  )
}