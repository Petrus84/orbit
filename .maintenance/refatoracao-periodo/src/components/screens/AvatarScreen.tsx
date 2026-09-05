// src/components/screens/AvatarScreen.tsx
// ✅ VERSÃO 4.0: Migrado de Tailwind ad-hoc (gray-950/blue-600, paleta
// genérica desconectada do design system) para AvatarScreen.module.css —
// o CSS Module já existia, token-based (--bg/--t0/--acc/--space-*),
// e já era usado corretamente por AvatarCard/AvatarComparison/AlignmentBars.
// A v3.0 tinha parado de importá-lo e reimplementado o shell da tela em
// Tailwind com valores arbitrários (max-w-4xl, bg-blue-600...) que não
// existem em nenhum outro lugar do app — causa raiz do visual
// desproporcional/inconsistente entre o shell e os componentes filhos.
//
// Mudanças desta versão:
// - Todo o shell (header, estados de loading/erro/retry, skeleton) agora
//   usa var(--*) via AvatarScreen.module.css, mesma linguagem visual dos
//   filhos.
// - Os 5 estados de erro de useAvatar() (NO_DATA/NETWORK_ERROR/
//   VALIDATION_FAILED/UNKNOWN/sem código) foram unificados num único
//   layout (.center/.stateIcon/.stateTitle/.stateBody/.detailCard),
//   parametrizado por conteúdo — elimina 5 blocos JSX quase idênticos
//   com wrappers Tailwind duplicados.
// - Botão de ação primário usa --acc (lima, o único acento do sistema),
//   não mais bg-blue-600 (cor que não aparece em nenhum outro componente
//   do app).

'use client'

import React from 'react'
import { useOrbitDashboard } from '@/context/OrbitDashboardContext'
import { useAvatar } from '@/hooks/useAvatar'
import { AvatarComparison } from '@/components/common/AvatarComparison'
import { AlignmentBars } from '@/components/common/AlignmentBars'
import { AlignmentFormula } from '@/components/common/AlignmentFormula'
import { RecommendationAlert } from '@/components/common/RecommendationAlert'
import styles from './AvatarScreen.module.css'

interface AvatarScreenProps {
  clientId?: string
}

// ─── Skeleton ────────────────────────────────────────────────────────────

const AvatarScreenSkeleton: React.FC = () => (
  <div className={styles.skeletonStack}>
    <div className={styles.skeletonRow}>
      <div className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ flex: 1 }} />
      <div className={styles.skeleton} style={{ width: 24 }} />
      <div className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ flex: 1 }} />
    </div>
    <div className={`${styles.skeleton} ${styles.skeletonBars}`} />
    <div className={`${styles.skeleton} ${styles.skeletonFormula}`} />
    <div className={`${styles.skeleton} ${styles.skeletonRecs}`} />
  </div>
)

// ─── Header (compartilhado pelos estados loading e sucesso) ──────────────

const Header: React.FC<{ lastUpdatedLabel?: string }> = ({ lastUpdatedLabel }) => (
  <div className={styles.headerRow}>
    <div className={styles.headerText}>
      <h1 className={styles.title}>Avatar Alignment</h1>
      <p className={styles.subtitle}>
        Comparativo entre o avatar esperado e a audiência captada pelas APIs
      </p>
    </div>

    {lastUpdatedLabel && (
      <div>
        <p className={styles.metaLabel}>Última atualização</p>
        <p className={styles.metaValue}>{lastUpdatedLabel}</p>
      </div>
    )}
  </div>
)

// ─── Estado centralizado genérico (reutilizado pelos 5 estados de erro) ──

interface CenterStateProps {
  icon: string
  spin?: boolean
  title: string
  body: string
  detailTitle?: string
  detailItems?: string[]
  detailRaw?: string
  primaryAction?: { label: string; onClick: () => void }
  hint?: string
}

const CenterState: React.FC<CenterStateProps> = ({
  icon,
  spin,
  title,
  body,
  detailTitle,
  detailItems,
  detailRaw,
  primaryAction,
  hint,
}) => (
  <div className={styles.center}>
    <div className={styles.centerInner}>
      <span className={`${styles.stateIcon} ${spin ? styles.stateIconSpin : ''}`}>{icon}</span>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateBody}>{body}</p>

      {(detailItems || detailRaw) && (
        <div className={styles.detailCard}>
          {detailTitle && <p className={styles.detailTitle}>{detailTitle}</p>}
          {detailItems && (
            <ul className={styles.detailList}>
              {detailItems.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          )}
          {detailRaw && <code className={styles.errorDetail}>{detailRaw}</code>}
        </div>
      )}

      {primaryAction && (
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
      )}
    </div>
  </div>
)

export const AvatarScreen: React.FC<AvatarScreenProps> = ({ clientId: propClientId }) => {
  const { clientId: contextClientId } = useOrbitDashboard()
  const clientId = propClientId || contextClientId

  const { data, status, error, errorCode, isRetrying, refetch } = useAvatar(clientId || '')

  const isLoading = status === 'loading' && !isRetrying
  const isError = status === 'error'
  const isSuccess = status === 'success' && data

  // ─── GUARD: Cliente não identificado ────────────────────────────────────

  if (!clientId) {
    return (
      <div className={styles.page}>
        <CenterState icon="❓" title="Cliente não identificado" body="" />
      </div>
    )
  }

  // ─── ESTADO: Carregando ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Header />
        <AvatarScreenSkeleton />
      </div>
    )
  }

  // ─── ESTADO: Tentando reconectar ───────────────────────────────────────

  if (isRetrying) {
    return (
      <div className={styles.page}>
        <CenterState
          icon="🔄"
          spin
          title="Tentando reconectar..."
          body="Por favor, aguarde."
        />
      </div>
    )
  }

  // ─── ESTADO: Erro NO_DATA (Cliente sem avatar) ──────────────────────────

  if (isError && errorCode === 'NO_DATA') {
    return (
      <div className={styles.page}>
        <CenterState
          icon="📊"
          title="Avatar não configurado"
          body="Este cliente ainda não possui um alinhamento de avatar configurado no sistema."
          detailTitle="O que fazer:"
          detailItems={[
            'Verifique se o cliente foi criado corretamente',
            'Confirme que os dados de avatar foram sincronizados',
            'Configure um novo avatar para este cliente se necessário',
          ]}
          primaryAction={{ label: '🔄 Tentar Novamente', onClick: refetch }}
        />
      </div>
    )
  }

  // ─── ESTADO: Erro NETWORK_ERROR (Conexão) ───────────────────────────────

  if (isError && errorCode === 'NETWORK_ERROR') {
    return (
      <div className={styles.page}>
        <CenterState
          icon="🌐"
          title="Erro de conexão"
          body="Não foi possível conectar ao servidor para buscar os dados de avatar."
          detailTitle="Possíveis causas:"
          detailItems={[
            'Sua conexão com a internet pode estar instável',
            'O servidor pode estar temporariamente indisponível',
            'Verifique sua conexão e tente novamente',
          ]}
          primaryAction={{ label: '🔗 Reconectar', onClick: refetch }}
        />
      </div>
    )
  }

  // ─── ESTADO: Erro VALIDATION_FAILED (Dados inválidos) ────────────────────

  if (isError && errorCode === 'VALIDATION_FAILED') {
    return (
      <div className={styles.page}>
        <CenterState
          icon="⚠️"
          title="Dados inválidos recebidos"
          body="O servidor retornou dados que não passaram na validação."
          detailTitle="Detalhes do erro:"
          detailRaw={error ?? undefined}
          primaryAction={{ label: '🔄 Tentar Novamente', onClick: refetch }}
          hint="Se o problema persistir, entre em contato com o suporte."
        />
      </div>
    )
  }

  // ─── ESTADO: Erro UNKNOWN (Genérico) ────────────────────────────────────

  if (isError && errorCode === 'UNKNOWN') {
    return (
      <div className={styles.page}>
        <CenterState
          icon="❌"
          title="Erro desconhecido"
          body="Ocorreu um erro inesperado ao carregar o alinhamento de avatar."
          detailTitle="Mensagem:"
          detailRaw={error ?? undefined}
          primaryAction={{ label: '🔄 Tentar Novamente', onClick: refetch }}
          hint="Verifique o console do navegador para mais detalhes."
        />
      </div>
    )
  }

  // ─── ESTADO: Erro genérico (sem errorCode) ──────────────────────────────

  if (isError && !errorCode) {
    return (
      <div className={styles.page}>
        <div className={styles.genericErrorBanner}>
          <span className={styles.stateIcon} style={{ fontSize: 24, marginBottom: 0 }}>❌</span>
          <div>
            <p className={styles.genericErrorTitle}>Erro ao carregar dados</p>
            <p className={styles.genericErrorBody}>{error || 'Erro desconhecido'}</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Sucesso ─────────────────────────────────────────────────────

  if (isSuccess) {
    const lastUpdatedLabel = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div className={styles.page}>
        <Header lastUpdatedLabel={lastUpdatedLabel} />

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

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={refetch}>
            🔄 Atualizar Dados
          </button>
        </div>
      </div>
    )
  }

  // ─── ESTADO: Idle (nunca deveria chegar aqui) ────────────────────────────

  return (
    <div className={styles.page}>
      <CenterState icon="⏳" title="" body="Pronto para carregar dados de avatar." />
    </div>
  )
}