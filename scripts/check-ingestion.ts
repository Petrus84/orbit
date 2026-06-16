import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('🔍 Verificando dados inseridos...\n')

  const { data, error } = await supabase
    .from('kpi_raw_ingestion')
    .select('id, client_id, owner_username, posted_at, ingestion_status, source')
    .order('posted_at', { ascending: false })

  if (error) {
    console.error('❌ Erro na query:', error)
    return
  }

  console.log(`Total de registros encontrados: ${data?.length || 0}\n`)

  if (data && data.length > 0) {
    console.table(data.map(row => ({
      id: row.id.slice(0, 8) + '...',
      client_id: row.client_id,
      owner_username: row.owner_username || 'N/A',
      posted_at: row.posted_at,
      status: row.ingestion_status,
      source: row.source
    })))
  } else {
    console.log('⚠️ Nenhum registro encontrado na tabela kpi_raw_ingestion')
  }
}

check()
