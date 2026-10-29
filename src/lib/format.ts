/* ==========================================================================
   ORBIT · lib/format.ts
   Formatação numérica pt-BR — fonte única.

   Extraído de contentContractEngine.ts (17/10/2026): a mesma lógica de
   decimal com vírgula estava duplicada — e divergente — em pelo menos
   KPICard.tsx, ClientCard.tsx, CampaignRow.tsx, FunnelChart.tsx e
   FunnelSimulator.tsx. Cada um chamava `.toFixed()` cru (ponto decimal,
   padrão en-US) ao lado de textos em pt-BR, e KPICard/ClientCard ainda
   grudavam um sufixo em inglês ("k", "M") por cima disso ("1.7k" ao lado
   de "7,454%" na mesma tela — ver Overview, card VPS vs. card Seguidores).

   Comportamento de formatPtBr() preservado 1:1 do original
   (toFixed + replace, sem separador de milhar) para não mudar a saída de
   nenhuma das ~36 chamadas já existentes em contentContractEngine.ts.
   ========================================================================== */

/** Número com vírgula decimal, padrão pt-BR. Ex.: formatPtBr(3, 1) -> "3,0" */
export function formatPtBr(value: number, decimals: number = 1): string {
  return value.toFixed(decimals).replace(".", ",");
}

/** Quantidade inteira com separador de milhar pt-BR. Ex.: 1745 -> "1.745" */
export function formatIntegerPtBr(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Número grande e compacto, em pt-BR. Substitui sufixos em inglês ("k", "M")
 * por "mil"/"mi" — nunca mistura "1.7k" com texto em português na mesma tela.
 * Ex.: formatCompactPtBr(1700) -> "1,7 mil"; formatCompactPtBr(3_000_000) -> "3,0 mi"
 */
export function formatCompactPtBr(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${formatPtBr(abs / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `${sign}${formatPtBr(abs / 1_000, 1)} mil`;
  return value.toLocaleString("pt-BR");
}
