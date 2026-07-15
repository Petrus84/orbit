// ============================================================================
// src/types/funnel.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
//
// Antes deste arquivo declarava FetchStatus e AsyncState<T> localmente
// (1 das 5 duplicações identificadas no mapeamento). Agora vêm de orbit.ts.
//
// Nota: FunnelStep e FunnelData (usados no funil visual) só existiam em
// orbit.ts, não aqui — se algum componente precisar deles importando de
// '@/types/funnel', adicione-os à lista abaixo.
//
// Manutenção: adicione tipos novos em orbit.ts e re-exporte aqui.
// ============================================================================

export type {
  FetchStatus,
  AsyncState,
  FunnelMetrics,
  FunnelStep,
  FunnelData,
  SliderConfig,
  SimulatedFunnelResult,
  FunnelScreenData,
  UseFunnelResult,  // ✅ NOVO: Agora re-exporta
  FunnelMetricsRow,
  FunnelSimulatorParams,
  FunnelSimulationResult,
} from './orbit'