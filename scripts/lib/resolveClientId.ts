import { SupabaseClient } from '@supabase/supabase-js'

const cache = new Map<string, string>()

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
    .single()

  if (error || !data) {
    throw new Error(
      `[resolveClientId] handle "${handle}" não encontrado em orbit.clients: ${error?.message ?? 'sem dados'}`
    )
  }

  cache.set(handle, data.id)
  return data.id
}