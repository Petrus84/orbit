import fs from 'fs';



const envContent = fs.readFileSync('.env.local', 'utf8');



function getEnvVar(name) {

  const line = envContent

    .split(/\r?\n/)

    .find((line) => line.startsWith(`${name}=`));



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



// Compatibilidade com a chave legada service_role, que é um JWT.

// Não adicionar Authorization para sb_secret_...

if (serviceKey.startsWith('eyJ')) {

  headers.Authorization = `Bearer ${serviceKey}`;

}



console.log('🔍 Testando o schema "orbit" via PostgREST...\n');



try {

  const response = await fetch(`${url}/rest/v1/`, {

    headers,

  });



  const text = await response.text();



  let data;

  try {

    data = JSON.parse(text);

  } catch {

    data = text;

  }



  if (!response.ok) {

    console.error(`❌ HTTP ${response.status}`);

    console.error(data);

    process.exit(1);

  }



  if (data && data.swagger && data.paths) {

    const paths = Object.keys(data.paths);



    console.log('✅ Schema "orbit" respondeu pela Data API.');

    console.log(`📋 Endpoints encontrados: ${paths.length}`);



    if (paths.length > 0) {

      console.log('\nTabelas/funções disponíveis:');

      paths.forEach((path) => console.log(`  - ${path}`));

    } else {

      console.log(

        '\n⚠️ O schema respondeu, mas não há tabelas ou funções visíveis para esta API key.'

      );

    }

  } else {

    console.error('❌ Resposta inesperada:');

    console.error(data);

    process.exit(1);

  }

} catch (error) {

  console.error('❌ Erro de conexão:', error.message);

  process.exit(1);

}