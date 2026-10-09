/* ==========================================================================
   ORBIT · PostingProfilePanel (RWP-3)
   Cadência e mix de formatos (contagem direta dos posts) + referência de
   cadência do segmento (view v_benchmark_cadence_by_segment).

   Regras:
   - Conta e referência usam a MESMA régua: posts por semana entre o primeiro e
     o último post (span ativo), só com base mínima (>= 5 posts e >= 28 dias).
     Nunca comparar taxa por período selecionado com taxa por span ativo.
   - A referência é de PERÍODO FIXO (o da própria view), não o período
     selecionado. As datas aparecem escritas na tela.
   - Contas sem posts qualificáveis NÃO entram como zero; "n de N contas"
     (elegíveis) aparece junto da média, com o número de contas recentes.
   - Recência = dias entre o último post e a DATA DA COLETA da conta, nunca até
     hoje: o dado só fala até a coleta. Exibida separada da cadência.
   - Cor = posição na faixa P25–P75 que a view entrega. Descritiva, nunca
     vermelha, nunca CTA, nunca promessa de efeito em conversão.
   - Sem amostra mínima ou sem cadência de span ativo da conta: sem cor, só
     os números.
   ========================================================================== */

import type { CSSProperties } from "react";
import { StatusPill } from "@/components/common/StatusPill";
import { formatCategoryLabel } from "@/lib/repositories/contentContractEngine";
import type {
  PostingCadence,
  FormatMix,
  BenchmarkCadence,
  GlowColor,
} from "@/types/orbit";
import styles from "./PostingProfilePanel.module.css";

const FORMAT_LABEL: Record<string, string> = {
  reel: "Reels",
  static_post: "Estático",
  carousel: "Carrossel",
  story: "Stories",
  live: "Live",
  igtv: "IGTV",
  sem_formato: "Sem formato",
};

// Decisão de produto: abaixo disso a referência aparece sem cor.
// Conta contas ELEGÍVEIS (>= 5 posts e >= 28 dias de span), não contas observadas.
const MIN_BENCHMARK_ACCOUNTS = 5;

type CadencePosition = "abaixo" | "faixa" | "acima";

const POSITION_UI: Record<CadencePosition, { text: string; color: GlowColor }> =
  {
    abaixo: { text: "Abaixo da faixa típica do segmento", color: "gold" },
    faixa: { text: "Na faixa típica do segmento", color: "cyan" },
    acima: { text: "Acima da faixa típica do segmento", color: "gold" },
  };

function ptBr(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace(".", ",");
}

// 'YYYY-MM-DD' (ou timestamp) -> 'DD/MM/YYYY' sem passar por Date,
// que deslocaria o dia por fuso horário.
function fmtIsoDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

// Taxa que o painel exibe e compara: span ativo, quando a conta tem base mínima.
function activeRate(c: PostingCadence | null | undefined): number | null {
  return c?.postsPerWeekActive ?? null;
}

function cadenceHeadline(c: PostingCadence): string {
  const active = activeRate(c);
  if (active !== null) {
    const weeksPerPost = c.weeksPerPostActive ?? null;
    // abaixo de 1/semana, "1 post a cada N semanas" é mais legível que "0,4 por semana"
    if (active < 1 && weeksPerPost !== null)
      return `1 post a cada ${ptBr(weeksPerPost)} semanas`;
    return `${ptBr(active)} posts por semana`;
  }
  if (c.reason !== "ok" || c.postsPerWeek === null)
    return "Poucos posts para calcular";
  // Sem base mínima de span: mostra a taxa do período selecionado, sem comparação.
  if (c.postsPerWeek < 1 && c.weeksPerPost !== null) {
    return `1 post a cada ${ptBr(c.weeksPerPost)} semanas`;
  }
  return `${ptBr(c.postsPerWeek)} posts por semana`;
}

function cadenceDetail(c: PostingCadence): string {
  if (activeRate(c) !== null && c.activeSpanDays != null) {
    return `${c.nPosts} ${plural(c.nPosts, "post", "posts")} em ${c.activeSpanDays} dias, do primeiro ao último post do período selecionado.`;
  }
  const dias = Math.round(c.windowDays);
  if (c.reason !== "ok") {
    return `${c.nPosts} ${plural(c.nPosts, "post", "posts")} no período — mínimo de 3 para estimar o ritmo.`;
  }
  return `${c.nPosts} posts em ${dias} dias (período selecionado) — sem base mínima de 5 posts em 28 dias para comparar com o segmento.`;
}

// Recência separada da cadência: "com que ritmo postou quando postava" (acima)
// vs "há quanto tempo parou" (aqui), medida até a coleta, não até hoje.
function recencyLine(c: PostingCadence): string | null {
  if (
    c.lastPostOn == null ||
    c.collectedOn == null ||
    c.daysLastPostToCollection == null
  )
    return null;
  const d = c.daysLastPostToCollection;
  return `Último post em ${fmtIsoDate(c.lastPostOn)} — ${d} ${plural(d, "dia", "dias")} antes da coleta (${fmtIsoDate(c.collectedOn)}).`;
}

// Compara posts/semana (span ativo) da conta com a faixa P25–P75 da view.
// Os limites vêm da view; nada de limiar fixo aqui.
function classifyCadenceVsBenchmark(
  postsPerWeek: number,
  b: BenchmarkCadence,
): CadencePosition {
  if (postsPerWeek < b.p25PostsPerWeek) return "abaixo";
  if (postsPerWeek > b.p75PostsPerWeek) return "acima";
  return "faixa";
}

export interface PostingProfilePanelProps {
  cadence: PostingCadence | null | undefined;
  mix: FormatMix | null | undefined;
  benchmark?: BenchmarkCadence | null | undefined;
}

export function PostingProfilePanel({
  cadence,
  mix,
  benchmark,
}: PostingProfilePanelProps) {
  const accountRate = activeRate(cadence);

  const canColor =
    !!benchmark &&
    benchmark.eligibleAccounts >= MIN_BENCHMARK_ACCOUNTS &&
    accountRate !== null;

  const position =
    canColor && benchmark && accountRate !== null
      ? POSITION_UI[classifyCadenceVsBenchmark(accountRate, benchmark)]
      : null;

  const cadenceOk = !!cadence && cadence.reason === "ok";
  const recency = cadence ? recencyLine(cadence) : null;

  return (
    <section
      className={styles.panel}
      aria-label="Ritmo e mix de publicação"
      data-testid="posting-profile"
    >
      <div className={styles.titleRow}>
        <h3 className={styles.title}>Ritmo e mix de publicação</h3>
        <span
          className={styles.levelBadge}
          data-testid="posting-level"
          title="Derivado por contagem dos posts coletados — não é medição direta da plataforma"
        >
          L1
        </span>
      </div>

      <div className={styles.blocks}>
        <div
          className={styles.block}
          data-testid="posting-cadence"
          data-value={cadence?.postsPerWeek ?? ""}
          data-value-active={accountRate ?? ""}
          data-n={cadence?.nPosts ?? 0}
          data-benchmark-median={benchmark?.medianPostsPerDay ?? ""}
          data-benchmark-median-week={benchmark?.medianPostsPerWeek ?? ""}
        >
          <span className={styles.label}>Cadência</span>
          {cadence ? (
            <>
              <strong
                className={cadenceOk ? styles.headline : styles.headlineMuted}
              >
                {cadenceHeadline(cadence)}
              </strong>
              <p className={styles.detail}>{cadenceDetail(cadence)}</p>
              {recency && (
                <p className={styles.detail} data-testid="posting-recency">
                  {recency}
                </p>
              )}
            </>
          ) : (
            <strong className={styles.headlineMuted}>
              Sem dados no período
            </strong>
          )}

          {benchmark ? (
            <div className={styles.reference} data-testid="posting-benchmark">
              {position && (
                <div className={styles.referenceHead}>
                  <StatusPill text={position.text} color={position.color} />
                </div>
              )}
              <p className={styles.referenceLine}>
                Referência — {formatCategoryLabel(benchmark.segmentCategory)}:
                média {ptBr(benchmark.meanPostsPerWeek, 2)} posts/semana ·
                mediana {ptBr(benchmark.medianPostsPerWeek, 2)}
              </p>
              <p className={styles.referenceMeta}>
                Faixa típica (P25–P75): {ptBr(benchmark.p25PostsPerWeek, 2)} a{" "}
                {ptBr(benchmark.p75PostsPerWeek, 2)} posts/semana ·{" "}
                {benchmark.eligibleAccounts} de{" "}
                {benchmark.benchmarkAccountsTotal} contas elegíveis ·{" "}
                {fmtIsoDate(benchmark.periodStart)} a{" "}
                {fmtIsoDate(benchmark.periodEnd)}
              </p>
              <p
                className={styles.referenceMeta}
                data-testid="posting-benchmark-recency"
              >
                {benchmark.recentAccounts} de {benchmark.eligibleAccounts} com
                último post até {benchmark.recencyThresholdDays} dias antes da
                coleta
                {benchmark.medianDaysLastPostToCollection !== null
                  ? ` · mediana de ${Math.round(benchmark.medianDaysLastPostToCollection)} dias`
                  : ""}
              </p>
              {benchmark.eligibleAccounts < MIN_BENCHMARK_ACCOUNTS && (
                <p className={styles.referenceMeta}>
                  Poucas contas na referência — exibida sem comparação.
                </p>
              )}
              {accountRate === null &&
                benchmark.eligibleAccounts >= MIN_BENCHMARK_ACCOUNTS && (
                  <p className={styles.referenceMeta}>
                    Conta sem base mínima (5 posts em 28 dias) — referência
                    exibida sem comparação.
                  </p>
                )}
            </div>
          ) : (
            <p
              className={styles.referenceMuted}
              data-testid="posting-benchmark-empty"
            >
              Sem referência de segmento disponível para esta conta.
            </p>
          )}
        </div>

        <div
          className={styles.block}
          data-testid="posting-mix"
          data-total={mix?.total ?? 0}
        >
          <span className={styles.label}>Mix de formatos</span>
          {mix && mix.items.length > 0 ? (
            <ul className={styles.mixList}>
              {mix.items.map((item) => (
                <li
                  key={item.format}
                  className={styles.mixRow}
                  data-format={item.format}
                  data-count={item.count}
                >
                  <span>{FORMAT_LABEL[item.format] ?? item.format}</span>
                  <span className={styles.mixCount}>
                    {item.count} {item.count === 1 ? "post" : "posts"} ·{" "}
                    {ptBr(item.pct)}%
                  </span>
                  <span className={styles.barTrack} role="presentation">
                    <span
                      className={styles.barFill}
                      style={
                        {
                          "--pct": `${Math.max(2, Math.min(100, item.pct))}%`,
                        } as CSSProperties
                      }
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <strong className={styles.headlineMuted}>
              Sem posts no período
            </strong>
          )}
        </div>
      </div>

      <p className={styles.note}>
        {benchmark
          ? "Conta e referência usam o mesmo cálculo: posts por semana entre o primeiro e o último post, só para contas com pelo menos 5 posts e 28 dias entre eles. A referência usa um período fixo e descreve o ritmo observado — não indica efeito sobre resultado. A recência é medida até a data da coleta, não até hoje."
          : "Contagem dos posts coletados no período, sem comparação de mercado."}
      </p>
    </section>
  );
}
