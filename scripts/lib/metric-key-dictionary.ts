/* =============================================================================
   ARQUIVO: lib/metric-key-dictionary.ts
   ============================================================================
   ✅ SSOT (Single Source of Truth) para variantes de encoding corrompido
      (mojibake) nas chaves de `string_map_data` dos exports da Meta.

   [... cabeçalho original preservado — ver histórico de versões anteriores ...]

   v1.7.0 — Adiciona REACH_FROM_FOLLOWERS_PCT e REACH_FROM_NON_FOLLOWERS_PCT.
     Confirmado em profiles_reached.json real (organic_insights_reach):
       "Seguidores": "61.2%"       ← % do alcance que veio de seguidores
       "Não seguidores": "38.8%"   ← complementar, soma ~100%

     ⚠️  ARMADILHA DE NOME — LEIA ANTES DE MEXER:
     A chave literal "Seguidores" JÁ EXISTE no dicionário como variante de
     FOLLOWERS (audience_insights.json), onde significa CONTAGEM ABSOLUTA de
     seguidores (ex: "1785"). Em profiles_reached.json, a MESMA string
     "Seguidores" aparece com um significado totalmente diferente: um
     PERCENTUAL de origem do alcance (ex: "61.2%"). São arquivos diferentes,
     semânticas diferentes, mesma grafia de rótulo.
     NUNCA reaproveite a lista de variantes de FOLLOWERS para ler este campo,
     e vice-versa — por isso REACH_FROM_FOLLOWERS_PCT tem sua própria entrada
     isolada, mesmo repetindo a string "Seguidores" no array de variantes.

     Também confirmado neste mesmo arquivo: percentuais aqui vêm com PONTO
     decimal ("61.2%", estilo EN-US), enquanto audience_insights.json usa
     VÍRGULA decimal ("34,5%", estilo PT-BR) — a Meta mistura formatação
     dentro do mesmo pacote de export. Por isso resolvePercentMetric() (novo
     nesta versão) lida com os dois formatos, em vez de assumir um só.

   v1.8.0 — Duas correções encontradas em teste real com 2 exports distintos
     (cpimportstore, eupetruchio84) via ingest-from-zip.ts v2.0.0:

     1. BUG REAL: COMMENTS_POST não existia como chave canônica. O cálculo de
        totalComments em ingest-from-zip.ts sempre foi só commReels (Reels),
        nunca incluía comentários de post estático/carrossel — herdado sem
        revisão do ingest-insights.ts original. Confirmado em export real:
        a chave "Comentários do post" existe e nunca era lida. Provavelmente
        'comentarios-90d' estava zerado/subestimado para todo cliente desde
        sempre.

     2. Todos os resolvers agora comparam chaves normalizadas (NFC) em vez de
        comparação direta smd[key]. Confirmado em export real: a chave real
        "Porcentagem de seguidores por paÃs" é BYTE-A-BYTE idêntica à
        terceira variante já cadastrada em PCT_COUNTRY, mas ainda assim não
        batia — sintoma clássico de normalização Unicode diferente (NFC vs
        NFD) entre a string literal do código-fonte e a string do JSON lido
        em runtime. Normalizar os dois lados antes de comparar corrige esse
        caso e protege contra a mesma classe de problema em qualquer chave
        futura, sem precisar adivinhar a variante exata de bytes.

   v1.9.0 — Variantes de mojibake completadas com base em validação real
     (eupetruchio84, 30/08/2026):

     1. SHARES_REELS, SAVES_REELS, LIKES_REELS: adicionadas variantes com
        mojibake "Ã" (A com til) além de "\u00c3" (ã em UTF-8 escapado).
        Confirmado em export real que ambas as variantes aparecem em diferentes
        clientes.

     2. PCT_COUNTRY: adicionada variante com espaço antes de "s"
        ("Porcentagem de seguidores por paÃ s") que aparece em alguns exports.
        Confirmado em eupetruchio84 que a chave vem com espaço não-intuitivo.

   ============================================================================ */

/** Formato mínimo de uma entrada de string_map_data que este módulo consome. */
export interface MetricEntryLike {
  value?: string | undefined
}

export type StringMapLike = Record<string, MetricEntryLike | undefined>

/** Normaliza uma chave para comparação robusta a NFC/NFD. */
function normalizeKey(s: string): string {
  return s.normalize('NFC')
}

/** Constrói um mapa com chaves normalizadas, preservando o valor original. */
function buildNormalizedLookup(smd: StringMapLike): Map<string, MetricEntryLike | undefined> {
  const map = new Map<string, MetricEntryLike | undefined>()
  for (const [k, v] of Object.entries(smd)) {
    map.set(normalizeKey(k), v)
  }
  return map
}

/* ── Dicionário canônico ────────────────────────────────────────────────────── */

export const METRIC_KEYS = {
  // ── Interações de post ──────────────────────────────────────────────────
  SHARES_POST: ['Compartilhamento do post', 'Compartilhamento\u00c3\u00a3o do post'],
  SAVES_POST: ['Salvamentos do post', 'Salvamentos\u00c3 do post'],
  LIKES_POST: ['Curtidas do post', 'Curtidas\u00c3 do post'],
  // v1.8.0 — NOVO. Confirmado em export real (eupetruchio84, 29/08/2026):
  // chave existe e nunca tinha sido lida por nenhum script anterior.
  COMMENTS_POST: ['Comentários do post', 'Coment\u00c3\u00a1rios do post'],

  // ── Interações de Reels ──────────────────────────────────────────────────
  // v1.9.0 — Variantes de mojibake completadas com "Ã" (A com til)
  SHARES_REELS: [
    'Compartilhamentos de vídeos do Reels',
    'CompartilhamentosÃ de vÃdeos do Reels',
    'Compartilhamentos\u00c3 de v\u00c3\u00addeos do Reels',
  ],
  SAVES_REELS: [
    'Salvamentos de vídeos do Reels',
    'SalvamentosÃ de vÃdeos do Reels',
    'Salvamentos\u00c3 de v\u00c3\u00addeos do Reels',
  ],
  LIKES_REELS: [
    'Curtidas em vídeos do Reels',
    'CurtidasÃ em vÃdeos do Reels',
    'Curtidas\u00c3 em v\u00c3\u00addeos do Reels',
  ],
  COMMENTS_REELS: ['Comentários em reels', 'Coment\u00c3\u00a1rios em reels'],

  // ── Métricas por post individual (nível ig_posts, usadas no ingest-l0) ──
  REACH: ['Contas alcançadas', 'Contas alcan\u00c3\u00a7adas', 'Accounts reached'],
  IMPRESSIONS: ['Impressões', 'Impress\u00c3\u00b5es', 'Impressions'],
  COMMENTS: ['Comentários', 'Coment\u00c3\u00a1rios', 'Comments'],
  SHARES: ['Compartilhamentos', 'Compartilhamentos\u00c3', 'Shares'],
  SAVES: ['Salvamentos', 'Salvamentos\u00c3', 'Saves'],
  LIKES: ['Curtidas', 'Curtidas\u00c3', 'Likes'],
  PROFILE_VISITS_FROM: ['Visitas ao perfil', 'Visitas ao perfil\u00c3', 'Profile visits'],
  FOLLOWS_FROM_INTERACTION: ['Seguidores', 'Seguidores\u00c3', 'Followers'],

  // ── Cliques / CTA ────────────────────────────────────────────────────────
  EXTERNAL_LINK_TAPS: ['Toques em links externos', 'External link taps'],

  // ── Seguidores / audiência (nível de conta, vem de audience_insights.json) ──
  FOLLOWERS: ['Seguidores', 'Seguidores\u00c3', 'Followers'],
  TOTAL_FOLLOWERS: [
    'Total de seguidores',
    'Total de seguidores\u00c3',
    'Total followers',
  ],

  // ── Composição do alcance (nível de conta, vem de profiles_reached.json) ──
  // v1.7.0. ⚠️ Repete a string "Seguidores" de propósito — ver aviso de
  // colisão no cabeçalho do arquivo. NUNCA usar FOLLOWERS aqui nem vice-versa.
  // Confirmado em export real: valor vem como percentual com PONTO decimal
  // ("61.2%"), diferente da vírgula usada em audience_insights.json — use
  // resolvePercentMetric(), não resolveIntMetric(), para ler este campo.
  REACH_FROM_FOLLOWERS_PCT: ['Seguidores'],
  REACH_FROM_NON_FOLLOWERS_PCT: ['Não seguidores', 'N\u00c3\u00a3o seguidores'],

  // ── Demografia ───────────────────────────────────────────────────────────
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
  // v1.9.0 — Variantes de PCT_COUNTRY completadas com espaço antes de "s"
  PCT_COUNTRY: [
    'Porcentagem de seguidores por país',
    'Porcentagem de seguidores por paÃs',
    'Porcentagem de seguidores por paÃ s',
    'Porcentagem de seguidores por pa\u00c3\u00ad s',
  ],

  // ── Metadados diversos ───────────────────────────────────────────────────
  MEDIA_THUMBNAIL: ['Miniatura de mídia', 'Miniatura de m\u00c3\u00addia'],
  MEDIA_LABEL: ['mídia', 'm\u00c3\u00addia', 'midia'],
  USERNAME: ['Nome de usuário', 'Username'],
  DATE_RANGE: ['Intervalo de datas', 'Date range'],
} as const

export type MetricKeyName = keyof typeof METRIC_KEYS

/* ── Resolvers genéricos ────────────────────────────────────────────────────── */

export function resolveIntMetric(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): number {
  const variants = METRIC_KEYS[keyName]
  const lookup = buildNormalizedLookup(smd)
  for (const key of variants) {
    const raw = lookup.get(normalizeKey(key))?.value
    if (raw !== undefined) {
      const cleaned = raw.replace(/[^0-9\-]/g, '')
      const parsed = parseInt(cleaned || '0', 10)
      if (parsed !== 0) return parsed
    }
  }
  onMiss?.(smd, keyName, variants)
  return 0
}

export function resolveIntMetricOrNull(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): number | null {
  const variants = METRIC_KEYS[keyName]
  const lookup = buildNormalizedLookup(smd)
  for (const key of variants) {
    const raw = lookup.get(normalizeKey(key))?.value
    if (raw !== undefined) {
      const cleaned = raw.replace(/[^0-9\-]/g, '')
      return parseInt(cleaned || '0', 10)
    }
  }
  onMiss?.(smd, keyName, variants)
  return null
}

export function resolveStringMetric(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): string {
  const variants = METRIC_KEYS[keyName]
  const lookup = buildNormalizedLookup(smd)
  for (const key of variants) {
    const entry = lookup.get(normalizeKey(key))
    if (entry?.value && entry.value.trim()) return entry.value
  }
  onMiss?.(smd, keyName, variants)
  return ''
}

/**
 * ✅ NOVO v1.7.0 — Resolve um percentual (ex: "61.2%", "34,5%", "-46.8%")
 * tentando todas as variantes de `keyName`, com parsing tolerante a locale:
 * aceita PONTO ou VÍRGULA como separador decimal, sinal negativo opcional,
 * e o símbolo "%" opcional (alguns campos de delta vêm sem "%").
 *
 * Regra de decisão do separador decimal:
 * - Se a string tem vírgula e NÃO tem ponto → vírgula é o decimal (PT-BR).
 * - Caso contrário (tem ponto, ou não tem nenhum dos dois) → usa como está.
 * Isso cobre os dois formatos confirmados em exports reais da Meta:
 * "61.2%" (profiles_reached.json) e "34,5%" (audience_insights.json), sem
 * assumir que o export inteiro segue um único locale.
 *
 * Retorna null (não 0) quando a chave não é encontrada — a ausência de um
 * percentual de composição de alcance é uma informação diferente de "0%".
 */
export function resolvePercentMetric(
  smd: StringMapLike,
  keyName: MetricKeyName,
  onMiss?: (smd: StringMapLike, keyName: MetricKeyName, triedVariants: readonly string[]) => void
): number | null {
  const raw = resolveStringMetric(smd, keyName, onMiss)
  if (!raw) return null

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  const normalized = hasComma && !hasDot ? raw.replace(',', '.') : raw

  const match = normalized.match(/-?\d+(\.\d+)?/)
  if (!match) return null

  const value = parseFloat(match[0])
  return Number.isNaN(value) ? null : value
}

export function resolveMapEntry<T>(
  map: Record<string, T | undefined>,
  keyName: MetricKeyName
): T | undefined {
  const variants = METRIC_KEYS[keyName]
  const normalizedMap = new Map<string, T | undefined>()
  for (const [k, v] of Object.entries(map)) normalizedMap.set(normalizeKey(k), v)
  for (const key of variants) {
    const hit = normalizedMap.get(normalizeKey(key))
    if (hit !== undefined) return hit
  }
  return undefined
}

export function variantsFor(keyName: MetricKeyName): readonly string[] {
  return METRIC_KEYS[keyName]
}

export function logMissingKey(
  smd: StringMapLike,
  keyName: MetricKeyName,
  triedVariants: readonly string[]
): void {
  console.warn(`   ⚠️  [metric-key-dictionary] Nenhuma variante encontrada para "${keyName}"`)
  console.warn(`      Tentativas: ${triedVariants.join(' | ')}`)
  console.warn(`      Chaves disponíveis no arquivo: ${Object.keys(smd).slice(0, 8).join(', ')}`)
}
