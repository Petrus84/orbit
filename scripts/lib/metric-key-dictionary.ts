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

   v2.2.0 — Diagnóstico definitivo dos warnings restantes (dogativo +
     mauricioartphoto, logs reais de ingest-from-zip.ts v2.1.0, 15/09/2026).

     CONCLUSÃO PRINCIPAL: os warnings que sobraram não são mais problema de
     variante de encoding — já foram todos resolvidos nas versões anteriores.
     O que resta é ausência ESTRUTURAL: dois formatos de content_interactions.json
     completamente diferentes, confirmados em contas distintas:

     • Schema "agregado por post" (dogativo) — 8 chaves, sem quebra por
       Reels: Curtidas do post, Comentários do post, Compartilhamento do
       post, Salvamentos do post, Impressões (total), Visitas ao perfil,
       Cliques em links. SHARES_REELS/SAVES_REELS/LIKES_REELS/COMMENTS_REELS
       NUNCA vão existir aqui — não há granularidade por tipo de mídia.

     • Schema "totais com versão delta" (mauricioartphoto, eupetruchio84) —
       chaves diferentes, sem Impressões/Visitas ao perfil/Cliques em links
       neste arquivo (esses valores vêm de outro arquivo do export, ex.
       profiles_reached.json — por isso "impressões=5336" aparece correto
       no resumo do script mesmo com o warning de IMPRESSIONS neste arquivo).

     Nenhuma variante nova resolveria esses warnings porque a chave
     simplesmente não existe no arquivo — inventar uma variante aqui seria
     fabricação, o que este dicionário explicitamente não faz (ver nota em
     SAVES_REELS abaixo, já existente desde v2.0.0).

     FIX: em vez de forçar silêncio ou inventar chave, adicionado
     `KNOWN_SCHEMA_GAPS` (detecção por fingerprint de chaves já confirmadas
     em export real) para que `logMissingKey()` rebaixe esses casos
     conhecidos de "⚠️ warning" para "ℹ️ info" — sinalizando claramente que
     é ausência esperada, sem esconder o log e sem gerar ruído de alarme
     falso a cada ingest. Um miss que NÃO bate com nenhum schema conhecido
     continua gerando o warning completo de sempre.

     Também adicionado `fileDeclaresNoGenderData()`: quando o próprio export
     declara no campo "Observação" que não há dado de gênero para a conta
     (caso confirmado do dogativo, já documentado abaixo desde v2.1.0), o
     warning de PCT_MALE/PCT_FEMALE também é rebaixado para info — usando o
     texto que a própria Meta escreveu no arquivo como sinal, não uma
     suposição nossa.

     NÃO ALTERADO DE PROPÓSITO: PCT_CITY e PCT_COUNTRY continuam como
     warning completo. Ainda não há evidência real suficiente (em nenhum
     export confirmado) de que a ausência dessas duas chaves seja sempre
     estrutural — pode ser um schema de demografia sem quebra geográfica
     (como no dogativo) ou pode ser um miss de verdade em outra conta.
     Melhor manter o alarme até termos um segundo export confirmando o
     padrão, do que arriscar esconder um bug real.

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
  // v2.0.0 — NOVO: variantes pt-PT (Portugal). Confirmadas em export real
  // (mauricioartphoto, 13/09/2026) — rótulos completamente diferentes dos
  // pt-BR, não é só mojibake. "Pub. guardada" não tem acento, então uma
  // única forma já cobre o caso; as demais têm forma mojibake própria
  // porque o export tem o mesmo bug de encoding do pt-BR.
  SHARES_POST: [
    'Compartilhamento do post', 'Compartilhamento\u00c3\u00a3o do post',
    'Partilhas de publicações', 'PartilhasÃ de publicaÃ§Ãµes', 'Partilhas de publica\u00c3\u00a7\u00c3\u00b5es',
  ],
  SAVES_POST: [
    'Salvamentos do post', 'Salvamentos\u00c3 do post',
    'Pub. guardada',
  ],
  LIKES_POST: [
    'Curtidas do post', 'Curtidas\u00c3 do post',
    'Gostos em publicações', 'Gostos em publica\u00c3\u00a7\u00c3\u00b5es',
  ],
  // v1.8.0 — NOVO. Confirmado em export real (eupetruchio84, 29/08/2026):
  // chave existe e nunca tinha sido lida por nenhum script anterior.
  COMMENTS_POST: [
    'Comentários do post', 'Coment\u00c3\u00a1rios do post',
    'Comentários em publicações', 'Coment\u00c3\u00a1rios em publica\u00c3\u00a7\u00c3\u00b5es',
  ],

  // ── Interações de Reels ──────────────────────────────────────────────────
  // v1.9.0 — Variantes de mojibake completadas com "Ã" (A com til)
  // v2.0.0 — NOVO: variantes pt-PT confirmadas (mauricioartphoto, 13/09/2026).
  SHARES_REELS: [
    'Compartilhamentos de vídeos do Reels',
    'CompartilhamentosÃ de vÃdeos do Reels',
    'Compartilhamentos\u00c3 de v\u00c3\u00addeos do Reels',
    'Partilhas de reels',
  ],
  // ⚠️ SAVES_REELS: nenhuma variante pt-PT encontrada — este export
  // (mauricioartphoto) simplesmente não tem um campo de "salvamentos de
  // reels" separado. Não inventar uma chave aqui; fica 0 de propósito.
  SAVES_REELS: [
    'Salvamentos de vídeos do Reels',
    'SalvamentosÃ de vÃdeos do Reels',
    'Salvamentos\u00c3 de v\u00c3\u00addeos do Reels',
  ],
  LIKES_REELS: [
    'Curtidas em vídeos do Reels',
    'CurtidasÃ em vÃdeos do Reels',
    'Curtidas\u00c3 em v\u00c3\u00addeos do Reels',
    'Gostos nos reels',
  ],
  COMMENTS_REELS: [
    'Comentários em reels', 'Coment\u00c3\u00a1rios em reels',
    'Comentários nos reels', 'Coment\u00c3\u00a1rios nos reels',
  ],

  // ── Métricas por post individual (nível ig_posts, usadas no ingest-l0) ──
  REACH: ['Contas alcançadas', 'Contas alcan\u00c3\u00a7adas', 'Accounts reached'],
  IMPRESSIONS: [
    'Impressões', 'Impress\u00c3\u00b5es', 'Impressions',
    'Impressões (total)', 'Impress\u00c3\u00b5es (total)', // NOVO — confirmado (dogativo, 13/09/2026)
  ],
  COMMENTS: ['Comentários', 'Coment\u00c3\u00a1rios', 'Comments'],
  SHARES: ['Compartilhamentos', 'Compartilhamentos\u00c3', 'Shares'],
  SAVES: ['Salvamentos', 'Salvamentos\u00c3', 'Saves'],
  LIKES: ['Curtidas', 'Curtidas\u00c3', 'Likes'],
  PROFILE_VISITS_FROM: ['Visitas ao perfil', 'Visitas ao perfil\u00c3', 'Profile visits'],
  FOLLOWS_FROM_INTERACTION: ['Seguidores', 'Seguidores\u00c3', 'Followers'],

  // ── Cliques / CTA ────────────────────────────────────────────────────────
  // v2.0.0 — NOVO pt-PT (mauricioartphoto, 13/09/2026): "ligações" em vez
  // de "links".
  EXTERNAL_LINK_TAPS: [
    'Toques em links externos', 'External link taps',
    'Toques em ligações externas', 'Toques em liga\u00c3\u00a7\u00c3\u00b5es externas',
    'Cliques em links', // NOVO — confirmado (dogativo, 13/09/2026)
  ],

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
  // v2.0.0 — NOVO pt-PT (mauricioartphoto, 13/09/2026): confirmado por log
  // real do script — "Percentagem" em vez de "Porcentagem" (ortografia
  // europeia), e frases com ordem de palavras diferente para gênero.
  // ⚠️  AUSÊNCIA DE DADOS DE GÊNERO — leia antes de adicionar variantes aqui:
  // O Instagram NÃO expõe dados de gênero para todas as contas. Quando os
  // dados não estão disponíveis, o ZIP simplesmente não contém nenhuma das
  // chaves abaixo — não há chave com valor vazio, a chave simplesmente não
  // existe. Confirmado: Dogativo (13/09/2026) — o audience_insights.json
  // não tem nenhuma entrada de gênero; o campo "Observação" do arquivo afirma
  // explicitamente "Nenhum dado de gênero [...] está disponível para esta conta".
  // O ingest-from-zip.ts trata a ausência gravando NULL nos três campos de
  // gênero — NÃO zero. Se você ver gender_other_pct = 100 no banco, é uma
  // versão anterior do ingest (bug corrigido em v2.1.0).
  //
  // v2.1.0 — NOVO: variantes para gênero INFERIDO pelo Instagram.
  // Algumas contas recebem dados de gênero marcados como "inferidos"
  // (ex: "Os dados de sexo são inferidos") em vez das chaves diretas de
  // porcentagem. Neste caso, o Instagram exibe os percentuais dentro do
  // mesmo bloco com sub-chaves diferentes. Adicionadas abaixo as variantes
  // confirmadas (dogativo-corrigido, estrutura observada via UI do Instagram
  // em 15/09/2026: "Masculino 94.2% Feminino 2.4% Não especificado 3.4%").
  // Nota: esses dados de gênero inferido EXISTEM na UI do Instagram mas
  // NÃO aparecem no ZIP de exportação desta conta — o ZIP do Dogativo não
  // tem as chaves abaixo. As variantes ficam registradas aqui para o caso
  // de exports futuros incluírem esses campos.
  PCT_MALE: [
    'Porcentagem do total de seguidores para homens',
    'Porcentagem do total de seguidores para homens\u00c3',
    'Percentagem total de seguidores que são homens',
    'Percentagem total de seguidores que s\u00c3\u00a3o homens',
    // Gênero inferido — variantes observadas em UI (podem aparecer em ZIPs futuros)
    'Masculino',
    'Homens',
  ],
  PCT_FEMALE: [
    'Porcentagem do total de seguidores para mulheres',
    'Porcentagem do total de seguidores para mulheres\u00c3',
    'Percentagem total de seguidores para mulheres',
    // Gênero inferido — variantes observadas em UI (podem aparecer em ZIPs futuros)
    'Feminino',
    'Mulheres',
  ],
  PCT_AGE_ALL_GENDERS: [
    'Porcentagem de seguidores por idade para todos os gêneros',
    'Porcentagem de seguidores por idade para todos os g\u00c3\u00aaneros',
    'Percentagem de seguidores por idade para todos os géneros',
    'Percentagem de seguidores por idade para todos os g\u00c3\u00a9neros',
  ],
  PCT_CITY: [
    'Porcentagem de seguidores por cidade',
    'Porcentagem de seguidores por cidade\u00c3',
    'Percentagem de seguidores por cidade',
  ],
  // v1.9.0 — Variantes de PCT_COUNTRY completadas com espaço antes de "s"
  // v2.0.0 — NOVO pt-PT: "Percentagem" em vez de "Porcentagem".
  PCT_COUNTRY: [
    'Porcentagem de seguidores por país',
    'Porcentagem de seguidores por paÃs',
    'Porcentagem de seguidores por paÃ s',
    'Porcentagem de seguidores por pa\u00c3\u00ad s',
    'Percentagem de seguidores por país',
    'Percentagem de seguidores por pa\u00c3\u00ads',
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

/* ── v2.2.0 — Gaps estruturais conhecidos ──────────────────────────────────────
   Ver changelog no cabeçalho do arquivo para o diagnóstico completo por trás
   de cada entrada abaixo. Cada `fingerprintKeys` é uma chave (ou variante de
   mojibake dela) confirmada em export real como pertencente àquele schema —
   nunca uma suposição. Se nenhum fingerprint bater, o comportamento antigo
   (warning completo) se mantém — isso é o padrão seguro. */

interface KnownSchemaGap {
  /** Só para leitura humana no log de debug — não afeta a lógica. */
  label: string
  /** Se qualquer uma destas chaves existir no arquivo, este schema está ativo. */
  fingerprintKeys: readonly string[]
  /** Métricas cuja ausência é esperada e conhecida para este schema. */
  expectedAbsent: readonly MetricKeyName[]
}

const KNOWN_SCHEMA_GAPS: readonly KnownSchemaGap[] = [
  {
    // Confirmado: dogativo, 15/09/2026 — content_interactions.json com
    // 8 chaves, sem quebra por tipo de mídia (Reels/Carrossel/Estático).
    label: 'agregado por post, sem quebra por Reels (dogativo)',
    fingerprintKeys: ['Salvamentos do post', 'Salvamentos\u00c3 do post'],
    expectedAbsent: ['SHARES_REELS', 'SAVES_REELS', 'LIKES_REELS', 'COMMENTS_REELS'],
  },
  {
    // Confirmado: mauricioartphoto / eupetruchio84, 15/09/2026 —
    // content_interactions.json "totais com versão delta". Impressões,
    // Visitas ao perfil e Cliques em links não existem neste arquivo —
    // vêm de outro arquivo do export (ex. profiles_reached.json).
    label: 'totais com versão delta (mauricioartphoto / eupetruchio84)',
    fingerprintKeys: ['Interações com conteúdos', 'InteraÃ§Ãµes com conteÃºdos'],
    expectedAbsent: [
      'IMPRESSIONS',
      'PROFILE_VISITS_FROM',
      'EXTERNAL_LINK_TAPS',
      'SHARES_REELS',
      'SAVES_REELS',
      'LIKES_REELS',
      'COMMENTS_REELS',
    ],
  },
]

function detectActiveSchemaGaps(smd: StringMapLike): readonly KnownSchemaGap[] {
  const availableKeys = new Set(Object.keys(smd).map(normalizeKey))
  return KNOWN_SCHEMA_GAPS.filter((gap) =>
    gap.fingerprintKeys.some((fp) => availableKeys.has(normalizeKey(fp)))
  )
}

/**
 * Verifica se o próprio export declara, no campo "Observação" do
 * audience_insights.json, que não há dado de gênero disponível para a
 * conta (caso confirmado: dogativo — ver comentário em PCT_MALE/PCT_FEMALE
 * abaixo, documentado desde v2.1.0). Sinal robusto porque usa o texto que
 * a própria Meta escreveu no arquivo, não uma suposição nossa — por isso,
 * se o texto não for reconhecido, a função retorna false e o warning
 * comum continua disparando (falha para o lado seguro).
 */
function fileDeclaresNoGenderData(smd: StringMapLike): boolean {
  const lookup = buildNormalizedLookup(smd)
  const nota = (
    lookup.get(normalizeKey('Observação'))?.value ??
    lookup.get(normalizeKey('Observa\u00c3\u00a7\u00c3\u00a3o'))?.value ??
    ''
  )
    .normalize('NFC')
    .toLowerCase()
  if (!nota) return false
  const mencionaGenero = nota.includes('gênero') || nota.includes('sexo')
  const mencionaAusencia =
    nota.includes('nenhum') || nota.includes('não está disponível') || nota.includes('não disponível')
  return mencionaGenero && mencionaAusencia
}

export function logMissingKey(
  smd: StringMapLike,
  keyName: MetricKeyName,
  triedVariants: readonly string[]
): void {
  const activeGaps = detectActiveSchemaGaps(smd)
  const schemaGap = activeGaps.find((gap) => gap.expectedAbsent.includes(keyName))
  if (schemaGap) {
    console.info(
      `   ℹ️  [metric-key-dictionary] "${keyName}" ausente — esperado, schema "${schemaGap.label}" não tem esta métrica (não é bug)`
    )
    return
  }

  if ((keyName === 'PCT_MALE' || keyName === 'PCT_FEMALE') && fileDeclaresNoGenderData(smd)) {
    console.info(
      `   ℹ️  [metric-key-dictionary] "${keyName}" ausente — o export declara (campo "Observação") que não há dado de gênero para esta conta (não é bug)`
    )
    return
  }

  console.warn(`   ⚠️  [metric-key-dictionary] Nenhuma variante encontrada para "${keyName}"`)
  console.warn(`      Tentativas: ${triedVariants.join(' | ')}`)
  console.warn(`      Chaves disponíveis no arquivo: ${Object.keys(smd).slice(0, 8).join(', ')}`)
}