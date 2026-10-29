/* ==========================================================================
   ORBIT · lib/kpiDisplay.ts
   Rótulo + proveniência (RN-23) dos KPIs do Overview, e as regras de
   "dado ausente" dos cards. Módulo PURO (sem supabase): o repositório importa
   daqui, os testes importam daqui.

   Os KPIs declaram de onde vem o número e como ele foi calculado.

   Regra de voz: cada frase nasce de um fato do banco; nada de promessa.
   ========================================================================== */

import type { MetricProvenance } from "@/types/orbit";

export interface KpiDisplay {
  label: string;
  provenance: MetricProvenance;
}

const COLETA = "última coleta de dados da conta (arquivo exportado)";

/** "2026-07-08" -> "08/07/2026"; qualquer outra coisa -> null (sem inventar data). */
function brDate(iso: string | null | undefined): string | null {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : null;
}

/** `| undefined` explícito: o projeto usa exactOptionalPropertyTypes e as linhas do zod trazem undefined. */
export interface KpiPeriod {
  start?: string | null | undefined;
  end?: string | null | undefined;
}

function snapshotPeriodLabel(period?: KpiPeriod): string | undefined {
  const a = brDate(period?.start);
  const b = brDate(period?.end);
  return a && b ? `${a} a ${b}` : undefined;
}

export function kpiDisplayFor(
  key: string,
  period?: KpiPeriod,
): KpiDisplay | null {
  switch (key) {
    case "saldo-90-dias":
      // Texto herdado do repositório, sem alteração (conferido no banco em 21/10/2026).
      return {
        label: "SALDO DE SEGUIDORES (ENTRE MEDIÇÕES)",
        provenance: {
          source: "histórico de seguidores da conta",
          period: "snapshot",
          method:
            "Última medição de seguidores menos a mais antiga nos 90 dias anteriores a ela (histórico de seguidores); pode cobrir bem menos que 90 dias e não segue o intervalo do cabeçalho.",
        },
      };

    case "seguidores-totais":
      return {
        label: "SEGUIDORES TOTAIS",
        provenance: {
          source: "histórico de seguidores da conta",
          period: "snapshot",
          method:
            "Última medição de seguidores informada para a conta; não muda com o período escolhido.",
        },
      };

    case "alcance-90d": {
      const periodLabel = snapshotPeriodLabel(period);
      return {
        label: "ALCANCE 90D",
        provenance: {
          source: COLETA,
          period: "snapshot",
          ...(periodLabel ? { periodLabel } : {}),
          method:
            "Pessoas únicas alcançadas pela conta na janela do arquivo exportado (cerca de 90 dias). É o total da conta informado pela coleta, não a soma dos posts nem dos stories.",
        },
      };
    }

    case "cliques-no-link": {
      const periodLabel = snapshotPeriodLabel(period);
      return {
        label: "CLIQUES NO LINK",
        provenance: {
          source: COLETA,
          period: "snapshot",
          ...(periodLabel ? { periodLabel } : {}),
          method: "Toques no link do perfil na janela do arquivo exportado.",
        },
      };
    }

    case "impressions-account": {
      const periodLabel = snapshotPeriodLabel(period);
      return {
        label: "IMPRESSÕES DA CONTA",
        provenance: {
          source: "resumo da conta do Instagram",
          period: "snapshot",
          ...(periodLabel ? { periodLabel } : {}),
          method:
            "Total de impressões informado no snapshot mais recente com esse dado; snapshots não são somados.",
        },
      };
    }

    case "impressions-posts":
      return {
        label: "IMPRESSÕES DOS POSTS",
        provenance: {
          source: "posts orgânicos do Instagram",
          period: "header_window",
          method:
            "Soma das impressões preenchidas dos posts publicados no período escolhido; posts sem impressões ficam fora.",
        },
      };

    default:
      return null;
  }
}

/**
 * O card mostra "—" (nunca "0") quando o banco não trouxe o número.
 * - nulo / não finito: ausente, em qualquer KPI (null nunca vira zero — RN-22d);
 * - alcance-90d igual a 0: ausente. Mesma regra do aviso `snapshot_sem_alcance`
 *   (dataStatusCopy.ts): alcance 0 numa conta com posts é falta do dado no arquivo
 *   exportado, não queda de audiência. Cliques e saldo 0 são valores reais.
 */
export function isKpiValueMissing(key: string, raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === "") return true;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return true;
  return key === "alcance-90d" && n === 0;
}

/**
 * Há comparação com o período anterior para exibir?
 * - sem valor, ou delta nulo: não (SSOT v1.5, Seção 9: "sem comparação", nunca 0,0%);
 * - saldo igual a 0 com delta 0: não — variação percentual sobre base zero é 0÷0,
 *   não prova que nada mudou (a.c_enxovais: 2 medições de 1.804, saldo 0).
 */
export function kpiHasComparison(
  key: string,
  value: number,
  rawDelta: unknown,
  valueMissing: boolean,
): boolean {
  if (valueMissing) return false;
  if (rawDelta === null || rawDelta === undefined) return false;
  if (key === "saldo-90-dias" && value === 0 && Number(rawDelta) === 0) {
    return false;
  }
  return true;
}
