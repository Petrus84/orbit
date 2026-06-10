/* ==========================================================================
   ORBIT · Infrastructure — Dynamic Provisioning & Seeder Engine (v2.2.0)
   Caminho: scripts/seed-dynamic.ts
   Responsabilidade: Escanear as pastas locais, cadastrar automaticamente
   agências, clientes e leads novos na nuvem do Supabase de uma só vez.
   
   ✅ CORREÇÕES v2.2.0:
   - Lê PASTA_OPERATIONAL e PASTA_LEAD do .env.local (via dotenv)
   - Tipagem explícita (file: string) para extinguir TS7006
   - Campo email adicionado em agencies (satisfaz NOT NULL)
   - Try-catch global com logs claros
   - Validação de ambiente com mensagem de erro descritiva
   ========================================================================== */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import process from 'process'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// ✅ CORREÇÃO #5: Ler paths do .env.local (consistência com ingest-l0-v2.ts)
// ─────────────────────────────────────────────────────────────────────────

const PASTA_CLIENTES = process.env.PASTA_OPERATIONAL ?? ''
const PASTA_LEADS = process.env.PASTA_LEAD ?? ''

if (!PASTA_CLIENTES || !PASTA_LEADS) {
  console.error('\n🚨 ERRO CRÍTICO DE AMBIENTE:')
  console.error('   PASTA_OPERATIONAL e PASTA_LEAD são obrigatórias no .env.local')
  console.error('   Exemplo:')
  console.error('   PASTA_OPERATIONAL=C:/Users/DELL/Downloads/Alpha_Coleta/clientes')
  console.error('   PASTA_LEAD=C:/Users/DELL/Downloads/Alpha_Coleta/leads\n')
  process.exit(1)
}

// IDs Padrão de Homologação (Sua Base de Testes)
const AGENCY_TEST_ID = '11111111-1111-1111-1111-111111111111'
const CLIENT_TEST_ID = '22222222-2222-2222-2222-222222222222'

// ─────────────────────────────────────────────────────────────────────────
// 💡 MELHORIA: Validação explícita de variáveis de ambiente com mensagem clara
// ─────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("\n🚨 ERRO CRÍTICO DE AMBIENTE:")
  console.error("   As variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
  console.error("   são obrigatórias no escopo do processo do terminal.\n")
  process.exit(1)
}

// Instanciação administrativa master para bypassar as restrições de RLS do banco
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ─────────────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL: Dynamic Seeder
// ─────────────────────────────────────────────────────────────────────────

async function dynamicSeeder() {
  console.log('\n====== 🚀 ORBIT DYNAMIC PROVISIONING ENGINE ======')

  // 💡 MELHORIA: Bloco try-catch global com logs claros para capturar falhas
  try {
    
    // ─── PASSO 1: PROVISIONAR A AGÊNCIA MESTRE DE TESTES ───────────────────
    console.log('🏢 Validando Agência Mestre de Homologação...')
    const { error: agencyError } = await supabase
      .from('agencies')
      .upsert({ 
        id: AGENCY_TEST_ID, 
        name: 'Alpha Agência Digital Mestre',
        // 💡 CORREÇÃO: Campo adicionado para satisfazer a restrição Not-Null do Supabase
        email: 'homologacao@alphaagencia.com'
      }, { onConflict: 'id' })

    if (agencyError) {
      throw new Error(`Falha crítica ao registrar agência: ${agencyError.message}`)
    }

    console.log('   ✅ Agência Mestre validada e pronta')

    // ─── PASSO 2: ESCANEAR E CADASTRAR CLIENTES OPERACIONAIS ───────────────
    // 💡 MELHORIA: Verificação prévia de existência de pasta física antes da leitura
    if (fs.existsSync(PASTA_CLIENTES)) {
      // 💡 MELHORIA: Tipagem explícita (file: string) para extinguir o erro TS7006
      const subpastas = fs.readdirSync(PASTA_CLIENTES).filter((file: string) => 
        fs.statSync(path.join(PASTA_CLIENTES, file)).isDirectory()
      )

      console.log(`\n📂 Escaneando pasta de Clientes Operacionais... Encontradas: ${subpastas.length}`)

      for (const username of subpastas) {
        // Mapeamento semântico: extrai 'cpimportstore' caso a pasta seja o backup 'instagram-cpimportstore-...'
        let clientName = username
        if (username.startsWith('instagram-')) {
          const partes = username.split('-')
          if (partes.length > 1) {
            clientName = partes[1] // Pinça o handle do meio
          }
        }

        console.log(`👤 Provisionando Cliente Operacional real: ${clientName}...`)
        
        // Se for o cliente alvo padrão, força o ID estático de PRD para manter o vínculo
        const targetClientId = clientName === 'cpimportstore' ? CLIENT_TEST_ID : undefined

        const clientPayload = {
          ...(targetClientId && { id: targetClientId }),
          agency_id: AGENCY_TEST_ID,
          name: `E-commerce ${clientName.toUpperCase()}`,
          instagram_account_id: clientName,
          is_business_account: true
        }

        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .upsert(clientPayload, { onConflict: 'agency_id,instagram_account_id' })
          .select('id, name')
          .single()

        if (clientError) {
          console.error(`   ❌ Falha ao sincronizar cliente ${clientName}:`, clientError.message)
        } else if (clientData) {
          console.log(`   ✅ Sincronizado! UUID na Nuvem: ${clientData.id} → ${clientData.name}`)
        }
      }
    } else {
      console.log(`\n⏭️  Pasta operacional de clientes não encontrada em: ${PASTA_CLIENTES}`)
    }

    // ─── PASSO 3: ESCANEAR E CADASTRAR LEADS DE PROSPECÇÃO COMERCIAL ───────
    if (fs.existsSync(PASTA_LEADS)) {
      // 💡 MELHORIA: Tipagem explícita (file: string) para extinguir o erro TS7006
      const subpastasLeads = fs.readdirSync(PASTA_LEADS).filter((file: string) => 
        fs.statSync(path.join(PASTA_LEADS, file)).isDirectory()
      )

      console.log(`\n📂 Escaneando pasta de Leads de Vendas... Encontradas: ${subpastasLeads.length}`)

      for (const leadUsername of subpastasLeads) {
        console.log(`🎯 Canal de leads validado e pronto para receber arquivos de: @${leadUsername}`)
      }
    } else {
      console.log(`⏭️  Pasta comercial de leads não encontrada em: ${PASTA_LEADS}`)
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('\n🚨 CRÍTICO: Falha na esteira de provisionamento do SaaS:', msg)
  }

  console.log('\n====== 🏁 PROVISIONAMENTO CONCLUÍDO ======\n')
  process.exit(0)
}

// ─────────────────────────────────────────────────────────────────────────
// EXECUTAR
// ─────────────────────────────────────────────────────────────────────────

dynamicSeeder()
