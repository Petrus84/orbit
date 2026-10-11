import type {
  ConversionBenchmark,
  EngajamentoFonte,
  FunnelKind,
} from "@/types/orbit";

// src/lib/uiLabels.ts  (RASCUNHO — textos marcados "CONFIRMAR" dependem de você)
// ============================================================================
// Camada de apresentação: chave/jargão do banco -> texto que o cliente lê.
// Regra: nenhum componente nem o contentContractEngine escreve rótulo próprio
// para uma chave. Todos chamam label()/term(). Um lugar só para revisar.
//
// Hoje há rótulos duplicados em pelo menos 4 lugares:
//   - contentContractEngine.ts  SETOR_LABEL / TIER_LABEL
//   - FunnelSimulator.tsx       SETOR_LABELS (mesmos textos, copiados)
//   - lib/onboarding/enums.ts   ENUM_SETOR_BENCHMARK, níveis L0/L1/L2
//   - components/screens/enums.ts  ENUM_SETOR, níveis L0/L1/L2 (de novo)
// ============================================================================

export type Audience = "relatorio" | "assinatura" | "acompanhamento";

/** Setores (benchmark_category). Fonte única; substitui as 4 cópias. */
export const SETOR: Record<string, string> = {
  comercio_direto_ecommerce_social: "lojas que vendem pelas redes sociais",
  infoprodutor_autoridade_personal: "infoprodutores e cursos",
  servico_consultoria_profissional: "serviços e consultorias",
  patrocinio_publicidade_marca: "marcas que vivem de publicidade",
  membership_assinatura_comunidade: "assinaturas e comunidades",
  monetizacao_nativa_plataforma: "contas que monetizam na própria plataforma",
  autoridade_personal_branding_b2b: "autoridade e personal branding B2B",
  pre_monetizacao_a_validar: "contas ainda validando modelo de monetização",
};

/** Nível de confiança do dado. */
export const CONFIANCA: Record<"L0" | "L1" | "L2", string> = {
  L0: "Dado confirmado",
  L1: "Estimativa com base nos seus dados", // CONFIRMAR: bate com o que L1 significa?
  L2: "Falta um dado para afirmar",
};

/** Termos de tela. Sigla só com explicação ao lado (tooltip na UI). */
export const TERMO: Record<string, { texto: string; ajuda?: string }> = {
  ctr: {
    texto: "Taxa de cliques",
    ajuda: "De cada 100 pessoas que viram, quantas clicaram.",
  },
  ctr_link: { texto: "Cliques no link da bio" },
  roas: {
    texto: "Retorno do anúncio",
    ajuda: "Para cada R$ 1 investido, quanto voltou em vendas.",
  },
  er_real: {
    texto: "Engajamento",
    ajuda: "Quem curtiu, comentou, salvou ou compartilhou.",
  },
  vps: { texto: "Alcance entre seus seguidores" },
  saldo_seguidores: { texto: "Saldo de seguidores" }, // CONFIRMAR: ganhos menos perdas no período?
  ultimo_snapshot: { texto: "Dados atualizados em" },
  vs_periodo: { texto: "em relação ao período anterior" },
  benchmark: { texto: "média de contas parecidas com a sua" },
  funil_maturidade: {
    texto: "Como alguém chega do Instagram até a compra hoje?",
  }, // CONFIRMAR
  setor_benchmark: { texto: "Qual é o seu ramo?" },
  prova_social: { texto: "Como você mostra que seu trabalho funciona?" },
};

/** Fonte de dado do engajamento (substitui "SSOT · Métrica ... (Banco|Benchmark)"). */
export function fonteEngajamento(temDadoProprio: boolean): string {
  return temDadoProprio
    ? "Engajamento usado: do seu histórico real"
    : "Engajamento usado: média de contas parecidas com a sua";
}

/** Origem do engajamento usado na fricção de escala do simulador. */
export function fonteEngajamentoDetalhada(fonte: EngajamentoFonte): string {
  return fonte === "proprio"
    ? "Engajamento usado: do seu histórico real"
    : "Engajamento usado: valor padrão (ainda sem dado seu conectado)";
}

/** Taxa de conversão sugerida ao simulador quando não há venda informada. */
export type ReferenciaConversao = Pick<
  ConversionBenchmark,
  "valuePct" | "eventMeasured" | "isProxy" | "confidenceLevel"
>;

export function textoReferenciaConversao(
  ref: ReferenciaConversao | null | undefined,
): string {
  if (!ref || ref.valuePct === null) {
    return "Taxa de conversão: sem referência de mercado para o seu ramo e sem venda informada no período";
  }
  const valor = ref.valuePct.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
  const tipo = ref.isProxy ? "referência aproximada" : "referência";
  return `Taxa de conversão inicial: ${valor}% (${tipo} de mercado — ${ref.eventMeasured}). ${CONFIANCA[ref.confidenceLevel]}.`;
}

/** O que falta na etapa de venda e por quê, por tipo de funil. */
export function ausenciaVendas(tipo: FunnelKind): Ausencia {
  return tipo === "dm"
    ? {
        oQueFalta: "Vendas do período",
        porque:
          "o Instagram só mostra a conversa; Pix, retirada ou combinado por WhatsApp só entram quando você informa",
      }
    : {
        oQueFalta: "Vendas do período",
        porque:
          "a venda acontece em página fora do Instagram e só entra quando você ou o cliente informa",
      };
}

/**
 * Princípio: sem dado, sem tela. "Sem dados" / "N/A" soltos não existem aqui:
 * placeholder genérico é null com cara de texto. Se a ausência vai ser mostrada,
 * ela precisa dizer O QUE falta e POR QUÊ; senão o componente não renderiza.
 */
export interface Ausencia {
  oQueFalta: string;
  porque: string;
}
export function textoAusencia(a: Ausencia | null | undefined): string | null {
  if (!a || !a.oQueFalta.trim() || !a.porque.trim()) return null;
  return `${a.oQueFalta}: ${a.porque}`;
}

/** Dado ausente: diga o que falta, nunca o nome do campo nem o código da dívida. */
export const AUSENCIA = {
  vps: "Alcance entre seus seguidores ainda indisponível: esse dado não veio no arquivo importado.",
  regua:
    "Ainda não temos comparação para o seu tipo de conta. Confira o ramo marcado no cadastro.",
  regua_metrica: "Ainda não temos comparação de mercado para este indicador.",
  sem_causa: "Sem comparação de mercado por enquanto.", // no lugar de "n/a — sem régua…"
} as const;

/**
 * Entrada única. Em desenvolvimento, chave desconhecida FALHA ALTO (throw),
 * para não vazar "meta_algo" na tela. Em produção devolve texto neutro.
 */
export function term(chave: string): string {
  const t = TERMO[chave];
  if (t) return t.texto;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`uiLabels: chave sem rótulo de tela: "${chave}"`);
  }
  // Produção: nunca inventar texto para chave sem rótulo. Loga e devolve "";
  // o componente não renderiza rótulo vazio. O gate/CI deve impedir chegar aqui.
  console.error(`uiLabels: chave sem rótulo de tela: "${chave}"`);
  return "";
}

export const setorLabel = (chave: string): string =>
  SETOR[chave] ?? "seu ramo de atuação";
