// ============================================================================
// src/types/instagram.ts
// RE-EXPORT BARREL — não declare nada aqui.
// Fonte canônica única: src/types/orbit.ts
//
// Por que este arquivo existe (e não foi deletado):
//   70 arquivos importam de '@/types/instagram'. Converter para re-export
//   elimina 9 FATALs de compilação sem tocar em nenhum importador.
//
// Manutenção: se precisar adicionar um tipo novo, adicione em orbit.ts
//             e re-exporte aqui. Nunca declare inline neste arquivo.
// ============================================================================

export type {
  // Primitivos de design system
  FetchStatus,
  SemaphoreColor,
  GlowColor,
  TrendColor,
  StatusVariant,
  DeltaDirection,

  // Estado assíncrono
  AsyncState,

  // Entidades de UI — Instagram
  DashboardHeaderMeta,
  KPICardData,
  QualityScoreItem,
  FormatPerformanceRow,
  InsightData,
  CriticalAlertData,

  // Aggregate root da tela de overview
  // Nota: IGOverviewData usa campo 'meta' (não 'header') — ver patch B abaixo
  IGOverviewData,
} from './orbit'