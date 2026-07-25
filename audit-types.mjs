// audit-types.js
// Script de auditoria de tipos - ORBIT Dashboard
// Rode com: node audit-types.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 💡 IMPORTS RESTAURADOS E TRATADOS PARA ES MODULES NATIVO
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');
const extensions = ['.ts', '.tsx'];

let results = {
  filesScanned: 0,
  qualityScoreProperties: new Set(),
  kpiCardProperties: new Set(),
  overviewProperties: new Set(),
  supabaseLeaks: [], // 🆕 Teste 3: Vazamento do Supabase
  typeCastings: [],  // 🆕 Teste 4: Forçamento de tipo implícito
  filesUsingQualityScores: [],
  filesUsingKPICard: [],
};

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (extensions.includes(path.extname(file))) {
      analyzeFile(fullPath);
    }
  }
}

function analyzeFile(filePath) {
  results.filesScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(__dirname, filePath);

  // 1. Procura usos de qualityScores / QualityScoreItem
  if (content.includes('qualityScores') || content.includes('QualityScoreItem')) {
    results.filesUsingQualityScores.push(relativePath);

    const qualityMatches = content.match(/qualityScores\.[a-zA-Z_]+|item\.[a-zA-Z_]+|score\.[a-zA-Z_]+/g) || [];
    qualityMatches.forEach(match => {
      const prop = match.split('.').pop();
      if (prop) results.qualityScoreProperties.add(prop);
    });
  }

  // 2. Procura usos de kpis / KPICardData
  if (content.includes('kpis') || content.includes('KPICardData')) {
    results.filesUsingKPICard.push(relativePath);

    const kpiMatches = content.match(/kpis\.[a-zA-Z_]+|kpi\.[a-zA-Z_]+|\.label|\.value|\.delta|\.semaphore|\.glowColor|\.unit/g) || [];
    kpiMatches.forEach(match => {
      const prop = match.split('.').pop();
      if (prop) results.kpiCardProperties.add(prop);
    });
  }

  // 3. 🆕 TESTE ADICIONADO: Detectar se componentes visuais chamam o arquivo do Supabase direto
  if (relativePath.includes('src/components/') && content.includes('src/lib/supabase')) {
    results.supabaseLeaks.push(relativePath);
  }

  // 4. 🆕 TESTE ADICIONADO: Localizar Type Casting "escondido" (ex: "as Wallet", "as KPIData")
  // Ignora o uso legítimo de "as const"
  if (/ as [A-Z][a-zA-Z0-9]+/.test(content) && !content.includes('as const')) {
    const castingMatches = content.match(/ as [A-Z][a-zA-Z0-9]+/g) || [];
    castingMatches.forEach(() => {
      if (!results.typeCastings.includes(relativePath)) {
        results.typeCastings.push(relativePath);
      }
    });
  }
}

// Executa a varredura
console.log('Iniciando auditoria de tipos estendida...\n');
scanDirectory(SRC_DIR);

// Resultado
console.log('====================================');
console.log('       RELATÓRIO DE AUDITORIA');
console.log('====================================\n');

console.log(`Arquivos escaneados: ${results.filesScanned}\n`);

console.log('📌 [TESTE 1] Arquivos que usam Quality Scores:');
results.filesUsingQualityScores.forEach(f => console.log(`   - ${f}`));
console.log(`   👉 Propriedades detectadas: ${[...results.qualityScoreProperties].sort().join(', ') || 'Nenhuma'}\n`);

console.log('📌 [TESTE 2] Arquivos que usam KPIs / KPICard:');
results.filesUsingKPICard.forEach(f => console.log(`   - ${f}`));
console.log(`   👉 Propriedades detectadas: ${[...results.kpiCardProperties].sort().join(', ') || 'Nenhuma'}\n`);

console.log('⚠️ [TESTE 3 - VAZAMENTO] Componentes acoplados direto ao Supabase:');
if (results.supabaseLeaks.length === 0) console.log('   ✅ Nenhum vazamento detectado! Boa arquitetura.');
results.supabaseLeaks.forEach(f => console.log(`   🚨 REVISAR: ${f}`));

console.log('\n🔍 [TESTE 4 - GAMBIARRAS] Arquivos usando coerção de tipo ("as Tipo"):');
if (results.typeCastings.length === 0) console.log('   ✅ Nenhum forçamento de tipo detectado.');
results.typeCastings.forEach(f => console.log(`   ⚠️ ALERTA: ${f}`));

console.log('\n====================================');
console.log('Fim do relatório');
