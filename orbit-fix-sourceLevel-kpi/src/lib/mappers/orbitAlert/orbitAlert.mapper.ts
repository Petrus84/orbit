// orbitAlert.mapper.ts
// Reconciliação: orbit.alerts (tabela, DB) → Alert (Contract, orbit.ts)
//
// Gaps corrigidos aqui (Etapa 1, par 3 da Matriz de Drift):
//   • is_snoozed: ausente do OrbitAlertRow original — agora mapeado
//   • confidence_level: ausente do OrbitAlertRow original — agora mapeado
//   • natureza: ausente do OrbitAlertRow original — agora mapeado
//   • type guards originais validavam typeof string em vez de union literal
//     — resolvido via Zod no schema de entrada (orbitAlert.schema.ts)
//   • action_url com hosts placeholder (example.com/localhost) nunca vira
//     botão clicável — guard sanitizeActionUrl() aplicado aqui e em
//     alertsRepository.ts (P0.1, 09/09/2026)
//
// Fonte do tipo de banco: database.types.ts (isolamento de tipos).
// Pré-condição: row já passou por orbitAlertTableRowSchema.parse().

import type { Database } from '@/types/database.types'
import type { Alert, AlertType, AlertSeverity, AlertNatureza, ConfidenceLevel } from '@/types/orbit'
import type { ValidatedOrbitAlertTableRow } from './orbitAlert.schema'
import { OrbitValidationError } from '../shared/types'

type OrbitAlertTableRow = Database['orbit']['Tables']['alerts']['Row']

// ── Hosts placeholder que nunca devem gerar link clicável ───────────────
// (mesmo guard aplicado em alertsRepository.ts P0.1 — duplicado aqui pra
// garantir que a camada do mapper também seja segura, independente do repo)
const PLACEHOLDER_HOSTS: readonly string[] = ['example.com', 'example.org', 'localhost']

function sanitizeActionUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('/')) return url          // rota interna: sempre segura
  try {
    const host = new URL(url).hostname
    return PLACEHOLDER_HOSTS.includes(host) ? null : url
  } catch {
    return null                                 // URL malformada: sem link
  }
}

/**
 * Converte uma linha crua de orbit.alerts para o shape Alert do domínio.
 *
 * `id` e `client_id` são NOT NULL no banco (confirmado) — sem hazard de
 * identidade aqui. Diferente de AvatarAlignmentMapper, que vinha de view
 * com LEFT JOIN, esta é uma tabela direta.
 */
export function mapOrbitAlertRowToContract(
  row: ValidatedOrbitAlertTableRow
): Alert {
  const safeActionUrl = sanitizeActionUrl(row.action_url)

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? '',
    clientHandle: row.clients?.handle ?? '',
    type: row.alert_type as AlertType,         // estreitado pelo schema Zod
    severity: row.severity as AlertSeverity,   // estreitado pelo schema Zod
    title: row.title,
    description: row.description ?? '',
    metricName: row.metric_name ?? null,
    metricValue: row.metric_value ?? null,
    thresholdValue: row.threshold_value ?? null,
    isResolved: row.is_resolved,
    snoozedUntil: row.snoozed_until ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    createdAt: row.created_at,
    action: safeActionUrl
      ? { type: 'link', label: 'Ver detalhes', url: safeActionUrl }
      : null,
    // Campos epistemológicos — ✅ corrigem gap: ausentes do contrato original
    natureza: (row.natureza ?? undefined) as AlertNatureza | undefined,
    confidenceLevel: (row.confidence_level ?? undefined) as ConfidenceLevel | undefined,
    probableCause: row.probable_cause ?? undefined,
    suggestedAction: row.suggested_action ?? undefined,
    dataSource: row.data_source ?? undefined,
    // FKs de referência cruzada (contexto do alerta)
    snapshotId: row.snapshot_id ?? undefined,
    // NOTE: campos de contexto extra em orbit.alerts não existem no contrato Alert
    // e devem permanecer fora do shape do domínio atual.
  }
}

/**
 * Versão em lote, resiliente — linhas com erro de identidade são descartadas
 * e logadas em vez de derrubar a página inteira.
 */
export function mapOrbitAlertRowsToContract(
  rows: readonly ValidatedOrbitAlertTableRow[]
): Alert[] {
  return rows.reduce<Alert[]>((acc, row) => {
    try {
      acc.push(mapOrbitAlertRowToContract(row))
    } catch (err) {
      if (err instanceof OrbitValidationError) {
        console.warn('[OrbitAlertMapper] linha descartada:', err.details)
        return acc
      }
      throw err
    }

    return acc
  }, [])
}

export type { OrbitAlertTableRow }