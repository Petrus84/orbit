// ============================================================================
// tiers.ts Definição única (SSOT) de faixas de porte por seguidores.
//
// Extraído de ingest.ts e compute.ts os dois arquivos
// mantinham cópias IDÊNTICAS deste array. Hoje elas batem, mas divergiriam
// silenciosamente no dia em que alguém ajustasse um limiar em só um lugar 
// e o resultado seria lassificação de calibração e classificação de coleta
// usando limiares diferentes sem nenhum erro, warning ou log.
//
// Este módulo não tem nenhum código de execução (main, side-effects) 
// só tipos e funções puras. É seguro importar de qualquer lugar sem
// disparar scraping, leitura de arquivo, ou qualquer chamada de rede.
// ============================================================================

export interface FollowerTierDef {
  key: string
  label: string
  min: number
  max: number
}

// Limiares de partida  reavaliar conforme a base real crescer.
export const FOLLOWER_TIERS: FollowerTierDef[] = [
  { key: 'nano', label: 'nano/micro (<20k)', min: 0, max: 20_000 },
  { key: 'mid', label: 'mid (20k-60k)', min: 20_000, max: 60_000 },
  { key: 'macro', label: 'macro (60k-150k)', min: 60_000, max: 150_000 },
  { key: 'mega', label: 'mega (>150k)', min: 150_000, max: Infinity },
]

export function tierForFollowers(followers: number | null): FollowerTierDef | null {
  if (followers === null || followers < 0) return null
  return FOLLOWER_TIERS.find((t) => followers >= t.min && followers < t.max) ?? null
}

// ----------------------------------------------------------------------------
// normalizeHandle — SSOT para normalização de handle de Instagram.
//
// Motivo de existir: handles chegam de fontes diferentes com formatação
// diferente — nome de pasta no export oficial ("EuPetruchio84"), URL raspada
// via Apify ("https://www.instagram.com/eupetruchio84/"), chave manual em
// REAL_FOLLOWER_COUNTS (compute.ts) digitada por humano. Sem uma função
// única de normalização, um mesmo handle digitado com capitalização ou
// espaço diferente em dois lugares vira "duas contas" para o resto do
// pipeline, com nenhum erro nem warning — só uma calibração ou lookup que
// silenciosamente não bate. Todo ponto do código que compara ou indexa por
// handle (parseL0Account, REAL_FOLLOWER_COUNTS, lookup de contas L1) deve
// passar por aqui antes de comparar.
// ----------------------------------------------------------------------------
export function normalizeHandle(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '')
    .replace(/\/.*$/, '') // corta qualquer coisa depois de uma segunda barra (ex.: query string residual)
}