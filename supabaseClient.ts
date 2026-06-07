/* ==========================================================================
   ORBIT · Supabase Client Singleton
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  as string
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('[ORBIT] NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios.')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)
