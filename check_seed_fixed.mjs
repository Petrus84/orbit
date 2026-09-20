import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Lendo .env.local...\n');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const getEnvVar = (name) => {
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith(`${name}=`)) {
      let value = line.substring(name.length + 1).trim();
      value = value.replace(/^["']|["']$/g, '');
      return value;
    }
  }
  return null;
};

const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const key = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

console.log(`✅ SUPABASE_URL: ${url?.substring(0, 40)}...`);
console.log(`✅ SUPABASE_ANON_KEY: ${key?.substring(0, 20)}...\n`);

if (!url || !key) {
  console.error('❌ Variáveis não encontradas');
  process.exit(1);
}

console.log('🔗 Conectando ao Supabase (schema: orbit)...');
console.log('📋 Procurando alerts com example.com...\n');

try {
  // ⭐ CORREÇÃO: Adicionar header 'apikey' (obrigatório no PostgREST)
  const response = await fetch(
    `${url}/rest/v1/orbit.alerts?action_url=ilike.*example.com*&select=id,action_url,title`,
    {
      method: 'GET',
      headers: {
        'apikey': key,  // ← CRÍTICO: PostgREST precisa disso
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Erro HTTP:', response.status);
    console.error('Detalhes:', errorData);
    process.exit(1);
  }

  const data = await response.json();

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
  console.error('❌ Erro:', err.message);
  process.exit(1);
}
