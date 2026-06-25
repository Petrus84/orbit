import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '🚨 NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios em .env.local'
  )
}

// Sem anotação explícita — TypeScript infere o tipo correto com schema 'orbit'
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
    storageKey:         'orbit-auth-token',
  },
  db: { schema: 'orbit' },
})

// schema() retorna um tipo derivado — também inferido corretamente
export const supabaseLegacy = supabase.schema('public')

// Dev only — inferido dos valores acima, sem any
declare global {
  interface Window {
    __orbit_supabase__:       typeof supabase
    __orbit_supabaseLegacy__: typeof supabaseLegacy
  }
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__orbit_supabase__       = supabase
  window.__orbit_supabaseLegacy__ = supabaseLegacy
}

export default supabase