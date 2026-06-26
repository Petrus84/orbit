/* ==========================================================================
   ORBIT · Supabase Client Singleton
   Caminho: src/lib/supabaseClient.ts
   Versão: 2.0.0

   MUDANÇAS v2.0.0:
   - db: { schema: 'orbit' } → supabase.from('clients') aponta para orbit.clients
   - supabaseLegacy → aponta para public.* (fallback durante transição)
   - Sem GoTrueClient duplicado (singleton estrito)
   - ERR_INTERNET_DISCONNECTED não quebra o build: o erro acontece em runtime
     na tentativa de refresh_token, não no módulo. O cliente é criado normalmente
     e as queries falham com mensagem tratável nos repositórios.
   ========================================================================== */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[ORBIT] NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios. ' +
    'Verifique seu .env.local.'
  )
}

// Cliente principal — schema orbit (Sprint 2+)
// supabase.from('clients') → orbit.clients
// supabase.from('ig_posts') → orbit.ig_posts
// ...existing code...

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'orbit' },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export const supabaseLegacy = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Cliente legado — schema public (Sprint 1)
// Usar APENAS nos repositórios com fallback durante a transição
// Remover no Sprint 3 quando orbit.* estiver 100% populado
export const supabaseLegacy: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: false,  // Não precisa de auth no legacy client
    persistSession: false,
    storageKey: 'orbit-legacy', // Evita conflito de storage com o cliente principal
  },
})