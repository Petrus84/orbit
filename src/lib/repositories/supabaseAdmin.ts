// ============================================================================
// src/lib/supabaseAdmin.ts
//
// ⚠️ SERVER-ONLY. Nunca importar este arquivo de um componente 'use client'
// nem de qualquer código que rode no navegador — SUPABASE_SERVICE_ROLE_KEY
// (sem prefixo NEXT_PUBLIC_) dá bypass total de RLS em qualquer tabela.
// Se esse import aparecer num bundle client-side, a key vazou. Uso
// legítimo: exclusivamente dentro de Route Handlers (app/api/**/route.ts)
// e Server Actions, que rodam só no servidor.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error(
    '[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente. ' +
      'Este client só deve ser instanciado em runtime server-side (Route Handler).'
  )
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})