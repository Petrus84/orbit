/**
 * Faixas de tamanho de amostra (SSOT Unificado v2.0, R8).
 *   n < 3   → insuficiente
 *   3 a 7   → leve
 *   n >= 8  → robusta
 * Módulo puro. Entrada inválida (NaN, ±Infinity, negativo, não inteiro) é
 * "insuficiente": uma contagem de posts é inteira, e nunca se promove uma
 * amostra por falta de dado.
 */
export type SampleBand = "insuficiente" | "leve" | "robusta";

export const SAMPLE_MIN_LEVE = 3;
export const SAMPLE_MIN_ROBUSTA = 8;

export function sampleBand(n: number): SampleBand {
  if (!Number.isInteger(n) || n < SAMPLE_MIN_LEVE) return "insuficiente";
  if (n < SAMPLE_MIN_ROBUSTA) return "leve";
  return "robusta";
}
