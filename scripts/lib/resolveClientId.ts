import { SupabaseClient } from '@supabase/supabase-js'

const cache = new Map<string, string>()

/**
 * Resolve o UUID canônico de um cliente a partir do handle, em orbit.clients.
 *
 * Diferença chave em relação a uma resolução ingênua com .single():
 * - Se o handle não existir: lança Error normal (chamador decide se pula ou aborta).
 * - Se o handle existir em MAIS DE UM registro (duplicidade real, como
 *   aconteceu com "eupetruchio84" em public.clients): interrompe o processo
 *   inteiro com process.exit(1) e loga os UUIDs colidentes, para nunca
 *   gravar dado novo amarrado a um ID órfão.
 */
export async function resolveClientId(
  supabase: SupabaseClient,
  handle: string,
): Promise<string> {
  if (cache.has(handle)) return cache.get(handle)!

  const { data, error } = await supabase
    .schema('orbit')
    .from('clients')
    .select('id')
    .eq('handle', handle)

  if (error) {
    throw new Error(`[resolveClientId] erro ao consultar orbit.clients para "${handle}": ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error(`[resolveClientId] handle "${handle}" não encontrado em orbit.clients`)
  }

  if (data.length > 1) {
    console.error(
      `\n🚨 [resolveClientId] DUPLICIDADE CRÍTICA: o handle "${handle}" resolve para ${data.length} ` +
      `registros em orbit.clients: ${data.map(r => r.id).join(', ')}\n` +
      `   Ingest abortado para não gravar posts em um ID órfão.\n` +
      `   Resolva a duplicidade em orbit.clients antes de rodar novamente.\n`
    )
    process.exit(1)
  }

  const id: string = data[0].id
  cache.set(handle, id)
  return id
}