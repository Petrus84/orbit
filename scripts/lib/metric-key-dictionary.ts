// ============================================================================
// ARQUIVO: lib/metric-key-dictionary.ts
// ============================================================================
// ✅ SSOT (Single Source of Truth) para variantes de encoding corrompido
//    (mojibake) nas chaves de `string_map_data` dos exports da Meta.
//
// PROBLEMA QUE ESTE ARQUIVO RESOLVE:
//   Os exports do Instagram/Meta às vezes vêm com chaves em UTF-8 correto
//   ("Contas alcançadas") e às vezes com mojibake ("Contas alcan\u00c3\u00a7adas"
//   — UTF-8 decodificado como Latin-1). Antes desta refatoração, cada script
//   de ingestão (ingest-insights.ts, extract-demographics.ts, ingest-l0-v2.ts)
//   mantinha sua PRÓPRIA lista de variantes, hardcoded e divergente entre si.
//
//   Consequência real: se um novo export trouxer uma variante que só está
//   na lista de UM dos três scripts, os outros dois não erram — eles
//   silenciosamente retornam 0 (ou null) pra aquela métrica, porque o padrão
//   "cascade de fallback → 0 no final" nunca lança exceção.
//
// SOLUÇÃO:
//   Toda variante conhecida vive AQUI, uma única vez, indexada por uma chave
//   canônica semântica (ex: REACH, LIKES_POST). Os 3 scripts importam
//   `resolveIntMetric` / `resolveStringMetric` e passam a chave canônica —
//   nunca mais uma string literal de chave bruta do JSON.
//
//   Adicionar uma nova variante de mojibake = editar UMA linha, UMA vez,
//   e os 3 scripts (e qualquer script futuro) passam a reconhecê-la.
//
// v1.6.0 — Adiciona EXTERNAL_LINK_TAPS. O campo "Toques em links externos"
//   existe em profiles_reached.json desde sempre, mas nunca teve entrada
//   canônica no dicionário — nenhum script tinha como lê-lo, mesmo o
//   ingest-insights.ts que abre esse arquivo pra extrair REACH. Como o rótulo
//   não tem caractere acentuado, não sofre mojibake; a variante em inglês é
//   mantida por simetria com o que aparece em posts_insights.json (nível de
//   post) e por segurança caso um export futuro venha localizado diferente.
// ============================================================================

/** Formato mínimo de uma entrada de string_map_data que este módulo consome. */
export interface MetricEntryLike {
  value?: string
}

export type StringMapLike = Record<string, MetricEntryLike | undefined>

// ── Dicionário canônico ─────────────────────────────────────────────────────
//
// Ordem das variantes dentro de cada array não importa para correção (todas
// são tentadas), mas por convenção mantemos: [UTF-8 correto, mojibake, inglês]
// para facilitar leitura/diff.

export const METRIC_KEYS = {
  // ── Interações de post ──────────────────────────────────────────────────
  SHARES_POST: ['Compartilhamento do post', 'Compartilhamento\u00c3\u00a3o do post'],
  SAVES_POST: ['Salvamentos do post', 'Salvamentos\u00c3 do post'],
  LIKES_POST: ['Curtidas do post', 'Curtidas\u00c3 do post'],

  // ── Interações de Reels ──────────────────────────────────────────────────
  SHARES_REELS: [
    'Compartilhamentos de vídeos do Reels',
    'Compartilhamentos\u00c3 de v\u00c3\u00addeos do Reels',
  ],
  SAVES_REELS: [
    'Salvamentos de vídeos do Reels',
    'Salvamentos\u00c3 de v\u00c3\u00addeos do Reels',
  ],
  LIKES_REELS: [
    'Curtidas em vídeos do Reels',
    'Curtidas\u00c3 em v\u00c3\u00addeos do Reels',
  ],
  COMMENTS_REELS: ['Comentários em reels', 'Coment\u00c3\u00a1rios em reels'],

  // ── Métricas por post individual (nível ig_posts, usadas no ingest-l0) ──
  // NOTA: antes desta refatoração, ingest-l0-v2.ts só reconhecia a variante
  // mojibake de REACH e nenhuma variante de fallback para as demais — por
  // isso essas listas são deliberadamente as mais completas do dicionário.
  REACH: ['Contas alcançadas', 'Contas alcan\u00c3\u00a7adas', 'Accounts reached'],
  IMPRESSIONS: ['Impressões', 'Impress\u00c3\u00b5es', 'Impressions'],
  COMMENTS: ['Comentários', 'Coment\u00c3\u00a1rios', 'Comments'],
  SHARES: ['Compartilhamentos', 'Compartilhamentos\u00c3', 'Shares'],
  SAVES: ['Salvamentos', 'Salvamentos\u00c3', 'Saves'],
  LIKES: ['Curtidas', 'Curtidas\u00c3', 'Likes'],
  PROFILE_VISITS_FROM: ['Visitas ao perfil', 'Visitas ao perfil\u00c3', 'Profile visits'],
  FOLLOWS_FROM_INTERACTION: ['Seguidores', 'Seguidores\u00c3', 'Followers'],

  // ── Cliques / CTA ────────────────────────────────────────────────────────
  // "Toques em links externos" — nível de conta, vem de profiles_reached.json.
  // Sem caractere acentuado, então não sofre mojibake; variante EN mantida
  // por segurança (é a grafia usada a nível de post em posts_insights.json).
  EXTERNAL_LINK_TAPS: ['Toques em links externos', 'External link taps'],

  // ── Seguidores / audiência (nível de conta) ─────────────────────────────
  FOLLOWERS: ['Seguidores', 'Seguidores\u00c3', 'Followers'],
  TOTAL_FOLLOWERS: [
    'Total de seguidores',
    'Total de seguidores\u00c3',
    'Total followers',
  ],

  // ── Demografia ───────────────────────────────────────────────────────────
  // NOTA: antes desta refatoração, extract-demographics.ts não tinha NENHUMA
  // variante de fallback para homens/mulheres/cidade — só a chave "ideal".
  // Adicionamos variantes plausíveis de mojibake por simetria com o resto
  // do dicionário; se o export real usar outra grafia, basta acrescentar
  // aqui.
  PCT_MALE: [
    'Porcentagem do total de seguidores para homens',
    'Porcentagem do total de seguidores para homens\u00c3',
  ],
  PCT_FEMALE: [
    'Porcentagem do total de seguidores para mulheres',
    'Porcentagem do total de seguidores para mulheres\u00c3',
  ],
  PCT_AGE_ALL_GENDERS: [
    'Porcentagem de seguidores por idade para todos os gêneros',
    'Porcentagem de seguidores por idade para todos os g\u00c3\u00aaneros',
  ],
  PCT_CITY: [
    'Porcentagem de seguidores por cidade',
    'Porcentagem de seguidores por cidade\u00c3',
  ],
  PCT_COUNTRY: [
    'Porcentagem de seguidores por país',
    'Porcentagem de seguidores por pa\u00c3\u00ad s',
    'Porcentagem de seguidores por paÃs' // ← INCLUÍDO: Casamento perfeito com o console!
  ],

  // ── Metadados diversos ───────────────────────────────────────────────────
  MEDIA_THUMBNAIL: ['Miniatura de mídia', 'Miniatura de m\u00c3\u00addia'],
  // Usado para achar o label_value que contém a mídia real do post (busca
  // por substring/igualdade, não leitura direta de mapa — ver ingest-l0-v2.ts)
  MEDIA_LABEL: ['mídia', 'm\u00c3\u00addia', 'midia'],
  USERNAME: ['Nome de usuário', 'Username'],
  DATE_RANGE: ['Intervalo de datas', 'Date range'],
} as const

export type MetricKeyName = keyof typeof METRIC_KEYS

// ── Resolvers genéricos ──────────────────────────────────────────────────────

/**
 * Resolve um valor numérico tentando, em cascata, todas as variantes de
 * encoding conhecidas para `keyName`. Retorna 0 se nenhuma variante existir
 * OU se o valor encontrado for literalmente "0" — mesmo comportamento que
 * os scripts originais já tinham, preservado aqui para não mudar semântica
 * de negócio, só centralizar a fonte das variantes.
 *
 * @param smd - string_map_data do arquivo Meta
 * @param keyName - chave CANÔNICA (não a string bruta do JSON)
 * @param onMiss - callback opcional de diagnóstico quando nenhuma variante bate
 */
export function resolveIntMetric(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): number {
  const variants = METRIC_KEYS[keyName]
  for (const key of variants) {
    const raw = smd[key]?.value
    if (raw !== undefined) {
      const cleaned = raw.replace(/[^0-9\-]/g, '')
      const parsed = parseInt(cleaned || '0', 10)
      if (parsed !== 0) return parsed
    }
  }
  onMiss?.(smd, keyName, variants)
  return 0
}

/**
 * Variante "nullable" de resolveIntMetric — usada onde a diferença entre
 * "métrica ausente" (null) e "métrica zerada" (0) importa para a lógica de
 * negócio (ex: decidir se uma linha inteira deve ser pulada).
 */
export function resolveIntMetricOrNull(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): number | null {
  const variants = METRIC_KEYS[keyName]
  for (const key of variants) {
    const raw = smd[key]?.value
    if (raw !== undefined) {
      const cleaned = raw.replace(/[^0-9\-]/g, '')
      return parseInt(cleaned || '0', 10)
    }
  }
  onMiss?.(smd, keyName, variants)
  return null
}

/**
 * Resolve um valor de string (ex: "34,5%") tentando todas as variantes.
 * Retorna '' se nenhuma variante existir.
 */
export function resolveStringMetric(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): string {
  const variants = METRIC_KEYS[keyName]
  for (const key of variants) {
    const entry = smd[key]
    if (entry?.value && entry.value.trim()) return entry.value
  }
  onMiss?.(smd, keyName, variants)
  return ''
}

/**
 * Resolve uma entrada de um mapa QUALQUER (não necessariamente
 * string_map_data) tentando as variantes de `keyName`. Útil para estruturas
 * como `media_map_data`, onde o valor não é `{ value: string }` e sim um
 * objeto com forma própria (ex: `{ uri, creation_timestamp }`).
 */
export function resolveMapEntry<T>(
  map: Record<string, T | undefined>,
  keyName: MetricKeyName
): T | undefined {
  const variants = METRIC_KEYS[keyName]
  for (const key of variants) {
    if (map[key] !== undefined) return map[key]
  }
  return undefined
}

/**
 * Retorna a lista de variantes cadastradas para uma chave canônica — usado
 * quando a lógica de correspondência não é uma simples leitura de mapa
 * (ex: procurar um `label` dentro de um array por substring/igualdade).
 */
export function variantsFor(keyName: MetricKeyName): readonly string[] {
  return METRIC_KEYS[keyName]
}

/**
 * Diagnóstico padrão: loga em console quando nenhuma variante de uma chave
 * canônica foi encontrada, junto com as primeiras chaves reais disponíveis
 * no objeto — útil pra descobrir rapidamente uma variante nova de mojibake
 * e adicioná-la aqui (em vez de reimplementá-la em algum script).
 */
export function logMissingKey(
  smd: StringMapLike,
  keyName: MetricKeyName,
  triedVariants: readonly string[]
): void {
  // Assinatura mantida idêntica à esperada por onMiss (smd, keyName, triedVariants)
  // em resolveIntMetric / resolveIntMetricOrNull / resolveStringMetric.
  console.warn(`   ⚠️  [metric-key-dictionary] Nenhuma variante encontrada para "${keyName}"`)
  console.warn(`      Tentativas: ${triedVariants.join(' | ')}`)
  console.warn(`      Chaves disponíveis no arquivo: ${Object.keys(smd).slice(0, 8).join(', ')}`)
}