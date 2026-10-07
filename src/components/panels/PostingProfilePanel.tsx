/* ==========================================================================
   ORBIT · PostingProfilePanel (RWP-3)
   Cadência e mix de formatos (contagem direta dos posts) + referência de
   cadência do segmento (view v_benchmark_cadence_by_segment).

   Regras:
   - A referência é de PERÍODO FIXO (o da própria view), não o período
     selecionado. As datas aparecem escritas na tela.
   - Contas sem posts qualificáveis NÃO entram como zero; "n de N contas"
     aparece junto da média.
   - Cor = posição na faixa P25–P75 que a view entrega. Descritiva, nunca
     vermelha, nunca CTA, nunca promessa de efeito em conversão.
   - Sem amostra mínima ou sem cadência da conta: sem cor, só os números.
   ========================================================================== */

import type { CSSProperties } from 'react'
import { StatusPill } from '@/components/common/StatusPill'
import { formatCategoryLabel } from '@/lib/repositories/contentContractEngine'
import type { PostingCadence, FormatMix, BenchmarkCadence, GlowColor } from '@/types/orbit'
import styles from './PostingProfilePanel.module.css'

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reels',
  static_post: 'Estático',
  carousel: 'Carrossel',
  story: 'Stories',
  live: 'Live',
  igtv: 'IGTV',
  sem_formato: 'Sem formato',
}

const DAYS_PER_WEEK = 7

// Decisão de produto: abaixo disso a referência aparece sem cor.
const MIN_BENCHMARK_ACCOUNTS = 5

type CadencePosition = 'abaixo' | 'faixa' | 'acima'

const POSITION_UI: Record<CadencePosition, { text: string; color: GlowColor }> = {
  abaixo: { text: 'Abaixo da faixa típica do segmento', color: 'gold' },
  faixa: { text: 'Na faixa típica do segmento', color: 'cyan' },
  acima: { text: 'Acima da faixa típica do segmento', color: 'gold' },
}

function ptBr(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace('.', ',')
}

// 'YYYY-MM-DD' (ou timestamp) -> 'DD/MM/YYYY' sem passar por Date,
// que deslocaria o dia por fuso horário.
function fmtIsoDate(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/')
}

function cadenceHeadline(c: PostingCadence): string {
  if (c.reason !== 'ok' || c.postsPerWeek === null) return 'Poucos posts para calcular'
  // abaixo de 1/semana, "1 post a cada N semanas" é mais legível que "0,4 por semana"
  if (c.postsPerWeek < 1 && c.weeksPerPost !== null) {
    return `1 post a cada ${ptBr(c.weeksPerPost)} semanas`
  }
  return `${ptBr(c.postsPerWeek)} posts por semana`
}

function cadenceDetail(c: PostingCadence): string {
  const dias = Math.round(c.windowDays)
  if (c.reason !== 'ok') {
    return `${c.nPosts} ${c.nPosts === 1 ? 'post' : 'posts'} no período — mínimo de 3 para estimar o ritmo.`
  }
  return `${c.nPosts} posts em ${dias} dias (período selecionado).`
}

// Compara posts/semana da conta com a faixa P25–P75 (convertida de posts/dia).
// Os limites vêm da view; nada de limiar fixo aqui.
function classifyCadenceVsBenchmark(postsPerWeek: number, b: BenchmarkCadence): CadencePosition {
  const p25 = b.p25PostsPerDay * DAYS_PER_WEEK
  const p75 = b.p75PostsPerDay * DAYS_PER_WEEK
  if (postsPerWeek < p25) return 'abaixo'
  if (postsPerWeek > p75) return 'acima'
  return 'faixa'
}

export interface PostingProfilePanelProps {
  cadence: PostingCadence | null | undefined
  mix: FormatMix | null | undefined
  benchmark?: BenchmarkCadence | null | undefined
}

export function PostingProfilePanel({ cadence, mix, benchmark }: PostingProfilePanelProps) {
  const cadenceOk = !!cadence && cadence.reason === 'ok'

  const canColor =
    !!benchmark &&
    benchmark.accountsWithPosts >= MIN_BENCHMARK_ACCOUNTS &&
    cadenceOk &&
    cadence?.postsPerWeek != null

  const position =
    canColor && benchmark && cadence && cadence.postsPerWeek != null
      ? POSITION_UI[classifyCadenceVsBenchmark(cadence.postsPerWeek, benchmark)]
      : null

  return (
    <section className={styles.panel} aria-label="Ritmo e mix de publicação" data-testid="posting-profile">
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
          data-value={cadence?.postsPerWeek ?? ''}
          data-n={cadence?.nPosts ?? 0}
          data-benchmark-median={benchmark?.medianPostsPerDay ?? ''}
        >
          <span className={styles.label}>Cadência</span>
          {cadence ? (
            <>
              <strong className={cadenceOk ? styles.headline : styles.headlineMuted}>{cadenceHeadline(cadence)}</strong>
              <p className={styles.detail}>{cadenceDetail(cadence)}</p>
            </>
          ) : (
            <strong className={styles.headlineMuted}>Sem dados no período</strong>
          )}

          {benchmark ? (
            <div className={styles.reference} data-testid="posting-benchmark">
              {position && (
                <div className={styles.referenceHead}>
                  <StatusPill text={position.text} color={position.color} />
                </div>
              )}
              <p className={styles.referenceLine}>
                Referência — {formatCategoryLabel(benchmark.segmentCategory)}: média{' '}
                {ptBr(benchmark.meanPostsPerDay * DAYS_PER_WEEK, 2)} posts/semana · mediana{' '}
                {ptBr(benchmark.medianPostsPerDay * DAYS_PER_WEEK, 2)}
              </p>
              <p className={styles.referenceMeta}>
                Faixa típica (P25–P75): {ptBr(benchmark.p25PostsPerDay * DAYS_PER_WEEK, 2)} a{' '}
                {ptBr(benchmark.p75PostsPerDay * DAYS_PER_WEEK, 2)} posts/semana ·{' '}
                {benchmark.accountsWithPosts} de {benchmark.benchmarkAccountsTotal} contas com posts ·{' '}
                {fmtIsoDate(benchmark.periodStart)} a {fmtIsoDate(benchmark.periodEnd)}
              </p>
              {benchmark.accountsWithPosts < MIN_BENCHMARK_ACCOUNTS && (
                <p className={styles.referenceMeta}>
                  Poucas contas na referência — exibida sem comparação.
                </p>
              )}
            </div>
          ) : (
            <p className={styles.referenceMuted} data-testid="posting-benchmark-empty">
              Sem referência de segmento disponível para esta conta.
            </p>
          )}
        </div>

        <div className={styles.block} data-testid="posting-mix" data-total={mix?.total ?? 0}>
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
                    {item.count} {item.count === 1 ? 'post' : 'posts'} · {ptBr(item.pct)}%
                  </span>
                  <span className={styles.barTrack} role="presentation">
                    <span
                      className={styles.barFill}
                      style={{ '--pct': `${Math.max(2, Math.min(100, item.pct))}%` } as CSSProperties}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <strong className={styles.headlineMuted}>Sem posts no período</strong>
          )}
        </div>
      </div>

      <p className={styles.note}>
        {benchmark
          ? 'Cadência e mix são contagem dos posts coletados no período selecionado. A referência do segmento usa um período fixo, só com contas que publicaram, e descreve o ritmo observado — não indica efeito sobre resultado.'
          : 'Contagem dos posts coletados no período, sem comparação de mercado.'}
      </p>
    </section>
  )
}