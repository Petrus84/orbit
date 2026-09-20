/**
 * ORBIT — Validador de Alinhamento Banco ↔ TypeScript
 * 
 * Objetivo: Comparar schema PostgreSQL com tipos TypeScript
 * Detecta: campos NOT NULL no banco mas opcionais no TS (e vice-versa)
 * 
 * Uso:
 *   npx ts-node validate-db-types.ts
 * 
 * Saída: relatório de desalinhamentos por tabela
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

// ============================================================================
// TIPOS ESPERADOS (fonte de verdade do seu projeto)
// ============================================================================

interface DBSchema {
[tableName: string]: {
  [columnName: string]: {
    nullable: boolean
    type: string
    hasDefault: boolean
  }
}
}

interface TSType {
[fieldName: string]: {
  required: boolean
  type: string
}
}

interface SchemaColumnRow {
  table_name: string
  column_name: string
  is_nullable: string
  data_type: string
  column_default: string | null
}

// Seus tipos TypeScript (mapeamento manual — idealmente seria gerado)
const TYPESCRIPT_TYPES: Record<string, TSType> = {
clients: {
  id: { required: true, type: 'uuid' },
  createdAt: { required: true, type: 'timestamp' },
  updatedAt: { required: true, type: 'timestamp' },
  name: { required: true, type: 'string' },
  handle: { required: true, type: 'string' },
  subscriptionId: { required: true, type: 'uuid' },
  avatar: { required: false, type: 'string' },
  avatarExpectedGender: { required: false, type: 'enum' },
  avatarExpectedAgeMin: { required: false, type: 'number' },
  avatarExpectedAgeMax: { required: false, type: 'number' },
  avatarExpectedGeoPrimary: { required: false, type: 'string' },
  avatarExpectedGeoPct: { required: false, type: 'number' },
  healthStatus: { required: true, type: 'enum' },
  thresholdCtrBioMin: { required: true, type: 'number' },
  thresholdPolemicMax: { required: true, type: 'number' },
},
alerts: {
  id: { required: true, type: 'uuid' },
  clientId: { required: true, type: 'uuid' },
  severity: { required: true, type: 'enum' },
  metricValue: { required: false, type: 'number' },
  thresholdValue: { required: false, type: 'number' },
  description: { required: false, type: 'string' },
  suggestedAction: { required: false, type: 'string' },
  resolvedBy: { required: false, type: 'string' },
  natureza: { required: false, type: 'enum' },
},
ig_account_snapshots: {
  id: { required: true, type: 'uuid' },
  clientId: { required: true, type: 'uuid' },
  followersTotal: { required: false, type: 'number' },
  reachTotal: { required: false, type: 'number' },
  erRealPct: { required: false, type: 'number' },
  polemicScorePct: { required: false, type: 'number' },
  vpsPct: { required: false, type: 'number' },
},
client_onboarding: {
  clientId: { required: true, type: 'uuid' },
  totalFollowers: { required: true, type: 'number' },
  bioLinks: { required: true, type: 'array' },
  avatarExpectedAgeMin: { required: false, type: 'number' },
  avatarExpectedAgeMax: { required: false, type: 'number' },
  expectedSchwartz: { required: false, type: 'object' },
  realSchwartz: { required: false, type: 'object' },
},
}

// ============================================================================
// VALIDADOR
// ============================================================================

interface ValidationResult {
table: string
column: string
issue: string
severity: 'error' | 'warning'
bankNullable: boolean
tsRequired: boolean
suggestion: string
}

async function validateAlignment(): Promise<void> {
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { db: { schema: 'orbit' } }
)

console.log('📊 ORBIT — Validador de Alinhamento Banco ↔ TypeScript\n')
console.log('🔍 Consultando schema PostgreSQL...\n')

// Fetch schema do banco via RPC (information_schema não é exposto pelo PostgREST diretamente)
const { data: schemaData, error } = await supabase.rpc('get_schema_info')

if (error) {
  console.error('❌ Erro ao consultar schema:', error)
  return
}

// Agrupar por tabela
const dbSchema: DBSchema = {}
;(schemaData || []).forEach((row: SchemaColumnRow) => {
  const table = row.table_name
  const col = row.column_name

  if (!dbSchema[table]) {
    dbSchema[table] = {}
  }

  dbSchema[table][col] = {
    nullable: row.is_nullable === 'YES',
    type: row.data_type,
    hasDefault: row.column_default !== null,
  }
})

// Comparar
const results: ValidationResult[] = []

for (const [tableName, tsFields] of Object.entries(TYPESCRIPT_TYPES)) {
  if (!dbSchema[tableName]) {
    console.warn(`⚠️  Tabela ${tableName} não encontrada no banco`)
    continue
  }

  const dbFields = dbSchema[tableName]

  for (const [fieldName, tsType] of Object.entries(tsFields)) {
    // Converter camelCase → snake_case
    const dbColumnName = fieldName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')

    const dbColumn = dbFields[dbColumnName]

    if (!dbColumn) {
      results.push({
        table: tableName,
        column: dbColumnName,
        issue: `Campo TypeScript não existe no banco`,
        severity: 'error',
        bankNullable: false,
        tsRequired: tsType.required,
        suggestion: `Remover ${fieldName} de ${tableName} ou criar coluna ${dbColumnName}`,
      })
      continue
    }

    // Verificar desalinhamento: banco nullable vs TS required
    if (dbColumn.nullable && tsType.required && !dbColumn.hasDefault) {
      results.push({
        table: tableName,
        column: dbColumnName,
        issue: `Banco permite NULL, mas TypeScript exige valor`,
        severity: 'error',
        bankNullable: true,
        tsRequired: true,
        suggestion: `Mudar TypeScript para ${fieldName}?: tipo | undefined`,
      })
    }

    // Verificar desalinhamento: banco NOT NULL vs TS optional
    if (!dbColumn.nullable && !tsType.required && !dbColumn.hasDefault) {
      results.push({
        table: tableName,
        column: dbColumnName,
        issue: `Banco exige valor, mas TypeScript marca como opcional`,
        severity: 'warning',
        bankNullable: false,
        tsRequired: false,
        suggestion: `Mudar TypeScript para ${fieldName}: tipo (remover ?)`,
      })
    }
  }
}

// Exibir relatório
console.log('═'.repeat(80))
console.log('📋 RELATÓRIO DE DESALINHAMENTOS')
console.log('═'.repeat(80) + '\n')

if (results.length === 0) {
  console.log('✅ Nenhum desalinhamento detectado!\n')
  return
}

// Agrupar por severidade
const errors = results.filter(r => r.severity === 'error')
const warnings = results.filter(r => r.severity === 'warning')

if (errors.length > 0) {
  console.log(`🔴 ERROS (${errors.length}):\n`)
  errors.forEach(r => {
    console.log(`  📍 ${r.table}.${r.column}`)
    console.log(`     Problema: ${r.issue}`)
    console.log(`     Banco: nullable=${r.bankNullable}, TypeScript: required=${r.tsRequired}`)
    console.log(`     ✏️  ${r.suggestion}\n`)
  })
}

if (warnings.length > 0) {
  console.log(`🟡 AVISOS (${warnings.length}):\n`)
  warnings.forEach(r => {
    console.log(`  📍 ${r.table}.${r.column}`)
    console.log(`     Problema: ${r.issue}`)
    console.log(`     ✏️  ${r.suggestion}\n`)
  })
}

// Resumo
console.log('═'.repeat(80))
console.log(`📊 RESUMO: ${errors.length} erros, ${warnings.length} avisos`)
console.log('═'.repeat(80) + '\n')

// Gerar SQL fix (sugestão)
if (errors.length > 0) {
  console.log('💡 SQL SUGERIDO PARA CORRIGIR ERROS:\n')
  errors.forEach(r => {
    if (r.bankNullable && r.tsRequired) {
      console.log(`-- ${r.table}.${r.column}`)
      console.log(
        `ALTER TABLE orbit.${r.table} ALTER COLUMN ${r.column} SET NOT NULL;`
      )
      console.log(
        `-- Ou: ALTER TABLE orbit.${r.table} ALTER COLUMN ${r.column} DROP NOT NULL;\n`
      )
    }
  })
}
}

// ============================================================================
// EXECUTAR
// ============================================================================

validateAlignment().catch(console.error)