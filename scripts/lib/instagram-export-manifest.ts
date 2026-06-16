import fs from 'fs';
import path from 'path';

// Definição rígida do contrato de cada arquivo baseado na arquitetura de dados
export interface FileSpec {
  fileName: string;
  required: boolean;
  targetTable: 'kpi_raw_ingestion' | 'kpi_snapshots' | 'clients';
  scriptOwner: 'ingest-l0-v2' | 'ingest-insights' | 'extract-demographics';
}

// Catálogo oficial de metadados dos 9 arquivos do ecossistema Orbit (Sprint 3)
const INSTAGRAM_FILE_SPECS: FileSpec[] = [
  { fileName: 'posts.json', required: true, targetTable: 'kpi_raw_ingestion', scriptOwner: 'ingest-l0-v2' },
  { fileName: 'posts_1.json', required: false, targetTable: 'kpi_raw_ingestion', scriptOwner: 'ingest-l0-v2' },
  { fileName: 'reels.json', required: false, targetTable: 'kpi_raw_ingestion', scriptOwner: 'ingest-l0-v2' },
  { fileName: 'content_interactions.json', required: true, targetTable: 'kpi_snapshots', scriptOwner: 'ingest-insights' },
  { fileName: 'profiles_reached.json', required: false, targetTable: 'kpi_snapshots', scriptOwner: 'ingest-insights' },
  { fileName: 'live_videos.json', required: false, targetTable: 'kpi_snapshots', scriptOwner: 'ingest-insights' },
  { fileName: 'audience_insights.json', required: true, targetTable: 'clients', scriptOwner: 'extract-demographics' },
  { fileName: 'followers_1.json', required: true, targetTable: 'kpi_snapshots', scriptOwner: 'extract-demographics' },
  { fileName: 'personal_information.json', required: true, targetTable: 'clients', scriptOwner: 'extract-demographics' }
];

export interface ManifestResolution {
  found: string[];
  missing: string[];
  specs: FileSpec[];
}

/**
 * Escaneia a pasta física do cliente e filtra quais arquivos pertencem ao script solicitante.
 * Bloqueia a execução imediatamente se um arquivo obrigatório (required: true) estiver ausente.
 */
export function resolveManifest(
  clientFolderPath: string,
  scriptName: 'ingest-l0-v2' | 'ingest-insights' | 'extract-demographics'
): ManifestResolution {
  const targetSpecs = INSTAGRAM_FILE_SPECS.filter(spec => spec.scriptOwner === scriptName);
  const found: string[] = [];
  const missing: string[] = [];

  for (const spec of targetSpecs) {
    const fullPath = path.join(clientFolderPath, spec.fileName);
    if (fs.existsSync(fullPath)) {
      found.push(spec.fileName);
    } else {
      missing.push(spec.fileName);
      
      // Regra 8 do Checklist: Bloqueia com exit(1) apenas se for obrigatório para o script
      if (spec.required) {
        console.error(`\n❌ [MANIFEST CRÍTICO] Arquivo obrigatório ausente: ${spec.fileName} em ${clientFolderPath}`);
        process.exit(1);
      }
    }
  }

  return { found, missing, specs: targetSpecs };
}
