// dataStatusCopy.ts
// ============================================================================
// "Por que esta tela está vazia ou incompleta?" — cada frase nasce de um fato
// medido no banco (contagens, datas, snapshot), nunca de suposição. Puro e
// determinístico: recebe fatos, devolve avisos. Cada fato aparece uma vez.
// ============================================================================

export interface ClientDataFacts {
  postsTotal: number
  postsFirst: string | null        // ISO do post mais antigo
  postsLast: string | null         // ISO do post mais recente
  postsInPeriod: number            // posts dentro do período selecionado
  postsEstimated: number           // posts com is_estimated = true
  snapshotCount: number            // linhas em ig_account_snapshots
  latestSnapshotReach: number | null
  latestSnapshotImpressions: number | null
}

export interface DataStatusNotice {
  id: string
  text: string
}

const fmtInt = (n: number): string => n.toLocaleString('pt-BR')
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

export function buildDataStatusNotices(f: ClientDataFacts): DataStatusNotice[] {
  if (f.postsTotal === 0 && f.snapshotCount === 0) {
    return [{ id: 'sem_dados', text: 'Este cliente ainda não tem posts nem snapshot de conta importados.' }]
  }

  const notices: DataStatusNotice[] = []

  if (f.postsTotal > 0 && f.postsInPeriod === 0 && f.postsFirst && f.postsLast) {
    notices.push({
      id: 'periodo_sem_posts',
      text: `Nenhum post no período selecionado. Este cliente tem ${fmtInt(f.postsTotal)} posts, de ${fmtDate(f.postsFirst)} a ${fmtDate(f.postsLast)}: ajuste o período para vê-los.`,
    })
  }

  if (f.snapshotCount === 0) {
    notices.push({
      id: 'sem_snapshot',
      text: 'Sem snapshot de conta importado: seguidores, alcance e scores dependem dele.',
    })
  } else if ((f.latestSnapshotReach ?? 0) === 0) {
    const impr =
      f.latestSnapshotImpressions && f.latestSnapshotImpressions > 0
        ? ` (e ${fmtInt(f.latestSnapshotImpressions)} impressões)`
        : ''
    notices.push({
      id: 'snapshot_sem_alcance',
      text: `O snapshot mais recente traz alcance 0${impr}: Alcance 90d e scores ficam indisponíveis. É falta do dado no export, não queda de audiência.`,
    })
  }

  if (f.postsEstimated > 0) {
    notices.push({
      id: 'alcance_estimado',
      text: `${fmtInt(f.postsEstimated)} de ${fmtInt(f.postsTotal)} posts têm alcance estimado (não veio do export): o ER por post é aproximado.`,
    })
  }

  return notices
}
