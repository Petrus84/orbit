/* ==========================================================================
   ORBIT · funnel/registry.ts
   Registry do funil por tipo (link | dm). Espelha orbit.funnel_stage_registry
   (migration 20261011120000_funnel_registry_ddl.sql) — se mudar um, mude o outro.

   Regra de origem (o que o Instagram enxerga e o que só chega por informe):
   - instagram_export: alcance, visitas, cliques no link. Medido pelo Instagram.
   - dm_scan: etapas de conversa no direct, classificadas por palavra-chave
     a partir do export de mensagens. É estimativa, não venda.
   - external_reported: a venda acontece fora do Instagram (site/página
     externa, WhatsApp, loja) e só entra quando alguém informa
     (funnel_data.vendas + vendas_updated_by). O sistema não a observa.

   Confiança segue a escala do app (ui-labels.CONFIANCA):
   L0 dado confirmado · L1 estimativa com base nos seus dados · L2 falta dado.
   ========================================================================== */

import type { FunnelKind, FunnelStageDef } from "@/types/orbit";

export const FUNNEL_STAGES: Record<FunnelKind, readonly FunnelStageDef[]> = {
  link: [
    {
      key: "alcance",
      order: 1,
      label: "Alcance",
      source: "instagram_export",
      confidence: "L0",
      parent: null,
    },
    {
      key: "visitas_perfil",
      order: 2,
      label: "Visitas ao perfil",
      source: "instagram_export",
      confidence: "L0",
      parent: "alcance",
    },
    {
      key: "cliques_link",
      order: 3,
      label: "Cliques no link da bio",
      source: "instagram_export",
      confidence: "L0",
      parent: "visitas_perfil",
    },
    {
      key: "vendas_externas",
      order: 4,
      label: "Vendas informadas",
      source: "external_reported",
      confidence: "L0",
      parent: "cliques_link",
    },
  ],
  dm: [
    {
      key: "alcance",
      order: 1,
      label: "Alcance",
      source: "instagram_export",
      confidence: "L0",
      parent: null,
    },
    {
      key: "visitas_perfil",
      order: 2,
      label: "Visitas ao perfil",
      source: "instagram_export",
      confidence: "L0",
      parent: "alcance",
    },
    {
      key: "conversas_comerciais",
      order: 3,
      label: "Conversas comerciais",
      source: "dm_scan",
      confidence: "L1",
      parent: "visitas_perfil",
    },
    {
      key: "pediu_preco",
      order: 4,
      label: "Pediram preço",
      source: "dm_scan",
      confidence: "L1",
      parent: "conversas_comerciais",
    },
    {
      key: "intencao_compra",
      order: 5,
      label: "Disseram que querem comprar",
      source: "dm_scan",
      confidence: "L1",
      parent: "pediu_preco",
    },
    {
      key: "fechamento_provavel",
      order: 6,
      label: "Fechamento provável",
      source: "dm_scan",
      confidence: "L1",
      parent: "intencao_compra",
    },
    {
      key: "venda_evidencia_forte",
      order: 7,
      label: "Venda com evidência forte",
      source: "dm_scan",
      confidence: "L1",
      parent: "fechamento_provavel",
    },
    {
      key: "venda_confirmada",
      order: 8,
      label: "Vendas informadas",
      source: "external_reported",
      confidence: "L0",
      parent: "conversas_comerciais",
    },
  ],
} as const;

/** Fallbacks do simulador de saturação. Sem fonte documentada: a UI os chama de "valor padrão". */
export const FUNNEL_FALLBACKS = {
  engajamentoPct: 1.5,
  alphaBase: 0.25,
  alphaMin: 0.1,
  saturationThreshold: 1.5,
} as const;
