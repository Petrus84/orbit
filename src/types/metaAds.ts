// ============================================================================
// src/types/metaAds.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
//
// Antes deste arquivo declarava MetaAdsKPI e CampaignRow localmente,
// mas orbit.ts já consolidou cópias idênticas desses dois tipos
// (ver Seção 8 de orbit.ts, "Consolidado de metaAds.ts"). Manter as duas
// declarações vivas era a duplicação que causava desalinhamento silencioso
// se alguém editasse só um dos dois lados. Agora há uma única fonte.
//
// Manutenção: adicione tipos novos em orbit.ts e re-exporte aqui.
// ============================================================================

export type {
  CampaignObjective,
  CampaignStatus,
  MetaAdsKPI,
  CampaignRow,
} from '@/types/orbit'