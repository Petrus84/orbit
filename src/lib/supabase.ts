import { createClient } from '@supabase/supabase-js'

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

// ✅ UMA ÚNICA DECLARAÇÃO (schema: orbit)
export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  db: { schema: 'orbit' as const },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ✅ UMA ÚNICA DECLARAÇÃO (schema: public — fallback)
export const supabaseLegacy = createClient(supabaseUrl || '', supabaseKey || '', {
  db: { schema: 'public' as const },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    storageKey: 'orbit-legacy',
    detectSessionInUrl: false,
  },
})
