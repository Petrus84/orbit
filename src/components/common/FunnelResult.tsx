'use client'

import React, { useState } from 'react'
import styles from './FunnelResult.module.css'
import type { BottleneckDiagnosis } from '@/types/orbit'

export interface SimulationResult {
  visitas: number
  cliques: number
  vendas: number
  alcanceSimulado: number
  ctrBio: number
  taxaConv: number
}

interface FunnelResultProps {
  result: SimulationResult
  baseVendas: number
  baseCliques: number
  /**
   * Ticket médio (R$) é uma premissa única, editada no simulador — ainda não
   * existe fonte de receita real conectada (nenhuma coluna de faturamento
   * chega via useFunnel/FunnelMetrics). Por isso o mesmo valor é aplicado
   * tanto ao cenário real quanto ao simulado: o que muda entre eles é o
   * número de vendas, não o ticket. Quando houver receita real no banco,
   * troque este prop único por baseTicketMedio/simTicketMedio distintos.
   */
  ticketMedio: number
  onSaveGoal?: (goalName: string) => Promise<void>
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v == null || isNaN(v)) return '0'
  // Antes: Math.round(0.13) virava "0" — indistinguível de um cenário que
  // de fato não gera nenhuma venda. "< 1" preserva a diferença entre
  // "quase lá" e "zero mesmo" sem inventar uma casa decimal falsa.
  if (v > 0 && v < 1) return '< 1'
  if (v < 0 && v > -1) return '> -1'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return Math.round(v).toLocaleString('pt-BR')
}

function formatCurrency(v: number): string {
  if (!Number.isFinite(v)) return 'R$ 0'
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

/**
 * Detecta gargalo quando a simulação não difere do cenário atual —
 * ou seja, o usuário ainda não mexeu em nada relevante.
 */
function detectBottleneck(
  current: { cliques: number; vendas: number },
  simulated: { cliques: number; vendas: number }
): BottleneckDiagnosis {
  const clickDiff = Math.abs(simulated.cliques - current.cliques)
  const salesDiff = Math.abs(simulated.vendas - current.vendas)

  if (clickDiff < 1 && salesDiff < 1) {
    if (current.cliques === 0) {
      return {
        detected: true,
        type: 'zero_clicks',
        message: 'Gargalo detectado: zero cliques no link da bio',
        suggestedAction: 'Revise o CTA ou a visibilidade do link',
        severity: 'critical',
      }
    }
    if (current.vendas === 0) {
      return {
        detected: true,
        type: 'zero_conversions',
        message: 'Gargalo detectado: zero conversões',
        suggestedAction: 'Revise a taxa de conversão ou o funil de vendas',
        severity: 'critical',
      }
    }
    return {
      detected: true,
      type: 'none',
      message: 'Cenário similar ao atual — sem mudanças significativas',
      suggestedAction: 'Ajuste os parâmetros à direita para ver o impacto',
      severity: 'warning',
    }
  }

  return { detected: false, type: 'none', message: '', suggestedAction: '', severity: 'info' }
}

export default function FunnelResult({
  result,
  baseVendas,
  baseCliques,
  ticketMedio,
  onSaveGoal,
}: FunnelResultProps): React.ReactElement {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [goalName, setGoalName] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)

  const safeTicket = Number.isFinite(ticketMedio) ? ticketMedio : 0
  const safeBaseVendas = Number.isFinite(baseVendas) ? baseVendas : 0
  const safeBaseCliques = Number.isFinite(baseCliques) ? baseCliques : 0

  const delta = result.vendas - safeBaseVendas
  const deltaSign = delta >= 0 ? '+' : ''
  const deltaClass =
    delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : styles.deltaNeutral

  const faturamentoSimulado = result.vendas * safeTicket
  const faturamentoBase = safeBaseVendas * safeTicket
  const deltaFaturamento = faturamentoSimulado - faturamentoBase

  const bottleneck = detectBottleneck(
    { cliques: safeBaseCliques, vendas: safeBaseVendas },
    { cliques: result.cliques, vendas: result.vendas }
  )

  // Cenário com venda fracionada (>0 e <1): não é "sem resultado", é um
  // funil que ainda não fecha 1 venda inteira dentro deste alcance. Em vez
  // de deixar o headline em "< 1" sem explicação, mostramos quantos
  // cliques deste mesmo ritmo seriam necessários para fechar a primeira —
  // dá ao usuário uma alavanca concreta (mais alcance, ou melhorar CTR/
  // conversão) em vez de um número que parece erro.
  const isVendaFracionada = result.vendas > 0 && result.vendas < 1
  const cliquesParaFecharUmaVenda =
    isVendaFracionada && result.vendas > 0 ? Math.ceil(result.cliques / result.vendas) : null

  const insight = isVendaFracionada
    ? `Neste ritmo, é preciso algo como ${formatValue(
        cliquesParaFecharUmaVenda ?? 0
      )} cliques para fechar 1 venda — aumente o alcance simulado ou o CTR/conversão para chegar lá dentro deste cenário.`
    : result.vendas > safeBaseVendas * 1.5
    ? 'Potencial alto — vale aumentar o investimento em tráfego.'
    : result.vendas > safeBaseVendas
    ? 'Cenário positivo — pequenos ajustes geram impacto real.'
    : result.vendas < safeBaseVendas * 0.8
    ? 'Cenário desfavorável — revise o CTR da bio ou a taxa de conversão.'
    : 'Cenário similar ao atual.'

  const handleSaveGoal = async () => {
    if (!goalName.trim()) return

    setSaveStatus('saving')
    try {
      if (onSaveGoal) {
        await onSaveGoal(goalName)
      }
      setSaveStatus('success')
      setTimeout(() => {
        setShowSaveModal(false)
        setGoalName('')
        setSaveStatus('idle')
      }, 1800)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  return (
    <div className={styles.card}>
      {bottleneck.detected && (
        <div className={`${styles.bottleneckAlert} ${styles[`bottleneck-${bottleneck.severity}`] ?? ''}`}>
          <div className={styles.bottleneckMessage}>{bottleneck.message}</div>
          <div className={styles.bottleneckAction}>{bottleneck.suggestedAction}</div>
        </div>
      )}

      {/* Vendas estimadas */}
      <div className={styles.headlineBlock}>
        <span className={styles.headlineLabel}>Vendas estimadas</span>
        <div className={styles.headlineRow}>
          <span className={styles.headline}>{formatValue(result.vendas)}</span>
          <span className={`${styles.delta} ${deltaClass}`}>
            {deltaSign}
            {formatValue(delta)}
          </span>
        </div>
      </div>

      {/* Faturamento estimado (R$) */}
      <div className={styles.secondaryRow}>
        <span className={styles.secondaryLabel}>Faturamento estimado</span>
        <div className={styles.secondaryValueBlock}>
          <span className={styles.secondaryValue}>{formatCurrency(faturamentoSimulado)}</span>
          {deltaFaturamento !== 0 && (
            <span
              className={`${styles.secondaryDelta} ${
                deltaFaturamento > 0 ? styles.deltaUp : styles.deltaDown
              }`}
            >
              {deltaFaturamento > 0 ? '+' : '-'}
              {formatCurrency(Math.abs(deltaFaturamento))}
            </span>
          )}
        </div>
      </div>

      {/* Visitas ao perfil — já vinha calculado em funnelMath.ts (alcance ×
          taxa de visita efetiva) mas não era exibido em lugar nenhum; o
          usuário via "alcance" no simulador e "cliques"/"vendas" aqui, sem
          o elo do meio. Exposto para fechar o rastro do funil. */}
      <div className={styles.secondaryRow}>
        <span className={styles.secondaryLabel}>Visitas ao perfil</span>
        <span className={styles.secondaryValue}>{formatValue(result.visitas)}</span>
      </div>

      {/* Cliques no link */}
      <div className={styles.secondaryRow}>
        <span className={styles.secondaryLabel}>Cliques no link</span>
        <span className={styles.secondaryValue}>{formatValue(result.cliques)}</span>
      </div>

      {/* Insight */}
      <p className={styles.insight}>{insight}</p>

      {/* CTA — salvar/exportar meta */}
      <button
        type="button"
        className={styles.ctaButton}
        onClick={() => setShowSaveModal(true)}
        disabled={saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? 'Salvando…' : 'Salvar meta deste cenário'}
      </button>

      {showSaveModal && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Salvar meta de funil</h3>

            <input
              type="text"
              placeholder="Ex: Meta de 150 vendas/mês"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className={styles.modalInput}
              disabled={saveStatus === 'saving'}
              autoFocus
            />

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => {
                  setShowSaveModal(false)
                  setGoalName('')
                }}
                disabled={saveStatus === 'saving'}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={handleSaveGoal}
                disabled={!goalName.trim() || saveStatus === 'saving'}
              >
                {saveStatus === 'success' ? 'Salvo!' : 'Salvar'}
              </button>
            </div>

            {saveStatus === 'error' && (
              <div className={styles.modalError}>Erro ao salvar. Tente novamente.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}