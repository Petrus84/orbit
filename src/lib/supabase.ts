// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// ─── Captura Direta e Literal (Exigência do Next.js para Client-Side) ────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ─── Validação Segura de Ambiente ──────────────────────────────────────────
if (!supabaseUrl || !supabaseKey) {
  // Lança o erro apenas se estiver executando no Servidor Node.js
  if (typeof window === 'undefined') {
    throw new Error(`[ORBIT] Variáveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não foram encontradas no ambiente do servidor.`)
  } else {
    // No navegador do cliente, apenas avisa no console para evitar o travamento da tela de login
    console.warn(`[ORBIT] Aviso: Variáveis de ambiente ainda não injetadas no contexto do navegador.`)
  }
}

// ✅ v2 (31/08/2026): createClient<Database> — antes era createClient() sem
// generic, o que deixava .from(tabela) sem nenhum tipo real de coluna e
// quebrava o narrowing de .single()/.maybeSingle() (causa raiz confirmada
// lendo postgrest-js/src/types.ts: IsValidResultOverride só resolve
// Result como "objeto único" quando o builder já sabe o shape real da
// tabela). database.types.ts gerado via
// `supabase gen types typescript --project-id smifhuvzroznlmbrvhaj --schema orbit`.
//
// ✅ SCHEMA: orbit (principal)
export const supabase = createClient<Database, 'orbit'>(
  supabaseUrl || '',
  supabaseKey || '',
  {
    db: { schema: 'orbit' as const },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// ✅ SCHEMA: orbit (fallback — mesmo schema, configuração alternativa se necessário)
export const supabaseLegacy = createClient<Database, 'orbit'>(
  supabaseUrl || '',
  supabaseKey || '',
  {
    db: { schema: 'orbit' as const },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'orbit-legacy',
      detectSessionInUrl: false,
    },
  }
)
