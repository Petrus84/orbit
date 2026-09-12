// shared/types.ts
// Tipos e erros de infraestrutura compartilhados por todos os mappers ORBIT.

/**
 * Erro lançado por mappers quando um campo de identidade obrigatório
 * (ex: client_id, id) chega null de uma view com LEFT JOIN.
 * Lançar aqui — em vez de usar um fallback — é intencional: um campo
 * de identidade null indica JOIN quebrado ou corrupção de dado, não
 * um campo "sem valor de exibição". Mascarar com fallback esconderia
 * um bug de integridade.
 */
export class OrbitValidationError extends Error {
  public readonly details: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'OrbitValidationError'
    this.details = details
  }
}
