// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// ═══════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '🚨 NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios em .env.local'
  )
}

// ═══════════════════════════════════════════════════════════════════
// CLIENTE PRINCIPAL (schema 'orbit')
// ═══════════════════════════════════════════════════════════════════

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  db: {
    schema: 'orbit'
  }
})

// ═══════════════════════════════════════════════════════════════════
// CLIENTE SECUNDÁRIO (schema 'public' — fallback legado)
// ═══════════════════════════════════════════════════════════════════

export const supabaseLegacy = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  }
})

// ═══════════════════════════════════════════════════════════════════
// ✅ EXPORTAR GLOBALMENTE PARA window (DESENVOLVIMENTO)
// Usando type assertion segura em vez de 'any'
// ═══════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  // Usar 'as unknown as Record<string, unknown>' para evitar 'any'
  const windowObj = window as unknown as Record<string, unknown>
  
  windowObj.supabase = supabase
  windowObj.supabaseLegacy = supabaseLegacy
  
  console.log('🔧 Supabase + Supabase Legacy disponíveis em window')
}

export default supabase
