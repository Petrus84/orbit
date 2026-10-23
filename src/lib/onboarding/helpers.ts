// src/lib/onboarding/helpers.ts
import type { ClientOnboarding } from "@/types/orbit";
import { validateAudienceSum as validateAudienceSumForRow } from "./enums";

export const FIELD_ORDER: (keyof ClientOnboarding)[] = [
  "total_followers",
  "total_followers_source",
  "bio_links",
  "cta_type",
  "funnel_maturity",
  "q1_engagement_period_notes",
  "q2_content_proxy_notes",
  "q3_misalignment_notes",
  "audience_nucleo_fiel_pct",
  "audience_consumo_passivo_pct",
  "audience_curiosidade_externa_pct",
  "audience_alta_rotatividade_pct",
  "observed_content_clusters",
  "setor_benchmark",
  "nicho",
  "proof_mechanism",
  "values_affect_source",
  "values_affect_confidence",
  "confidence_diagnostico",
  "avatar_expected_age_min",
  "avatar_expected_age_max",
  "avatar_expected_gender",
];

export const HELP: Record<string, string> = {
  funnel_maturity:
    "Só marque como montado se existir pelo menos 1 link ativo na bio e algum convite claro para agir.",
  q1_engagement_period_notes:
    "Cadência de publicação na janela analisada: quantas publicações por formato.",
  q2_content_proxy_notes:
    "Qual formato (reels, posts ou stories) funciona como sinal de alcance ou de venda.",
  q3_misalignment_notes:
    "Hipótese central de por que a conta não performa como o cliente espera.",
  audience:
    "· Clientes fiéis = engajam de verdade e voltam sempre\n· Pessoas que só veem = curtem, mas não salvam\n· Pessoas novas = alcançadas, mas ainda não seguem\n· Pessoas que somem = entram uma vez e saem",
};

export function isFilled(
  id: keyof ClientOnboarding,
  record: Partial<ClientOnboarding>,
): boolean {
  const v = record[id];
  if (id === "bio_links") return Array.isArray(v) && v.length > 0;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return true;
}

export function completeness(record: Partial<ClientOnboarding> | null): number {
  if (!record) return 0;
  const filled = FIELD_ORDER.filter((id) => isFilled(id, record)).length;
  return Math.round((filled / FIELD_ORDER.length) * 100);
}

export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso.replace(" ", "T"));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function validateAudienceSum(record: Partial<ClientOnboarding>): {
  ok: boolean;
  sum: number;
} {
  return validateAudienceSumForRow(record);
}

export function summarizeChanges(
  before: Partial<ClientOnboarding> | null,
  after: Partial<ClientOnboarding>,
): string[] {
  const labels: Record<string, string> = {
    total_followers: "seguidores",
    total_followers_source: "fonte de seguidores",
    bio_links: "links da bio",
    cta_type: "convite para agir",
    funnel_maturity: "caminho de venda",
    q1_engagement_period_notes: "Q1",
    q2_content_proxy_notes: "Q2",
    q3_misalignment_notes: "Q3",
    audience_nucleo_fiel_pct: "clientes fiéis",
    audience_consumo_passivo_pct: "pessoas que só veem",
    audience_curiosidade_externa_pct: "pessoas novas",
    audience_alta_rotatividade_pct: "pessoas que somem",
    observed_content_clusters: "clusters de conteúdo",
    setor_benchmark: "ramo",
    nicho: "nicho",
    proof_mechanism: "como prova que funciona",
    values_affect_source: "origem dos dados de confiança",
    values_affect_confidence: "confiança dos dados de valores",
    confidence_diagnostico: "confiança do diagnóstico",
    avatar_expected_age_min: "idade mínima esperada",
    avatar_expected_age_max: "idade máxima esperada",
    avatar_expected_gender: "gênero predominante esperado",
  };
  const changed: string[] = [];
  Object.keys(labels).forEach((id) => {
    const b = JSON.stringify((before || {})[id as keyof ClientOnboarding]);
    const a = JSON.stringify((after || {})[id as keyof ClientOnboarding]);
    if (b !== a) changed.push(labels[id] as string);
  });
  return changed;
}
