// ============================================================================
// src/types/avatar.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
//
// ⚠️ BREAKING CHANGE (PATCH C-3):
//   A versão antiga deste arquivo tinha:
//     export interface AlignmentBar { ...; status: AlignmentStatus }
//   A versão canônica em orbit.ts tem:
//     export interface AlignmentBar { ...; color: AlignmentColor }
//   ('green' | 'amber' | 'red', para bater com var(--green/amber/red) no HTML SSOT)
//   Se algum componente ainda lê `bar.status`, ajuste para `bar.color`
//   antes de trocar este arquivo em produção. Busque por ".status" em
//   qualquer lugar que itere sobre AlignmentBar[].
//
// AvatarProfile e AlignmentBar também estavam duplicados aqui e em
// orbit.ts (2 das 5 duplicações do mapeamento) — agora só existem em orbit.ts.
//
// Manutenção: adicione tipos novos em orbit.ts e re-exporte aqui.
// ============================================================================

export type {
  AlignmentStatus,
  AlignmentColor,
  FetchStatus,
  AsyncState,
  AvatarProfile,
  AvatarAlignment,
  AlignmentBar,
  AvatarRecommendation,
} from './orbit'

// ALIGNMENT_THRESHOLDS, ALIGNMENT_STATUS_LABEL e ALIGNMENT_STATUS_COLOR são
// consts (valor em runtime), não tipos — precisam de re-export sem `type`,
// ao contrário de tudo acima.
export { ALIGNMENT_THRESHOLDS, ALIGNMENT_STATUS_LABEL, ALIGNMENT_STATUS_COLOR } from './orbit'