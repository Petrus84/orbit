// ============================================================================
// ARQUIVO: check-ingestion.ts (v2.0.0 — TABELA E COLUNAS CORRIGIDAS)
// ============================================================================
// ✅ CORREÇÕES v2.0.0:
// - v1 consultava `kpi_raw_ingestion` sem `.schema('orbit')`. Verificação
//   direta no Supabase (information_schema.tables) mostrou que essa tabela
//   NÃO EXISTE em nenhum schema — nem `public`, nem `orbit`. Não era um
//   problema de schema errado, era referência a uma tabela fantasma; o
//   script nunca funcionou nesta forma.
// - A tabela real de auditoria de ingestão é `orbit.raw_ig_ingest`, e as
//   colunas também são diferentes das que v1 selecionava
//   (owner_username, posted_at, ingestion_status, source não existem).
//   Colunas reais confirmadas via information_schema.columns:
//   id, client_id, import_session, ingested_at, source_file, source_key,
//   ingest_script, raw_payload, confidence_level, parsed, parse_error,
//   parsed_into.
// - Adiciona join com orbit.clients para mostrar o handle em vez de só o
//   UUID (mais legível pra conferência manual), e ordena por ingested_at
//   (a coluna que de fato existe e representa "quando o dado entrou").
// ============================================================================

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
    .schema('orbit')
    .from('raw_ig_ingest')
    .select(`
      id,
      client_id,
      import_session,
      ingested_at,
      source_file,
      source_key,
      ingest_script,
      confidence_level,
      parsed,
      parse_error,
      parsed_into,
      clients:client_id ( handle )
    `)
    .order('ingested_at', { ascending: false })

  if (error) {
    console.error('❌ Erro na query:', error)
    return
  }

  console.log(`Total de registros encontrados: ${data?.length || 0}\n`)

  if (data && data.length > 0) {
    console.table(data.map(row => {
      // O join client:client_id vem como objeto (ou array, dependendo da
      // versão do supabase-js) — normaliza pros dois casos sem usar `any`.
      const clientRel = row.clients as { handle?: string } | { handle?: string }[] | null
      const handle = Array.isArray(clientRel) ? clientRel[0]?.handle : clientRel?.handle

      return {
        id: row.id.slice(0, 8) + '...',
        handle: handle ?? row.client_id.slice(0, 8) + '...',
        ingest_script: row.ingest_script,
        source_file: row.source_file,
        ingested_at: row.ingested_at,
        parsed: row.parsed,
        confidence: row.confidence_level,
        parse_error: row.parse_error ?? '',
      }
    }))
  } else {
    console.log('⚠️  Nenhum registro encontrado em orbit.raw_ig_ingest')
    console.log('   Isso pode significar: (a) os scripts de ingest ainda não gravam')
    console.log('   nessa tabela de auditoria (só nas tabelas finais), ou (b) realmente')
    console.log('   não há nada ingerido ainda. Confirme com uma query direta se tiver dúvida.')
  }
}

check()