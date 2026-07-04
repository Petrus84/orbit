// ============================================================================
// src/types/alert.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
//
// Antes deste arquivo declarava FetchStatus e AsyncState<T> localmente
// (1 das 5 duplicações identificadas no mapeamento). Agora ambos vêm
// de orbit.ts, então só existe uma definição no projeto inteiro.
//
// Manutenção: se precisar adicionar um tipo novo de alerta, adicione em
//             orbit.ts e re-exporte aqui. Nunca declare inline neste arquivo.
// ============================================================================

export type {
  AlertSeverity,
  FetchStatus,
  AsyncState,
  AlertAction,
  Alert,
} from './orbit'