
// ============================================================================
// src/types/client.ts
// RE-EXPORT BARREL — não declare tipos aqui.
// Fonte canônica única: src/types/orbit.ts
//
// ✅ PATCH (tela Carteira, integração real): faltava reexportar
// ClientHealthStatus. Sem isso, clientsRepository.ts não tinha como
// importar o tipo — usava ClientStatus (status de ASSINATURA:
// active/inactive/paused) para tipar o que é, na verdade, status de SAÚDE
// (healthy/warning/critical/unknown). orbit.ts já documenta essa confusão
// (comentário próximo à definição de ClientStatus) e diz que a correção é
// no repositório — é exatamente o que este patch + o de
// clientsRepository.ts fazem.
//
// ClientStatus continua exportado porque é um tipo real e distinto — só
// não é o que Client.status usa (esse é ClientHealthStatus).
//
// Manutenção: adicione tipos novos em orbit.ts e reexporte aqui.
// ============================================================================

export type {
  ClientStatus,
  ClientHealthStatus,
  FetchStatus,
  AsyncState,
  ClientMetrics,
  Client,
  UseClientsResult,
} from './orbit'