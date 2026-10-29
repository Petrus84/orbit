// dataStatusCopy.ts
// ============================================================================
// "Por que esta tela está vazia ou incompleta?" — cada frase nasce de um fato
// medido no banco (contagens, datas, snapshot), nunca de suposição. Puro e
// determinístico: recebe fatos, devolve avisos. Cada fato aparece uma vez.
// ============================================================================

export interface ClientDataFacts {
  postsTotal: number;
  postsFirst: string | null; // ISO do post mais antigo
  postsLast: string | null; // ISO do post mais recente
  postsInPeriod: number; // posts dentro do período selecionado
  postsEstimated: number; // posts com is_estimated = true
  postsL2Excluded: number; // posts L2 excluídos dos indicadores do período
  snapshotCount: number; // linhas em ig_account_snapshots
  latestSnapshotReach: number | null;
  latestSnapshotImpressions: number | null;
}

export interface DataStatusNotice {
  id: string;
  text: string;
}

const fmtInt = (n: number): string => n.toLocaleString("pt-BR");
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export function buildDataStatusNotices(f: ClientDataFacts): DataStatusNotice[] {
  if (f.postsTotal === 0 && f.snapshotCount === 0) {
    return [
      {
        id: "sem_dados",
        text: "Este cliente ainda não tem posts nem dados da conta importados.",
      },
    ];
  }

  const notices: DataStatusNotice[] = [];

  if (
    f.postsTotal > 0 &&
    f.postsInPeriod === 0 &&
    f.postsFirst &&
    f.postsLast
  ) {
    notices.push({
      id: "periodo_sem_posts",
      text: `Nenhum post no período selecionado. Este cliente tem ${fmtInt(f.postsTotal)} posts, de ${fmtDate(f.postsFirst)} a ${fmtDate(f.postsLast)}: ajuste o período para vê-los.`,
    });
  }

  if (f.snapshotCount === 0) {
    notices.push({
      id: "sem_snapshot",
      text: "Os dados da conta ainda não foram importados: seguidores, alcance e notas dependem deles.",
    });
  } else if (f.latestSnapshotReach === 0) {
    const impr =
      f.latestSnapshotImpressions && f.latestSnapshotImpressions > 0
        ? ` (e ${fmtInt(f.latestSnapshotImpressions)} impressões)`
        : "";
    notices.push({
      id: "snapshot_sem_alcance",
      text: `A coleta mais recente veio com alcance 0${impr}: o alcance dos últimos 90 dias e as notas ficam indisponíveis. É falta do dado no arquivo exportado, não queda de audiência.`,
    });
  }

  if (f.postsEstimated > 0) {
    notices.push({
      id: "alcance_estimado",
      text: `${fmtInt(f.postsEstimated)} de ${fmtInt(f.postsTotal)} posts têm alcance estimado (não veio no arquivo exportado): o engajamento por post é aproximado.`,
    });
  }

  if (f.postsL2Excluded > 0) {
    const verb = f.postsL2Excluded === 1 ? "foi excluído" : "foram excluídos";
    const post = f.postsL2Excluded === 1 ? "post" : "posts";
    notices.push({
      id: "posts_l2_excluidos",
      text: `${fmtInt(f.postsL2Excluded)} ${post} com confiança L2 ${verb} dos indicadores por post no período selecionado.`,
    });
  }

  return notices;
}
