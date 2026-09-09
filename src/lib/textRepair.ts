// ============================================================================
// ORBIT · textRepair — utilitário compartilhado (extraído 09/09/2026)
//
// Origem: repairMojibakeCaption() vivia só dentro de
// instagramOverviewRepository.ts e só era chamada para `caption` de posts.
// Punch list item 5️⃣ mostrou que o mesmo problema (UTF-8 gravado/lido como
// Latin-1 em algum ponto do ingest, fora deste repo) também aparece em
// `top_cities[].name` (ig_audience_snapshots) e em `real_geo`
// (v_avatar_alignment) — então a função foi promovida a util compartilhado
// para não duplicar a lógica em cada repository que toca texto vindo do
// ingest.
//
// ⚠️ Isto é MITIGAÇÃO client-side, não o fix definitivo. A causa raiz é na
// ETL externa que grava as tabelas orbit.*_snapshots — a correção real é lá
// (adicionar .encode('utf-8')/.decode('utf-8') no ponto certo do pipeline).
// Esta função só resgata o que já está corrompido no banco, quando o
// padrão de bytes for reversível.
// ============================================================================

/**
 * Detecta e corrige mojibake clássico de UTF-8 lido como Latin-1
 * (ex.: "SÃ£o Paulo" → "São Paulo", "Critico" com Ã perdido etc.).
 * Se o texto não tiver o padrão de mojibake, ou se a correção falhar,
 * devolve o texto original sem alterar.
 */
export function repairMojibake(text: string | null): string | null {
  if (!text) return text
  if (!/Ã.|â€/.test(text)) return text
  try {
    const bytes = Uint8Array.from(Array.from(text, ch => ch.charCodeAt(0)))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return text
  }
}