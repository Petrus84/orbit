/**
 * Leitura do painel de Audiência: compara o público real com o público que o
 * cliente definiu no cadastro e responde em linguagem de cliente, com um
 * próximo passo. Sem "meta", "realizado", "esperado" ou "gap": o cliente não
 * definiu meta nenhuma, ele descreveu quem quer atingir.
 */
import { formatPtBr } from "@/lib/format";

/** Até quantos pontos de distância ainda é "perto" do público definido. */
export const PUBLICO_PERTO_ATE_PONTOS = 10;

export type GapStatus = "positive" | "attention";

export interface GapReading {
  status: GapStatus;
  headline: string;
  hint: string;
}

export function buildGapReading(
  realPct: number,
  expectedPct: number,
): GapReading {
  const gap = realPct - expectedPct;
  const pontos = formatPtBr(Math.abs(gap), 1);

  if (gap >= 0) {
    return {
      status: "positive",
      headline:
        gap >= 0.05
          ? `Seu público já é como você definiu: ${pontos} pontos acima.`
          : "Seu público já é como você definiu.",
      hint: "O conteúdo está atraindo quem você quer. Siga nesse caminho e acompanhe nos próximos períodos.",
    };
  }

  if (-gap <= PUBLICO_PERTO_ATE_PONTOS) {
    return {
      status: "positive",
      headline: `Quase lá: faltam ${pontos} pontos para o público que você definiu.`,
      hint: "É pouca distância. Acompanhe os próximos períodos antes de mudar o conteúdo.",
    };
  }

  return {
    status: "attention",
    headline: `Seu público hoje está ${pontos} pontos abaixo do que você definiu.`,
    hint: "Antes de mudar o conteúdo, confirme se o público do cadastro é mesmo quem compra: quem compra pesa mais que o cadastro. Se for, ajuste temas e convites para falar com ele.",
  };
}
