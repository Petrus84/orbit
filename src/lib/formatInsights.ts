/**
 * Leitura por formato: transforma a tabela "Desempenho por formato" em
 * conclusão + próximo passo. Antes, o cliente lia "Reels somou 106 interações"
 * e ficava sem saber o que fazer com isso.
 *
 * Regras (todas declaradas aqui, nenhuma escondida):
 *  - só compara formatos com pelo menos MIN_POSTS_PARA_COMPARAR posts com os
 *    quatro números (curtidas, comentários, compartilhamentos, salvamentos);
 *  - compara interações POR POST (soma ÷ posts com dado), não a soma bruta,
 *    porque formatos com mais posts somariam mais só por publicar mais;
 *  - só aponta um formato como melhor se ele passar o segundo colocado em
 *    pelo menos VANTAGEM_MINIMA (1,25×); abaixo disso diz que estão parecidos;
 *  - toda conclusão sai como Hipótese (L2): é padrão observado em poucos
 *    posts da própria conta, não causa comprovada.
 */
import { formatPtBr } from "@/lib/format";
import type { FormatPerformanceRow, InsightData } from "@/types/orbit";

export const MIN_POSTS_PARA_COMPARAR = 3;
export const VANTAGEM_MINIMA = 1.25;
const COBERTURA_MINIMA = 0.5;
const MIN_POSTS_COM_REACAO = 3;

const postsText = (n: number): string => (n === 1 ? "1 post" : `${n} posts`);

interface Candidato {
  format: string;
  media: number;
  known: number;
}

function comparacao(formats: FormatPerformanceRow[]): InsightData | null {
  const comDado = formats.filter(
    (f) => f.interactions !== null && f.interactionsKnownPosts > 0,
  );
  const candidatos: Candidato[] = comDado
    .filter((f) => f.interactionsKnownPosts >= MIN_POSTS_PARA_COMPARAR)
    .map((f) => ({
      format: f.format,
      media: (f.interactions as number) / f.interactionsKnownPosts,
      known: f.interactionsKnownPosts,
    }))
    .sort((a, b) => b.media - a.media);

  const fora = comDado.filter(
    (f) => f.interactionsKnownPosts < MIN_POSTS_PARA_COMPARAR,
  );
  const foraText = fora.length
    ? `; ${fora
        .map((f) => `${f.format} (${postsText(f.interactionsKnownPosts)})`)
        .join(" e ")} fica fora, pois precisa de ${MIN_POSTS_PARA_COMPARAR}`
    : "";

  const [lider, segundo] = candidatos;
  if (!lider) return null;

  if (!segundo) {
    const outros = formats.length > 1;
    return {
      id: "insight-formato-comparacao",
      text: outros
        ? `${lider.format} rende ${formatPtBr(lider.media, 1)} interações por post. Os outros formatos ainda têm poucos posts para comparar.`
        : `Todos os posts do período são ${lider.format}: ${formatPtBr(lider.media, 1)} interações por post.`,
      action: `Publique ${MIN_POSTS_PARA_COMPARAR} posts em outro formato para descobrir qual rende mais para você.`,
      basis: `Base: ${postsText(lider.known)} com todos os números${foraText}.`,
      confidenceLevel: "L2",
    };
  }

  const ratio = lider.media / segundo.media;
  const base = `Base: ${postsText(lider.known + segundo.known)} com todos os números (${lider.format} ${lider.known}, ${segundo.format} ${segundo.known})${foraText}.`;

  if (ratio >= VANTAGEM_MINIMA) {
    return {
      id: "insight-formato-comparacao",
      text: `${lider.format} rende mais por post: ${formatPtBr(lider.media, 1)} interações em média, contra ${formatPtBr(segundo.media, 1)} de ${segundo.format} (${formatPtBr(ratio, 1)}× mais).`,
      action: `Nos próximos posts, dê mais espaço ao formato ${lider.format} e mantenha ${segundo.format} em menor quantidade. No fim do período, compare de novo.`,
      basis: base,
      confidenceLevel: "L2",
    };
  }

  return {
    id: "insight-formato-comparacao",
    text: `Os formatos estão parecidos: ${lider.format} com ${formatPtBr(lider.media, 1)} interações por post e ${segundo.format} com ${formatPtBr(segundo.media, 1)}.`,
    action:
      "Escolha o formato que cabe melhor na sua rotina e mude um assunto por vez para ver o efeito.",
    basis: base,
    confidenceLevel: "L2",
  };
}

function melhorPost(formats: FormatPerformanceRow[]): InsightData | null {
  const posts = formats.flatMap((f) =>
    f.postsDetail
      .filter((p) => p.likes !== null && p.comments !== null)
      .map((p) => ({
        format: f.format,
        post: p,
        reacao: (p.likes as number) + (p.comments as number),
      })),
  );
  if (posts.length < MIN_POSTS_COM_REACAO) return null;
  const melhor = posts.reduce((a, b) => (b.reacao > a.reacao ? b : a));
  if (melhor.reacao <= 0) return null;

  const legenda = (melhor.post.caption ?? "").replace(/\s+/g, " ").trim();
  const dia = melhor.post.publishedAt.slice(0, 10).split("-");
  const referencia = legenda
    ? `“${legenda.length > 60 ? `${legenda.slice(0, 60).trimEnd()}…` : legenda}”`
    : dia.length === 3
      ? `o post de ${dia[2]}/${dia[1]}`
      : "um post";

  return {
    id: "insight-melhor-post",
    text: `Seu post com mais reação no período: ${referencia} (${melhor.post.likes} curtidas e ${melhor.post.comments} comentários, em ${melhor.format}).`,
    action:
      "Reaproveite esse assunto em um novo post, no mesmo formato, e compare o resultado com este.",
    basis: `Entre ${postsText(posts.length)} com curtidas e comentários.`,
    confidenceLevel: "L2",
  };
}

function cobertura(formats: FormatPerformanceRow[]): InsightData[] {
  return formats
    .filter(
      (f) =>
        f.interactionsKnownPosts > 0 &&
        f.interactionsTotalPosts > f.interactionsKnownPosts &&
        f.interactionsKnownPosts / f.interactionsTotalPosts < COBERTURA_MINIMA,
    )
    .map((f) => ({
      id: `insight-cobertura-${f.id}`,
      text: `No formato ${f.format}, só ${f.interactionsKnownPosts} de ${f.interactionsTotalPosts} posts têm todos os números; a leitura usa esses ${f.interactionsKnownPosts}.`,
      action:
        "Complete curtidas, comentários, compartilhamentos e salvamentos dos outros posts para a leitura cobrir o formato inteiro.",
    }));
}

export function buildFormatInsights(
  formats: FormatPerformanceRow[],
): InsightData[] {
  const out: InsightData[] = [];
  const comp = comparacao(formats);
  if (comp) out.push(comp);
  const melhor = melhorPost(formats);
  if (melhor) out.push(melhor);
  out.push(...cobertura(formats));
  return out;
}
