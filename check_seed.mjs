import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Lendo .env.local...\n');

// Ler arquivo
const envPath = path.join(process.cwd(), '.env.local');
console.log(`📂 Procurando em: ${envPath}`);

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env.local não encontrado!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');

// Parser melhorado para NEXT_PUBLIC_*
const getEnvVar = (name) => {
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith(`${name}=`)) {
      let value = line.substring(name.length + 1).trim();
      // Remove aspas se existirem
      value = value.replace(/^["']|["']$/g, '');
      return value;
    }
  }
  return null;
};

// Tentar NEXT_PUBLIC_* primeiro, depois fallback para SUPABASE_*
const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const key = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

console.log(`\n✅ SUPABASE_URL: ${url?.substring(0, 40)}...`);
console.log(`✅ SUPABASE_ANON_KEY: ${key?.substring(0, 20)}...\n`);

if (!url || !key) {
  console.error('❌ Erro: Uma ou ambas as variáveis estão vazias');
  console.log('\nConteúdo de .env.local (primeiras 15 linhas):');
  console.log(envContent.split('\n').slice(0, 15).join('\n'));
  process.exit(1);
}

// Conectar ao Supabase
console.log('🔗 Conectando ao Supabase...');
const client = createClient(url, key);

console.log('📋 Procurando alerts com example.com no schema "orbit"...\n');

try {
  const { data, error } = await client
    .from('alerts')
    .select('id, action_url, title')
    .ilike('action_url', '%example.com%');

  if (error) {
    console.error('❌ Erro na query:', error.message);
    console.error('Detalhes:', error);
    process.exit(1);
  }

  console.log(`✅ Query bem-sucedida!\n`);
  console.log(`📊 Resultado: ${data?.length || 0} alerts encontrados\n`);

  if (data && data.length > 0) {
    console.log('⚠️  ENCONTRADOS SEEDS:');
    data.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ID: ${row.id}`);
      console.log(`     URL: ${row.action_url}`);
      console.log(`     Título: ${row.title}\n`);
    });
  } else {
    console.log('✅ ✅ ✅ NENHUM SEED example.com ENCONTRADO (BOM!) ✅ ✅ ✅');
  }
} catch (err) {
  console.error('❌ Erro ao conectar:', err.message);
  process.exit(1);
}
