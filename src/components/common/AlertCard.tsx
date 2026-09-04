import React, { useState } from 'react'
import type { Alert } from '@/types/alert'
import { markAlertAsRead } from '@/lib/repositories/alertsRepository'

interface AlertCardProps {
  alert: Alert
  onAcknowledge?: () => Promise<void> | void
}

export default function AlertCard({ alert, onAcknowledge }: AlertCardProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)

  // ✅ CORRIGIDO: Função async que aguarda a mutação ANTES de chamar o callback
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

  const severityColors: Record<string, string> = {
    critical: 'border-red-500/40 bg-red-500/5',
    warning: 'border-amber-500/40 bg-amber-500/5',
    info: 'border-blue-500/40 bg-blue-500/5',
    success: 'border-green-500/40 bg-green-500/5',
  }

  const severityIcons: Record<string, string> = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
    success: '✅',
  }

  const severityLabels: Record<string, string> = {
    critical: 'Crítico',
    warning: 'Atenção',
    info: 'Info',
    success: 'Sucesso',
  }

  const borderColor = severityColors[alert.severity] || severityColors.info
  const icon = severityIcons[alert.severity] || severityIcons.info
  const label = severityLabels[alert.severity] || severityLabels.info

  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${borderColor}`}>
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <span className="text-lg">{icon}</span>
        {!alert.isResolved && <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-sans font-semibold text-sm text-white">{alert.title}</h3>
          <time className="font-mono text-xs text-zinc-500 whitespace-nowrap">
            {new Date(alert.createdAt).toLocaleDateString('pt-BR')}
          </time>
        </div>

        {alert.description && (
          <p className="font-sans text-xs text-zinc-400">{alert.description}</p>
        )}

        {alert.metricName && alert.metricValue !== null && (
          <p className="font-mono text-xs text-zinc-500">
            <span className="text-zinc-400">{alert.metricName}:</span>{' '}
            <span className="font-semibold text-white">{alert.metricValue.toFixed(2)}</span>
            {alert.thresholdValue !== null && (
              <>
                {' '}
                <span className="text-zinc-600">vs</span>{' '}
                <span className="text-zinc-400">{alert.thresholdValue.toFixed(2)}</span>
              </>
            )}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <span className="inline-flex rounded-full bg-zinc-900/50 px-2.5 py-1 font-mono text-[10px] font-medium text-zinc-400">
            {label}
          </span>

          {alert.clientName && (
            <span className="inline-flex rounded-full bg-zinc-900/50 px-2.5 py-1 font-mono text-[10px] font-medium text-zinc-400">
              {alert.clientHandle ? `@${alert.clientHandle}` : alert.clientName}
            </span>
          )}

          {!alert.isResolved && (
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={isLoading}
              className="ml-auto rounded-full bg-zinc-700/50 px-3 py-1 font-sans text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resolvendo...' : 'Resolver'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}