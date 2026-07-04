// ============================================================================
// src/types/client.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
//
// Antes deste arquivo declarava FetchStatus e AsyncState<T> localmente
// (1 das 5 duplicações identificadas no mapeamento). Agora vêm de orbit.ts.
//
// Manutenção: adicione tipos novos em orbit.ts e re-exporte aqui.
// ============================================================================

export type {
  ClientStatus,
  FetchStatus,
  AsyncState,
  ClientMetrics,
  Client,
} from './orbit'