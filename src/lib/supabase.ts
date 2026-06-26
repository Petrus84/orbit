import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[ORBIT] ${name} obrigatório`)
  }
  return value
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// ✅ UMA ÚNICA DECLARAÇÃO (schema: orbit)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'orbit' as const },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ✅ UMA ÚNICA DECLARAÇÃO (schema: public — fallback)
export const supabaseLegacy = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' as const },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    storageKey: 'orbit-legacy',
    detectSessionInUrl: false,
  },
})
