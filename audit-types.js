// audit-types.js
// Script de auditoria de tipos - ORBIT Dashboard
// Rode com: node audit-types.js

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const extensions = ['.ts', '.tsx'];

let results = {
  filesScanned: 0,
  qualityScoreProperties: new Set(),
  kpiCardProperties: new Set(),
  overviewProperties: new Set(),
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

  // Procura usos de qualityScores / QualityScoreItem
  if (content.includes('qualityScores') || content.includes('QualityScoreItem')) {
    results.filesUsingQualityScores.push(relativePath);

    // Extrai propriedades acessadas (ex: item.label, item.value, item.statusText)
    const qualityMatches = content.match(/qualityScores\.[a-zA-Z_]+|item\.[a-zA-Z_]+|score\.[a-zA-Z_]+/g) || [];
    qualityMatches.forEach(match => {
      const prop = match.split('.').pop();
      if (prop) results.qualityScoreProperties.add(prop);
    });
  }

  // Procura usos de kpis / KPICardData
  if (content.includes('kpis') || content.includes('KPICardData')) {
    results.filesUsingKPICard.push(relativePath);

    const kpiMatches = content.match(/kpis\.[a-zA-Z_]+|kpi\.[a-zA-Z_]+|\.label|\.value|\.delta|\.semaphore|\.glowColor|\.unit/g) || [];
    kpiMatches.forEach(match => {
      const prop = match.split('.').pop();
      if (prop) results.kpiCardProperties.add(prop);
    });
  }
}

// Executa a varredura
console.log('Iniciando auditoria de tipos...\n');
scanDirectory(SRC_DIR);

// Resultado
console.log('====================================');
console.log('       RELATÓRIO DE AUDITORIA');
console.log('====================================\n');

console.log(`Arquivos escaneados: ${results.filesScanned}\n`);

console.log('📌 Arquivos que usam Quality Scores:');
results.filesUsingQualityScores.forEach(f => console.log(`   - ${f}`));

console.log('\n📌 Propriedades usadas em QualityScore:');
console.log([...results.qualityScoreProperties].sort().join(', ') || 'Nenhuma encontrada');

console.log('\n📌 Arquivos que usam KPIs / KPICard:');
results.filesUsingKPICard.forEach(f => console.log(`   - ${f}`));

console.log('\n📌 Propriedades usadas em KPICard:');
console.log([...results.kpiCardProperties].sort().join(', ') || 'Nenhuma encontrada');

console.log('\n====================================');
console.log('Fim do relatório');