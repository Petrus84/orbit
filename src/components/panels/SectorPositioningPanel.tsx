"use client";
import { GlassCard } from "@/components/common/GlassCard";
import styles from "./SectorPositioningPanel.module.css";
import type {
  SectorPositioning,
  ClassifiedMetric,
  CommentReferenceItem,
  MetricProvenance,
} from "@/types/orbit";
import { term, AUSENCIA } from "@/lib/ui-labels";
import { provenanceLine } from "@/lib/provenanceText";

export interface SectorPositioningPanelProps {
  positioning: SectorPositioning;
}

// Slug desconhecido nunca vai cru pra tela ("funil_basico" -> "Funil basico").
function humanizeSlug(slug: string): string {
  const t = slug.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const SETOR_LABEL: Record<string, string> = {
  saas_ferramenta: "Software ou ferramenta online",
  comercio_direto_ecommerce_social: "Comércio direto pelas redes sociais",
  comissionamento_afiliados: "Comissão por indicação (afiliados)",
  infoprodutor_educador_pago: "Cursos e conteúdo digital pago",
  servico_consultoria_profissional: "Serviços e consultoria",
  patrocinio_publicidade_marca: "Publis e parcerias com marcas",
  membership_assinatura_comunidade: "Assinatura e comunidade paga",
  monetizacao_nativa_plataforma: "Ganhos pela própria plataforma",
  autoridade_personal_branding_b2b: "Marca pessoal para vender a empresas",
  pre_monetizacao_a_validar: "Ainda sem receita, validando a ideia",
};

const FUNNEL_LABEL: Record<string, string> = {
  funil_basico: "Caminho de venda básico",
  nao_implementado: "Ainda não montado",
  implementado_fragmentado: "Montado, em partes soltas",
  implementado_unificado: "Montado e integrado",
};

const PROOF_LABEL: Record<string, string> = {
  clientes_ativos_gestao: "Clientes atendidos hoje",
  prova_social: "Prova social",
  autoridade: "Autoridade",
  escassez_urgencia: "Vagas limitadas e prazo curto",
  associacao_marca: "Associação de marca",
  resultado_documentado: "Resultado documentado",
  nenhum_observavel: "Nada que prove o resultado",
};

// RN-23: proveniência dos cards de Benchmarking (ER Real, VPS, Polêmica).
const BENCH_PROVENANCE: Record<"er" | "vps" | "pol", MetricProvenance> = {
  er: {
    source:
      "ig_account_snapshots (snapshot mais recente do período) · classificação fn_classify_metric",
    period: "snapshot",
    method:
      "(salvamentos + compartilhamentos + comentários) ÷ alcance × 100; sem referência de mercado medida, só meta de gestão (hipótese)",
  },
  vps: {
    source:
      "ig_account_snapshots (snapshot mais recente do período) · classificação fn_classify_metric",
    period: "snapshot",
    method:
      "(alcance × % do alcance em seguidores) ÷ seguidores × 100 (RN-20); sem referência de mercado medida, só meta de gestão (hipótese)",
  },
  pol: {
    source: "cálculo por post (ig_posts) · classificação fn_classify_metric",
    period: "header_window",
    method:
      "mediana por post de comentários ÷ curtidas × 100 (curtidas > 0); régua do setor em validação",
  },
};

const fmtValue = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function metricCard(
  label: string,
  value: number | null,
  metric: ClassifiedMetric | null,
  provenance?: MetricProvenance,
) {
  const isAmar = metric?.semaphore === "ambar";
  const isVerm = metric?.semaphore === "vermelho";
  const badgeCls = isVerm
    ? styles.badgeDanger
    : isAmar
      ? styles.badgeWarning
      : styles.badgeNeutral;
  // Sem régua de mercado (thresholdSource null): sem badge no card — o bloco
  // diz isso UMA vez, em vez de repetir a mesma frase em cada card.
  const hasVerdict = metric != null && metric.thresholdSource !== null;

  return (
    <div className={styles.metricCard} key={label}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>
        {value != null ? fmtValue(value) : "—"}
      </p>
      {hasVerdict && <span className={badgeCls}>{metric.statusText}</span>}
      {provenance && (
        <p className={styles.refNote} title={provenance.method}>
          {provenanceLine(provenance)}
        </p>
      )}
    </div>
  );
}

// ✅ NOVO (18/09/2026) — algo_risk_score, família Ln. Card separado de
// metricCard() de propósito: nunca tem semaphore verde/ambar/vermelho de
// mercado (não é ClassifiedMetric), só um badge neutro — o valor é sempre
// "vs. você mesmo", nunca "vs. setor".
function algoRiskCard(algoRisk: SectorPositioning["algoRisk"]) {
  const value = algoRisk?.value ?? null;
  return (
    <div className={styles.metricCard} key="algo-risk">
      <p className={styles.metricLabel}>Risco algorítmico (série própria)</p>
      <p className={styles.metricValue}>
        {value != null ? value.toFixed(2).replace(".", ",") : "—"}
      </p>
      {algoRisk?.statusText && (
        <span className={styles.badgeNeutral}>{algoRisk.statusText}</span>
      )}
    </div>
  );
}

const fmtRef = (v: number, unit: "%" | "pts") =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit === "%" ? "%" : ""}`;

// Referência em validação: sem semáforo, sem Ação. Número do cliente só quando
// existe cálculo; senão o card diz que ainda não foi calculado.
function commentReferenceCard(item: CommentReferenceItem) {
  const hasRange = item.p25 != null && item.p50 != null && item.p75 != null;
  return (
    <div className={styles.metricCard} key={item.metric}>
      <p className={styles.metricLabel}>{item.label}</p>
      <p className={styles.metricValue}>
        {item.valueText ??
          (item.clientValue != null
            ? fmtRef(item.clientValue, item.unit)
            : "—")}
      </p>
      {item.positionText && (
        <span className={styles.badgeNeutral}>{item.positionText}</span>
      )}
      {hasRange && (
        <p className={styles.refRange}>
          Referência global: P25 {fmtRef(item.p25 as number, item.unit)} ·
          mediana {fmtRef(item.p50 as number, item.unit)} · P75{" "}
          {fmtRef(item.p75 as number, item.unit)}
          {item.sampleCount != null
            ? ` · ${item.sampleCount.toLocaleString("pt-BR")} posts`
            : ""}
        </p>
      )}
      <p className={styles.refNote}>{item.note}</p>
      {item.provenance && (
        <p className={styles.refNote} title={item.provenance.method}>
          Fonte: {item.provenance.source} · Período:{" "}
          {item.provenance.period === "snapshot"
            ? "snapshot (não segue o cabeçalho)"
            : "janela do cabeçalho"}{" "}
          · Método: {item.provenance.method}
        </p>
      )}
    </div>
  );
}

export function SectorPositioningPanel({
  positioning,
}: SectorPositioningPanelProps) {
  const setorLabel = positioning.setorBenchmark
    ? (SETOR_LABEL[positioning.setorBenchmark] ??
      humanizeSlug(positioning.setorBenchmark))
    : "Não classificado";

  const funnelLabel = positioning.funnelMaturity
    ? (FUNNEL_LABEL[positioning.funnelMaturity] ??
      humanizeSlug(positioning.funnelMaturity))
    : "—";

  const proofLabel = positioning.proofMechanism
    ? (PROOF_LABEL[positioning.proofMechanism] ??
      humanizeSlug(positioning.proofMechanism))
    : "—";

  const withRule = [
    positioning.polemicScore,
    positioning.erReal,
    positioning.vps,
  ].filter(
    (m): m is ClassifiedMetric => m != null && m.thresholdSource !== null,
  );
  const ruleDeclaration = withRule[0]?.ruleDeclaration ?? null;

  const noMarket: string[] = [];
  if (positioning.erReal && positioning.erReal.thresholdSource === null)
    noMarket.push(term("er_real"));
  if (positioning.vps && positioning.vps.thresholdSource === null)
    noMarket.push(term("vps"));
  const noMarketNote = noMarket.length
    ? `${noMarket.join(" e ")}. ${AUSENCIA.regua_metrica} Acompanhe a evolução da própria conta.`
    : null;

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
          <p className={styles.infoLabel}>Caminho de venda e prova</p>
          <p className={styles.infoValue}>{funnelLabel}</p>
          <p className={styles.infoSub}>
            Como prova que funciona: {proofLabel.toLowerCase()}
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
          "ER real",
          positioning.erReal?.value ?? null,
          positioning.erReal ?? null,
          BENCH_PROVENANCE.er,
        )}
        {metricCard(
          "VPS",
          positioning.vps?.value ?? null,
          positioning.vps ?? null,
          BENCH_PROVENANCE.vps,
        )}
        {metricCard(
          "Score polêmica",
          positioning.polemicScore?.value ?? null,
          positioning.polemicScore ?? null,
          BENCH_PROVENANCE.pol,
        )}
      </div>

      {ruleDeclaration && <p className={styles.ruleText}>{ruleDeclaration}</p>}
      {noMarketNote && <p className={styles.ruleText}>{noMarketNote}</p>}

      {positioning.commentReference &&
        positioning.commentReference.length > 0 && (
          <>
            <p className={styles.blockLabel}>
              REFERÊNCIA — COMENTÁRIOS E ALCANCE
            </p>
            <div className={styles.metricsRow}>
              {positioning.commentReference.map(commentReferenceCard)}
            </div>
            <p className={styles.ruleText}>
              Percentis globais de um levantamento próprio, ainda em validação.
              Seguidores atuais, não os da data do post. Mostra onde a conta
              está, sem nota de bom ou ruim.
            </p>
          </>
        )}

      {/* ✅ NOVO (18/09/2026): seção separada, rótulo distinto de
        "BENCHMARKING" de propósito — algo_risk_score é família Ln
        (self-reference), nunca compara com mercado/setor. */}
      <p className={styles.blockLabel}>SÉRIE PRÓPRIA</p>
      <div className={styles.metricsRow}>
        {algoRiskCard(positioning.algoRisk)}
      </div>
    </GlassCard>
  );
}
