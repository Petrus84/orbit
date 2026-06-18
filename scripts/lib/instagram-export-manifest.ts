/* ============================================================
   ORBIT · Instagram Export Manifest Resolver
   Arquivo: scripts/lib/instagram-export-manifest.ts
   ============================================================ */

import * as fs from 'fs'
import * as path from 'path'

export interface ManifestResolution {
  found: string[]
  missing: string[]
  source: 'instagram_export' | 'scraper' | 'unknown'
}

const MANIFEST_SPECS: Record<string, Record<string, string[]>> = {
  instagram_export: {
    'ingest-l0-v2': [
      'posts_1.json',
      'posts.json',
    ],
    'extract-demographics': [
      'audience_insights.json',           
      'personal_information.json',      
      'followers_1.json',                 
    ],
    'ingest-insights': [
      'content_interactions.json',      
      'profiles_reached.json',           
    ],
  },
  scraper: {
    'ingest-l0-v2': [
      'fio_data.json',
      'scraper_output.json',
    ],
  },
}

export function resolveManifest(
  folderPath: string,
  scriptName: string
): ManifestResolution {
  const found: string[] = []
  const missing: string[] = []
  let source: 'instagram_export' | 'scraper' | 'unknown' = 'unknown'

  if (fs.existsSync(path.join(folderPath, 'your_instagram_activity'))) {
    source = 'instagram_export'
  } else if (fs.existsSync(path.join(folderPath, 'fio_data.json'))) {
    source = 'scraper'
  }

  const specs = MANIFEST_SPECS[source]?.[scriptName] ?? []

  for (const spec of specs) {
    const fullPath = path.join(folderPath, spec)
    if (fs.existsSync(fullPath)) {
      found.push(spec)
    } else {
      missing.push(spec)
    }
  }

  return { found, missing, source }
}
