import type { MetricProvenance } from "@/types/orbit";

/**
 * RN-23 (SSOT v1.5): linha única de proveniência exibida na tela —
 * fonte, período e método. `periodLabel` tem prioridade (ex.: datas do snapshot).
 */
export function provenanceLine(p: MetricProvenance): string {
  const periodo =
    p.periodLabel ??
    (p.period === "snapshot"
      ? "snapshot (não segue o cabeçalho)"
      : "janela do cabeçalho");
  return `Fonte: ${p.source} · Período: ${periodo} · Método: ${p.method}`;
}
