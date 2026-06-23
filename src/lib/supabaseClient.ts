/* ==========================================================================
   ORBIT · Supabase Client Singleton
   Versão: 2.0.0  |  Sprint 2
   
   MUDANÇA CRÍTICA em relação à v1.0.0:
   → Adicionado db: { schema: 'orbit' }
   
   Com isso, todas as chamadas supabase.from('tabela') apontam para
   orbit.tabela por padrão. O schema public.* continua acessível via
   supabase.schema('public').from('tabela') para queries cross-schema
   nos repositórios legados durante a transição.
   
   ATENÇÃO: O Realtime em useInstagramOverview ainda ouve
   public.kpi_snapshots — atualizar para orbit.ig_account_snapshots
   no Sprint 3 quando o polling substituir o realtime legacy.
   ========================================================================== */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[ORBIT] NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios. ' +
    'Verifique seu .env.local.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  { db: { schema: 'orbit' as const } }
)

export const supabaseLegacy = createClient(
  supabaseUrl,
  supabaseKey,
  { db: { schema: 'public' as const } }
)