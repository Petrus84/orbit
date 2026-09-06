'use client'
import React from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import styles from './SectorPositioningPanel.module.css'
import type { SectorPositioning, ClassifiedMetric } from '@/types/orbit'

export interface SectorPositioningPanelProps {
positioning: SectorPositioning
}

const SETOR_LABEL: Record<string, string> = {
comercio_direto_ecommerce_social: 'Comércio direto — e-commerce social',
comissionamento_afiliados: 'Comissionamento e afiliados',
infoprodutor_educador_pago: 'Infoprodutor / educador pago',
servico_consultoria_profissional: 'Serviço / consultoria profissional',
patrocinio_publicidade_marca: 'Patrocínio e publicidade de marca',
membership_assinatura_comunidade: 'Membership / assinatura de comunidade',
monetizacao_nativa_plataforma: 'Monetização nativa de plataforma',
autoridade_personal_branding_b2b: 'Autoridade / personal branding B2B',
pre_monetizacao_a_validar: 'Pré-monetização — a validar',
}

const FUNNEL_LABEL: Record<string, string> = {
nao_implementado: 'Não implementado',
implementado_fragmentado: 'Implementado, fragmentado',
implementado_unificado: 'Implementado, unificado',
}

const PROOF_LABEL: Record<string, string> = {
prova_social: 'Prova social',
autoridade: 'Autoridade',
escassez_urgencia: 'Escassez / urgência',
associacao_marca: 'Associação de marca',
resultado_documentado: 'Resultado documentado',
nenhum_observavel: 'Nenhum mecanismo observável',
}

// ✅ CORRIGIDO: Função agora tem corpo completo
function metricCard(
label: string,
value: number | null,
metric: ClassifiedMetric | null
) {
const isAmar = metric?.semaphore === 'ambar'
const isVerm = metric?.semaphore === 'vermelho'
const badgeCls = isVerm
  ? styles.badgeDanger
  : isAmar
    ? styles.badgeWarning
    : styles.badgeNeutral

return (
  <div className={styles.metricCard} key={label}>
    <p className={styles.metricLabel}>{label}</p>
    <p className={styles.metricValue}>
      {value != null ? value.toFixed(2) : '—'}
    </p>
    <span className={badgeCls}>
      {metric?.statusText ?? 'Sem threshold definido ainda'}
    </span>
  </div>
)
}

export function SectorPositioningPanel({
positioning,
}: SectorPositioningPanelProps) {
const setorLabel = positioning.setorBenchmark
  ? SETOR_LABEL[positioning.setorBenchmark] ?? positioning.setorBenchmark
  : 'Não classificado'

const funnelLabel = positioning.funnelMaturity
  ? FUNNEL_LABEL[positioning.funnelMaturity] ?? positioning.funnelMaturity
  : '—'

const proofLabel = positioning.proofMechanism
  ? PROOF_LABEL[positioning.proofMechanism] ?? positioning.proofMechanism
  : '—'

const ruleDeclaration =
  positioning.polemicScore?.ruleDeclaration ??
  positioning.erReal?.ruleDeclaration ??
  positioning.vps?.ruleDeclaration ??
  null

return (
  <GlassCard glowColor="cyan" className={styles.panel}>
    <p className={styles.panelTitle}>POSICIONAMENTO</p>

    <div className={styles.infoRow}>
      <div className={styles.infoCard}>
        <p className={styles.infoLabel}>Setor classificado</p>
        <p className={styles.infoValue}>{setorLabel}</p>
        {positioning.nicho && (
          <p className={styles.infoSub}>{positioning.nicho}</p>
        )}
      </div>
      <div className={styles.infoCard}>
        <p className={styles.infoLabel}>Funil e prova social</p>
        <p className={styles.infoValue}>{funnelLabel}</p>
        <p className={styles.infoSub}>
          Mecanismo de prova: {proofLabel.toLowerCase()}
        </p>
      </div>
    </div>

    <p className={styles.blockLabel}>
      BENCHMARKING{' '}
      {positioning.erReal?.thresholdSource === 'global'
        ? '— régua global'
        : '— régua do setor'}
    </p>

    <div className={styles.metricsRow}>
      {/* ✅ CORRIGIDO: Usar campo .value em vez de fazer parse de statusText */}
      {metricCard(
        'ER real',
        positioning.erReal?.value ?? null,
        positioning.erReal ?? null
      )}
      {metricCard(
        'VPS',
        positioning.vps?.value ?? null,
        positioning.vps ?? null
      )}
      {metricCard(
        'Score polêmica',
        positioning.polemicScore?.value ?? null,
        positioning.polemicScore ?? null
      )}
    </div>

    {ruleDeclaration && (
      <p className={styles.ruleText}>{ruleDeclaration}</p>
    )}
  </GlassCard>
)
}