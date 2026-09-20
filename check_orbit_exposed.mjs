import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');

function getEnvVar(name) {
  const line = envContent
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));

  return line
    ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
    : null;
}

const url = 'https://smifhuvzroznlmbrvhaj.supabase.co';
const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  'Accept-Profile': 'orbit',
  Accept: 'application/json',
};

if (serviceKey.startsWith('eyJ')) {
  headers.Authorization = `Bearer ${serviceKey}`;
}

console.log('🔍 Testando o schema "orbit" via PostgREST com Accept-Profile...\n');

try {
  const response = await fetch(`${url}/rest/v1/`, { headers });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!response.ok) {
    console.error(`❌ HTTP ${response.status}`, data);
    process.exit(1);
  }

  if (data && data.swagger && data.paths) {
    const paths = Object.keys(data.paths);
    console.log('✅ Schema "orbit" respondeu com sucesso!');
    console.log(`📋 Total de endpoints/tabelas encontrados: ${paths.length}\n`);
    paths.forEach((path) => console.log(`  - ${path}`));
  } else {
    console.error('❌ Resposta inesperada:', data);
  }
} catch (error) {
  console.error('❌ Erro de conexão:', error.message);
}
