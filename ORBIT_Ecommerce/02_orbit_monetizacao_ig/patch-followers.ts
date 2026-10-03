import * as fs from 'fs';
import * as path from 'path';

const NICHE_DIR = path.join(__dirname, '..', '03_niche_scraper');
const BENCHMARK_DIR = path.join(__dirname, 'data', 'benchmark');
const MANIFEST_PATH = path.join(BENCHMARK_DIR, 'manifest.json');

console.log("🚀 Iniciando injeção de seguidores de nicho no manifesto...");

// 1. Mapear usernames para followerCount a partir da pasta secreta
const followerMap: Record<string, number> = {};

if (fs.existsSync(NICHE_DIR)) {
  const files = fs.readdirSync(NICHE_DIR).filter(f => f.endsWith('.json'));
  files.forEach(file => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(NICHE_DIR, file), 'utf-8'));
      const records = Array.isArray(content) ? content : [content];
      records.forEach((rec: any) => {
        if (rec && rec.username) {
          // Captura a chave 'followerCount' do arquivo original
          const count = rec.followerCount || rec.followersCount;
          if (count) {
            followerMap[rec.username.toLowerCase()] = count;
          }
        }
      });
    } catch (e) {
      // Ignora falhas de leitura de arquivos corrompidos
    }
  });
}

console.log(`📊 Mapeados ${Object.keys(followerMap).length} perfis com seguidores reais.`);

// 2. Corrigir o manifest.json injetando a propriedade correta no plural
if (fs.existsSync(MANIFEST_PATH)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    let alterados = 0;

    manifest.forEach((account: any) => {
      const handle = account.handle || account.username;
      if (handle) {
        const key = handle.toLowerCase();
        if (followerMap[key]) {
          // Injeta exatamente o que o compute.ts exige (no plural com S)
          account.followersCount = followerMap[key];
          account.followers = followerMap[key]; // Backup contra variações de tipo
          alterados++;
        }
      }
    });

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`✅ Sucesso! Injetados seguidores em ${alterados} contas no manifest.json.`);
  } catch (err) {
    console.error("❌ Erro ao processar o arquivo manifest.json:", err);
  }
} else {
  console.log("⚠️ Arquivo data/benchmark/manifest.json não encontrado. Criando um esqueleto de teste...");
  fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
  const mockManifest = Object.keys(followerMap).map(user => ({
    handle: user,
    username: user,
    followersCount: followerMap[user],
    validPostsCount: 30
  }));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(mockManifest, null, 2), 'utf-8');
  console.log("✨ Novo manifest.json gerado a partir do niche_scraper!");
}
