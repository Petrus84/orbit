/**
 * ============================================================================
 * AlertCard — Refatoração SSOT 07/09/2026
 * ============================================================================
 *
 * 🐛 CORRIGIDO (auditoria vs protótipo SSOT):
 * 1) Ícone: existia um SEGUNDO vocabulário de ícones, local e hardcoded por
 *    `severity` (🚨/⚠️/ℹ️/✅), duplicando — com valores diferentes — o que
 *    `AlertIcon.tsx` já resolve corretamente por `alert.type` (vocabulário
 *    único, 9 valores, mesmo enum do Postgres). O protótipo mostra ícone por
 *    TIPO de alerta (⚡ CTR, 📉 engajamento, 🎯 avatar, 💸 ROAS, 🚀 boost...),
 *    não por severidade — a versão anterior nunca conseguiria reproduzir
 *    isso. Trocado para <AlertIcon type={...} />.
 *    ⚠️ CORRIGIDO (rodada 2 — tsc): `Alert.type` em orbit.ts é `string`
 *    solto (contrato de domínio propositalmente mais largo que o enum do
 *    banco), enquanto `AlertIcon` exige `AlertType`. Passar `alert.type`
 *    direto quebra `tsc`. Usa o guard `isAlertType()` — já exportado por
 *    `alertsRepository.ts`, mesmo lugar que já faz esse narrowing pro
 *    insert — em vez de um cast forçado (`as AlertType`), que esconderia
 *    um valor de fato inválido em vez de degradar com segurança.
 * 2) Cor: classes Tailwind com paleta padrão (`red-500`, `amber-500`,
 *    `blue-500`, `green-500`) — fora da paleta neon do SSOT
 *    (--neon-red/--neon-gold/--neon-cyan definidas em ssot-design-tokens.css
 *    e já usadas por Semaphore.tsx). Substituído por `AlertCard.module.css`,
 *    que já existia pronto no projeto — SSOT-aligned — mas nunca era
 *    importado por este componente (arquivo órfão).
 * 3) Ação contextual: `alert.action` (populado por alertsRepository.ts a
 *    partir de `action_url`, ex.: link para o simulador de funil) era
 *    ignorado por completo — só existia um botão genérico "Resolver". O
 *    protótipo mostra o botão de ação específico ("Simular funil",
 *    "Diagnóstico completo"...) — corrigido para renderizar o link real
 *    quando existir, mantendo "Resolver" como ação secundária de
 *    reconhecimento.
 * 4) `suggestedAction` (texto de recomendação vindo do banco) também não
 *    era exibido — adicionado como linha auxiliar, mesmo padrão do
 *    `alert-text` do protótipo.
 * 5) Adicionada variante `.success` ausente em AlertCard.module.css
 *    (severity inclui 'success' em AlertSeverity, mas o módulo só cobria
 *    critical/warning/info).
 * ============================================================================
 */

import React, { useState } from 'react'
import Link from 'next/link'
import type { Alert } from '@/types/alert'
import { markAlertAsRead, isAlertType } from '@/lib/repositories/alertsRepository'
import AlertIcon from './AlertIcon'
import styles from './AlertCard.module.css'

interface AlertCardProps {
  alert: Alert
  onAcknowledge?: () => Promise<void> | void
}

// PR-F (parcial) / TS2322: com `noUncheckedIndexedAccess`, o import de
// AlertCard.module.css (só tem index signature, sem propriedades
// declaradas) faz `styles.critical` etc. tiparem como `string | undefined`
// — mesmo as 4 classes existindo de fato no CSS (confirmado acima:
// .critical/.warning/.info/.success). `?? ''` satisfaz o tsc sem mudar
// comportamento em runtime (a classe real nunca é undefined de verdade).
const SEVERITY_CLASS: Record<Alert['severity'], string> = {
  critical: styles.critical ?? '',
  warning: styles.warning ?? '',
  info: styles.info ?? '',
  success: styles.success ?? '',
}

const SEVERITY_LABEL: Record<Alert['severity'], string> = {
  critical: 'Crítico',
  warning: 'Atenção',
  info: 'Info',
  success: 'Resolvido',
}

export default function AlertCard({ alert, onAcknowledge }: AlertCardProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)

  async function handleAcknowledge(): Promise<void> {
    try {
      setIsLoading(true)
      // 1. Aguarda a gravação no banco
      await markAlertAsRead(alert.id)
      // 2. Executa o refetch após o sucesso (evita race condition)
      await onAcknowledge?.()
    } catch (err) {
      console.error('[AlertCard] Erro ao reconhecer alerta:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const severityClass = SEVERITY_CLASS[alert.severity] ?? styles.info
  const severityLabel = SEVERITY_LABEL[alert.severity] ?? 'Info'
  // `alert.type` é `string` no contrato de domínio (orbit.ts) — mais largo
  // que o enum `AlertType` que `AlertIcon` exige. Narrowing explícito em
  // vez de cast: um valor fora do enum vira fallback genérico, não erro.
  const iconType = isAlertType(alert.type) ? alert.type : null

  return (
    <div className={`${styles.card} ${severityClass}`} aria-live="polite">
      <div className={styles.icon}>
        {iconType ? (
          <AlertIcon type={iconType} />
        ) : (
          <span role="img" aria-label="alerta" className="select-none">
            🔔
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>{alert.title}</h3>
          <time className={styles.timestamp}>
            {new Date(alert.createdAt).toLocaleDateString('pt-BR')}
          </time>
        </div>

        {alert.description && <p className={styles.text}>{alert.description}</p>}

        {alert.metricName && alert.metricValue !== null && (
          <p className={styles.text}>
            {alert.metricName}: <strong>{alert.metricValue.toFixed(2)}</strong>
            {alert.thresholdValue !== null && (
              <>
                {' '}vs <strong>{alert.thresholdValue.toFixed(2)}</strong>
              </>
            )}
          </p>
        )}

        {alert.suggestedAction && <p className={styles.text}>💡 {alert.suggestedAction}</p>}

        <div className={styles.action}>
          <span className={`${styles.severityBadge} ${severityClass}`}>{severityLabel}</span>

          {alert.clientName && (
            <span className={`${styles.btn} ${styles.btnGhost}`}>
              {alert.clientHandle ? `@${alert.clientHandle}` : alert.clientName}
            </span>
          )}

          {alert.action?.type === 'link' && alert.action.url && (
            <Link href={alert.action.url} className={styles.btn}>
              {alert.action.label}
            </Link>
          )}

          {!alert.isResolved && (
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={isLoading}
              className={`${styles.btn} ${styles.btnGhost}`}
            >
              {isLoading ? 'Resolvendo...' : 'Resolver'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}