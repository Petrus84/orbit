'use client'
import { GlassCard } from '@/components/common/GlassCard'
import styles from './SectorPositioningPanel.module.css'
import type { SectorPositioning, ClassifiedMetric } from '@/types/orbit'

export interface SectorPositioningPanelProps {
positioning: SectorPositioning
}

// Slug desconhecido nunca vai cru pra tela ("funil_basico" -> "Funil basico").
function humanizeSlug(slug: string): string {
  const t = slug.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const SETOR_LABEL: Record<string, string> = {
saas_ferramenta: 'SaaS / ferramenta',
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
funil_basico: 'Funil básico',
nao_implementado: 'Não implementado',
implementado_fragmentado: 'Implementado, fragmentado',
implementado_unificado: 'Implementado, unificado',
}

const PROOF_LABEL: Record<string, string> = {
clientes_ativos_gestao: 'Clientes ativos em gestão',
prova_social: 'Prova social',
autoridade: 'Autoridade',
escassez_urgencia: 'Escassez / urgência',
associacao_marca: 'Associação de marca',
resultado_documentado: 'Resultado documentado',
nenhum_observavel: 'Nenhum mecanismo observável',
}

const fmtValue = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

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
// Sem régua de mercado (thresholdSource null): sem badge no card — o bloco
// diz isso UMA vez, em vez de repetir a mesma frase em cada card.
const hasVerdict = metric != null && metric.thresholdSource !== null

return (
  <div className={styles.metricCard} key={label}>
    <p className={styles.metricLabel}>{label}</p>
    <p className={styles.metricValue}>
      {value != null ? fmtValue(value) : '—'}
    </p>
    {hasVerdict && <span className={badgeCls}>{metric.statusText}</span>}
  </div>
)
}

// ✅ NOVO (18/09/2026) — algo_risk_score, família Ln. Card separado de
// metricCard() de propósito: nunca tem semaphore verde/ambar/vermelho de
// mercado (não é ClassifiedMetric), só um badge neutro — o valor é sempre
// "vs. você mesmo", nunca "vs. setor".
function algoRiskCard(algoRisk: SectorPositioning['algoRisk']) {
  const value = algoRisk?.value ?? null
  return (
    <div className={styles.metricCard} key="algo-risk">
      <p className={styles.metricLabel}>Risco algorítmico (série própria)</p>
      <p className={styles.metricValue}>
        {value != null ? value.toFixed(2).replace('.', ',') : '—'}
      </p>
      {algoRisk?.statusText && (
        <span className={styles.badgeNeutral}>{algoRisk.statusText}</span>
      )}
    </div>
  )
}

export function SectorPositioningPanel({
positioning,
}: SectorPositioningPanelProps) {
const setorLabel = positioning.setorBenchmark
  ? SETOR_LABEL[positioning.setorBenchmark] ?? humanizeSlug(positioning.setorBenchmark)
  : 'Não classificado'

const funnelLabel = positioning.funnelMaturity
  ? FUNNEL_LABEL[positioning.funnelMaturity] ?? humanizeSlug(positioning.funnelMaturity)
  : '—'

const proofLabel = positioning.proofMechanism
  ? PROOF_LABEL[positioning.proofMechanism] ?? humanizeSlug(positioning.proofMechanism)
  : '—'

const withRule = [positioning.polemicScore, positioning.erReal, positioning.vps].filter(
  (m): m is ClassifiedMetric => m != null && m.thresholdSource !== null
)
const ruleDeclaration = withRule[0]?.ruleDeclaration ?? null

const noMarket: string[] = []
if (positioning.erReal && positioning.erReal.thresholdSource === null) noMarket.push('ER real')
if (positioning.vps && positioning.vps.thresholdSource === null) noMarket.push('VPS')
const noMarketNote = noMarket.length
  ? `${noMarket.join(' e ')} sem comparação de mercado — acompanhe a evolução da própria conta.`
  : null

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

    {/* ✅ CORRIGIDO (PR-A/PR-B): thresholdSource agora pode ser null (sem
        recorte de mercado — er_real_pct/vps_pct hoje). Antes disso, null
        caía no ramo "— régua do setor" por padrão, texto que essas duas
        métricas nunca tiveram. Só polêmica hoje tem régua real; o rótulo
        reflete cada métrica individualmente, não uma frase única pro bloco. */}
    <p className={styles.blockLabel}>BENCHMARKING</p>

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
    {noMarketNote && <p className={styles.ruleText}>{noMarketNote}</p>}

    {/* ✅ NOVO (18/09/2026): seção separada, rótulo distinto de
        "BENCHMARKING" de propósito — algo_risk_score é família Ln
        (self-reference), nunca compara com mercado/setor. */}
    <p className={styles.blockLabel}>SÉRIE PRÓPRIA</p>
    <div className={styles.metricsRow}>
      {algoRiskCard(positioning.algoRisk)}
    </div>
  </GlassCard>
)
}