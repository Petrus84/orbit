// ============================================================================
// src/types/alert.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
// ============================================================================

// ✅ Todos os 6 nomes abaixo foram conferidos: existem em orbit.ts hoje.
// AlertType foi ADICIONADO à lista (a versão original não trazia) porque
// AlertCard.tsx e AlertIcon.tsx precisam dele — sem isso, os dois teriam
// que importar direto de './orbit', quebrando a regra "barrel único" que
// este arquivo declara no comentário acima.
export type {
  AlertSeverity,
  AlertType,
  FetchStatus,
  AsyncState,
  AlertAction,
  Alert,
} from './orbit'