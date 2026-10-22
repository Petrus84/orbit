// ingest-meta-csv.ts — orbit v1.2.0 (modo --kind=stories)
// Ingere o CSV de posts do Meta Business Suite como dado COMPLEMENTAR ao export nativo do Instagram.
//
// Garantias de integridade:
//  - Dry-run por padrão. Só grava com --apply.
//  - Nunca sobrescreve valor já preenchido (só null -> valor). Divergências são apenas reportadas.
//  - Nunca duplica post (ver ordem de casamento abaixo). Ambíguo = pulado.
//  - Só linhas com Data = "Total". Valor inesperado em qualquer coluna rejeita a LINHA (nunca chuta).
//  - Fuso: "Horário de publicação" vem sem fuso. Converte de --tz (padrão America/Los_Angeles) para UTC
//    e confere contra o timestamp embutido no shortcode do Instagram; se não bater, rejeita a linha.
//  - Visualizações -> impressions. NÃO toca em reel_views / reel_plays (semântica do Apify, ver ADR).
//    Por padrão só para REELS (--impressions-from-views=reel): em imagens/carrosséis o "views" do CSV
//    chega a ~1,5x o "impressions" do export nativo; misturar definições na mesma coluna distorce a série.
//    Use =all só depois de decidir; =none para nunca preencher.
//  - Casamento com posts do export nativo (ig_shortcode nulo): shortcode > URI > id da mídia (nome do
//    arquivo "media/.../<id>.ext" = "Identificação do post") > data (janela [−1 s, +60 s], 1-para-1). Ambíguo = pulado.
//  - Backfill: grava ig_shortcode nos posts casados por id/data (habilita o join com Apify).
//  - Legenda: preenche se vazia; reparar mojibake do export nativo só com --repair-captions
//    (legenda alimenta utility_score_pct, coluna gerada).
//  - Com qualquer linha rejeitada, --apply aborta ANTES de gravar (use --allow-partial para ignorar).
//  - Idempotente: o hash sha256 do arquivo identifica a sessão; raw_ig_ingest não duplica
//    (client_id, source_file, source_key).
//  - Após gravar, relê o banco e confere campo a campo; só fecha a sessão como 'done' se bater.
//  - ingest_script = 'manual' (convenção dos CSVs anteriores; evita alterar o enum).
//
// Uso:
//   npx tsx scripts/ingest/ingest-meta-csv.ts --file="C:\Projetos\Export_clients\Acenxovais\Sep-09-2026_Oct-06-2026_1574795624332093.csv"
//   npx tsx scripts/ingest/ingest-meta-csv.ts --file="..." --apply
//   npx tsx scripts/ingest/ingest-meta-csv.ts --file="..." --parse-only      # só valida o arquivo, sem banco
//
// Opções: --client=<handle> (padrão: "Nome de usuário da conta" do CSV)  --client-id=<uuid> (trava de segurança)
//         --tz=<IANA>  --allow-partial  --repair-captions  --impressions-from-views=reel|all|none
//         --prefer-csv  (CSV prevalece em reach/likes/comments/shares/saves quando divergem; troca os 5 juntos)
//         --kind=posts|stories  (padrão: posts)
//
// Modo --kind=stories (v1.2.0): CSV de Stories do Meta Business Suite -> orbit.ig_posts com content_format='story'.
//  - Cabeçalho exigido: identificação do post/conta, usuário, descrição, duração, horário, link, tipo, Data,
//    Visualizações, Alcance, Curtidas, Compartilhamentos. Opcional: Visitas ao perfil (-> profile_visits_from).
//  - Só insere (stories não existem no export nativo). Identidade = permalink (UNIQUE client_id + ig_post_uri);
//    ig_shortcode fica NULL. NÃO usa casamento por data (vários stories saem no mesmo minuto).
//  - Visualizações -> impressions (ficha story_views). Confiança L0, is_estimated=false.
//  - Fuso: confere o horário do CSV contra o instante embutido no id numérico do story (mesmo gate dos shortcodes).
//  - Respostas, Navegação e Toques em figurinhas NÃO têm coluna: ficam só em raw_ig_ingest.raw_payload.
//  - Stories ficam fora de cadencia_posts e mix_formato (o engine filtra content_format='story').

import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { resolveClientId } from "../lib/resolveClientId";

dotenv.config({ path: ".env.local" });

const INGEST_SCRIPT_ENUM = "manual" as const; // valor do enum orbit.ingest_script (decisão: não alterar o enum)
// O CSV trunca o horário ao minuto; o export nativo tem segundos: banco − CSV ∈ [−1 s, +60 s].
const DATE_WINDOW_MIN_S = -1;
const DATE_WINDOW_MAX_S = 60;

/* ── CLI ────────────────────────────────────────────────────────────────── */
function argVal(flag: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(`--${flag}`);
  const next = process.argv[idx + 1];
  if (idx >= 0 && next && !next.startsWith("--")) return next;
  return undefined;
}
const FILE = argVal("file");
const CLIENT_ARG = argVal("client");
const TZ = argVal("tz") ?? "America/Los_Angeles";
const APPLY = process.argv.includes("--apply");
const PARSE_ONLY = process.argv.includes("--parse-only");
const ALLOW_PARTIAL = process.argv.includes("--allow-partial");
const REPAIR_CAPTIONS = process.argv.includes("--repair-captions");
const PREFER_CSV = process.argv.includes("--prefer-csv");
const CLIENT_ID_ARG = argVal("client-id");
const IMPRESSIONS_MODE = argVal("impressions-from-views") ?? "reel";
if (!["reel", "all", "none"].includes(IMPRESSIONS_MODE)) {
  console.error("❌ --impressions-from-views deve ser reel, all ou none");
  process.exit(1);
}
const KIND = argVal("kind") ?? "posts";
if (!["posts", "stories"].includes(KIND)) {
  console.error("❌ --kind deve ser posts ou stories");
  process.exit(1);
}
const STORIES = KIND === "stories";

if (!FILE || !fs.existsSync(FILE)) {
  console.error('❌ --file="<caminho>.csv" é obrigatório e precisa existir');
  process.exit(1);
}
try {
  new Intl.DateTimeFormat("en-US", { timeZone: TZ });
} catch {
  console.error(`❌ --tz="${TZ}" não é um fuso IANA válido`);
  process.exit(1);
}

/* ── Tipos ──────────────────────────────────────────────────────────────── */
type ContentFormat = "reel" | "static_post" | "carousel" | "story";
type Confidence = "L0" | "L1" | "L2";

const COL = {
  postId: "Identificação do post",
  accountId: "Identificação da conta",
  username: "Nome de usuário da conta",
  description: "Descrição",
  duration: "Duração (s)",
  published: "Horário de publicação",
  link: "Link permanente",
  type: "Tipo de post",
  date: "Data",
  views: "Visualizações",
  reach: "Alcance",
  likes: "Curtidas",
  shares: "Compartilhamentos",
  follows: "Seguimentos",
  comments: "Comentários",
  saves: "Salvamentos",
} as const;

// Modo stories: o CSV de Stories não tem Seguimentos/Comentários/Salvamentos.
const COL_PROFILE_VISITS = "Visitas ao perfil"; // opcional (vem vazio em parte dos stories)
const STORY_REQUIRED: string[] = [
  COL.postId,
  COL.accountId,
  COL.username,
  COL.description,
  COL.duration,
  COL.published,
  COL.link,
  COL.type,
  COL.date,
  COL.views,
  COL.reach,
  COL.likes,
  COL.shares,
];
const REQUIRED: string[] = STORIES ? STORY_REQUIRED : Object.values(COL);

// A Meta omite a(s) última(s) célula(s) VAZIA(S) de algumas linhas (ex.: stories com "Toques em figurinhas"
// em branco chegam com 18 células em vez de 19). Só toleramos isso para colunas FINAIS e OPCIONAIS;
// qualquer outro desalinhamento continua sendo erro (nunca chutar o alinhamento).
const TRAILING_OPTIONAL: string[] = ["Toques em figurinhas"];

interface ParsedPost {
  line: number;
  sourceKey: string;
  raw: Record<string, string>;
  username: string;
  shortcode: string;
  uri: string;
  publishedAt: Date;
  format: ContentFormat;
  caption: string | null;
  durationSec: number | null;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  shares: number | null;
  follows: number | null;
  comments: number | null;
  saves: number | null;
  storyId: string | null;
  profileVisits: number | null;
  warnings: string[];
}
interface Rejected {
  line: number;
  sourceKey: string;
  reason: string;
  raw: Record<string, string>;
}

const METRIC_FIELDS = [
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "follows_from",
  "reel_duration_sec",
  "profile_visits_from",
] as const;
type MetricField = (typeof METRIC_FIELDS)[number];

interface ExistingRow {
  id: string;
  ig_post_uri: string;
  ig_shortcode: string | null;
  published_at: string;
  content_format: string;
  confidence_level: Confidence | null;
  is_estimated: boolean | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows_from: number | null;
  reel_duration_sec: number | null;
  profile_visits_from: number | null;
  caption: string | null;
}

interface PlanItem {
  post: ParsedPost;
  action: "insert" | "update" | "noop" | "reject";
  matchedBy?: "shortcode" | "uri" | "id" | "data";
  existing?: ExistingRow;
  patch?: Record<string, unknown>;
  divergences: string[];
  reason?: string;
}

/* ── Utilidades ─────────────────────────────────────────────────────────── */
function fixMojibake(s: string): string {
  if (!/[ÃÂ]|â€/.test(s)) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf-8");
  } catch {
    return s;
  }
}
const norm = (s: string): string => s.normalize("NFC").trim();

/** CSV RFC 4180: aspas, "" escapado, quebras de linha dentro de campo, CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (c === "\r" && text.charAt(i + 1) === "\n") {
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      endField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (inQuotes) throw new Error("CSV inválido: aspas não fechadas");
  if (field !== "" || row.length > 0) endRow();
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function tzOffsetMs(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    p.year!,
    p.month! - 1,
    p.day!,
    p.hour!,
    p.minute!,
    p.second!,
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}
/** Converte hora "de parede" no fuso tz para o instante UTC (respeita horário de verão). */
function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess;
  for (let k = 0; k < 3; k++) t = guess - tzOffsetMs(t, tz);
  return new Date(t);
}

const SC_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** O shortcode do Instagram é o media id em base64; os bits altos carregam o instante de criação (UTC). */
function shortcodeCreatedAt(sc: string): Date | null {
  let n = 0n;
  for (const ch of sc) {
    const idx = SC_ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    n = n * 64n + BigInt(idx);
  }
  const ms = Number(n >> 23n) + 1314220021721;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  return y >= 2010 && y <= 2100 ? d : null;
}

/** O id numérico do story (pk da mídia) carrega o instante de criação, como o shortcode: (pk >> 23) + época do Instagram. */
function mediaPkCreatedAt(pk: string): Date | null {
  if (!/^\d{10,20}$/.test(pk)) return null;
  const d = new Date(Number(BigInt(pk) >> 23n) + 1314220021721);
  const y = d.getUTCFullYear();
  return y >= 2010 && y <= 2100 ? d : null;
}

const CP1252: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};
/** Desfaz UTF-8 lido como latin1/cp1252 (sem o gate do fixMojibake, que não pega legendas iniciadas em emoji). */
function repairMojibake(s: string): string {
  const bytes: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) bytes.push(code);
    else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]!);
    else return s;
  }
  return Buffer.from(bytes).toString("utf-8");
}
const MOJIBAKE_RE =
  /[ÃÂ][\u0080-\u00BF]|ï¸|â€|ð[\u0080-\u00BF\u0152-\u0178]|ðð/;
const isBlank = (s: string | null | undefined): boolean =>
  s === null || s === undefined || s.trim() === "";
function lettersPrefix(s: string): string {
  return (s.normalize("NFC").match(/\p{L}/gu) ?? [])
    .join("")
    .toLowerCase()
    .slice(0, 12);
}
function mediaIdFromUri(uri: string): string | null {
  const m = /\/(\d{10,})\.[A-Za-z0-9]+$/.exec(uri);
  return m ? m[1]! : null;
}

function parseCount(v: string | undefined, label: string): number | null {
  const s = (v ?? "").trim();
  if (s === "") return null;
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s))
    return Number.parseInt(s.replace(/[.,]/g, ""), 10);
  throw new Error(`${label}: valor inesperado "${s}"`);
}

function mapFormat(typeRaw: string, link: string): ContentFormat {
  if (STORIES) {
    const ts = norm(typeRaw).toLowerCase();
    if (/^story\b/.test(ts) && /instagram\.com\/stories\//i.test(link))
      return "story";
    throw new Error(`Tipo de post não mapeado (modo stories): "${typeRaw}"`);
  }
  const t = norm(typeRaw).toLowerCase();
  const kind = /instagram\.com\/(reel|reels)\//i.test(link)
    ? "reel"
    : /instagram\.com\/p\//i.test(link)
      ? "p"
      : "other";
  if (/^reel\b/.test(t) && kind === "reel") return "reel";
  if (/carrossel|carousel/.test(t) && kind === "p") return "carousel";
  if (
    /^(foto|imagem|photo|image|publicação|publicacao|post)\b/.test(t) &&
    kind === "p"
  )
    return "static_post";
  throw new Error(`Tipo de post não mapeado: "${typeRaw}" (link: ${kind})`);
}

function parseFileName(
  file: string,
): { start: string; end: string; accountToken: string } | null {
  const m =
    /^([A-Z][a-z]{2})-(\d{2})-(\d{4})_([A-Z][a-z]{2})-(\d{2})-(\d{4})_(\d+)\.csv$/.exec(
      path.basename(file),
    );
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const m1 = months[m[1]!];
  const m2 = months[m[4]!];
  if (!m1 || !m2) return null;
  return {
    start: `${m[3]}-${m1}-${m[2]}`,
    end: `${m[6]}-${m2}-${m[5]}`,
    accountToken: m[7]!,
  };
}

/* ── Parse + validação do arquivo ───────────────────────────────────────── */
function readFileText(file: string): { text: string; hash: string } {
  const buf = fs.readFileSync(file);
  const hash = createHash("sha256").update(buf).digest("hex");
  let text = buf.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text, hash };
}

function parsePosts(text: string): {
  posts: ParsedPost[];
  rejected: Rejected[];
  skippedNotTotal: number;
  usernames: Set<string>;
} {
  let table = parseCsv(text);
  const hasAllHeaders = (hdr: string[]) =>
    REQUIRED.every((c) => hdr.map(norm).includes(c));
  if (table[0] && !hasAllHeaders(table[0])) {
    const fixed = parseCsv(fixMojibake(text));
    if (fixed[0] && hasAllHeaders(fixed[0])) table = fixed;
  }
  const header = (table[0] ?? []).map(norm);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    const hint =
      !STORIES && /Story do Instagram/i.test(text)
        ? " — o arquivo parece ser de Stories: use --kind=stories"
        : "";
    throw new Error(
      `Cabeçalho incompatível. Colunas ausentes: ${missing.join(" | ")}${hint}`,
    );
  }

  const posts: ParsedPost[] = [];
  const rejected: Rejected[] = [];
  let skippedNotTotal = 0;
  const seenShortcodes = new Set<string>();
  const usernames = new Set<string>();

  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    const line = r + 1;
    if (cells.length < header.length) {
      const faltam = header.slice(cells.length);
      if (faltam.every((h) => TRAILING_OPTIONAL.includes(h))) {
        while (cells.length < header.length) cells.push("");
      }
    }
    if (cells.length !== header.length) {
      throw new Error(
        `Linha ${line}: ${cells.length} colunas, esperado ${header.length} (arquivo corrompido?)`,
      );
    }
    const raw: Record<string, string> = {};
    header.forEach((h, i) => {
      raw[h] = cells[i] ?? "";
    });
    const g = (c: string): string => (raw[c] ?? "").trim();
    const sourceKey = g(COL.postId);
    if (g(COL.username)) usernames.add(g(COL.username));

    try {
      if (g(COL.date) !== "Total") {
        skippedNotTotal++;
        continue;
      }
      if (!/^\d+$/.test(sourceKey))
        throw new Error(`Identificação do post inválida: "${sourceKey}"`);
      const username = g(COL.username);
      if (!username) throw new Error("Nome de usuário da conta vazio");

      const link = g(COL.link);
      let shortcode = "";
      let storyId: string | null = null;
      let uri: string;
      if (STORIES) {
        const sm =
          /^https:\/\/www\.instagram\.com\/stories\/([A-Za-z0-9._]+)\/(\d{10,20})\/?$/.exec(
            link,
          );
        if (!sm)
          throw new Error(`Link permanente de story fora do padrão: "${link}"`);
        if (sm[1]!.toLowerCase() !== username.toLowerCase())
          throw new Error(`Link de story de outra conta: "${link}"`);
        storyId = sm[2]!;
        if (seenShortcodes.has(storyId))
          throw new Error(`story repetido no arquivo: ${storyId}`);
        seenShortcodes.add(storyId);
        uri = `https://www.instagram.com/stories/${sm[1]}/${storyId}/`;
      } else {
        const lm =
          /^https:\/\/www\.instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/.exec(
            link,
          );
        if (!lm) throw new Error(`Link permanente fora do padrão: "${link}"`);
        shortcode = lm[2]!;
        if (seenShortcodes.has(shortcode))
          throw new Error(`shortcode repetido no arquivo: ${shortcode}`);
        seenShortcodes.add(shortcode);
        uri = `https://www.instagram.com/${lm[1]}/${shortcode}/`;
      }
      const format = mapFormat(g(COL.type), link);

      const pm = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(
        g(COL.published),
      );
      if (!pm)
        throw new Error(
          `Horário de publicação fora do padrão MM/DD/YYYY HH:mm: "${g(COL.published)}"`,
        );
      const [mo, d, y, h, mi] = [pm[1], pm[2], pm[3], pm[4], pm[5]].map(
        Number,
      ) as [number, number, number, number, number];
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59)
        throw new Error(`Data/hora inválida: "${g(COL.published)}"`);
      const publishedAt = zonedToUtc(y, mo, d, h, mi, TZ);

      // Gate de fuso: o shortcode carrega o instante de criação (UTC) da mídia.
      const created = storyId
        ? mediaPkCreatedAt(storyId)
        : shortcodeCreatedAt(shortcode);
      if (!created)
        throw new Error(
          `id/shortcode não decodificável: ${storyId ?? shortcode}`,
        );
      const deltaS = (publishedAt.getTime() - created.getTime()) / 1000;
      // Posts: a mídia pode ser criada até 14 dias antes de publicar. Stories: o CSV (truncado ao minuto) sai de ~1 s a ~3,5 min
      // ANTES do instante do id (medido em 326 stories) e nunca depois; um fuso errado desloca horas, então a janela é estreita.
      const [deltaMin, deltaMax] = storyId ? [-600, 120] : [-120, 14 * 86400];
      if (deltaS < deltaMin || deltaS > deltaMax) {
        throw new Error(
          `Fuso suspeito: publicação ${publishedAt.toISOString()} (tz=${TZ}) vs criação do shortcode ` +
            `${created.toISOString()} (Δ=${(deltaS / 3600).toFixed(2)} h)`,
        );
      }

      const durationSec = parseCount(g(COL.duration), COL.duration);
      if (durationSec !== null && durationSec > 32767)
        throw new Error(`Duração fora de smallint: ${durationSec}`);
      const impressions = parseCount(g(COL.views), COL.views);
      const reach = parseCount(g(COL.reach), COL.reach);
      const warnings: string[] = [];
      if (reach !== null && impressions !== null && reach > impressions) {
        warnings.push(`alcance (${reach}) > visualizações (${impressions})`);
      }

      posts.push({
        line,
        sourceKey,
        raw,
        username,
        shortcode,
        uri,
        publishedAt,
        format,
        caption:
          g(COL.description) === ""
            ? null
            : (raw[COL.description] ?? "").replace(/\s+$/, ""),
        durationSec: format === "reel" ? durationSec : null,
        impressions,
        reach,
        likes: parseCount(g(COL.likes), COL.likes),
        shares: parseCount(g(COL.shares), COL.shares),
        follows: parseCount(g(COL.follows), COL.follows),
        comments: parseCount(g(COL.comments), COL.comments),
        saves: parseCount(g(COL.saves), COL.saves),
        storyId,
        profileVisits: STORIES
          ? parseCount(g(COL_PROFILE_VISITS), COL_PROFILE_VISITS)
          : null,
        warnings,
      });
    } catch (e) {
      rejected.push({
        line,
        sourceKey,
        reason: e instanceof Error ? e.message : String(e),
        raw,
      });
    }
  }
  return { posts, rejected, skippedNotTotal, usernames };
}

/* ── Banco ──────────────────────────────────────────────────────────────── */
function assertNoError(error: { message: string } | null, ctx: string): void {
  if (error) throw new Error(`${ctx}: ${error.message}`);
}
function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local",
    );
    process.exit(1);
  }
  return createClient(url, key);
}

async function loadClientPosts(
  db: SupabaseClient,
  clientId: string,
): Promise<ExistingRow[]> {
  const out: ExistingRow[] = [];
  const cols =
    "id, ig_post_uri, ig_shortcode, published_at, content_format, confidence_level, is_estimated, " +
    "reach, impressions, likes, comments, shares, saves, follows_from, reel_duration_sec, profile_visits_from, caption";
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .schema("orbit")
      .from("ig_posts")
      .select(cols)
      .eq("client_id", clientId)
      .range(from, from + 999);
    assertNoError(error, "leitura ig_posts");
    out.push(...((data ?? []) as unknown as ExistingRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function impressionsFor(p: ParsedPost): number | null {
  if (IMPRESSIONS_MODE === "none") return null;
  if (p.format === "story") return p.impressions; // ficha story_views: Visualizações -> impressions
  if (IMPRESSIONS_MODE === "reel" && p.format !== "reel") return null;
  return p.impressions;
}

function valueFor(p: ParsedPost, f: MetricField): number | null {
  switch (f) {
    case "reach":
      return p.reach;
    case "impressions":
      return impressionsFor(p);
    case "likes":
      return p.likes;
    case "comments":
      return p.comments;
    case "shares":
      return p.shares;
    case "saves":
      return p.saves;
    case "follows_from":
      return p.follows;
    case "profile_visits_from":
      return STORIES ? p.profileVisits : null;
    case "reel_duration_sec":
      return p.durationSec;
  }
}

async function buildPlan(
  db: SupabaseClient,
  clientId: string,
  posts: ParsedPost[],
  period: { start: string; end: string } | null,
): Promise<{ plan: PlanItem[]; orphans: ExistingRow[] }> {
  const existing = await loadClientPosts(db, clientId);
  const byShortcode = new Map<string, ExistingRow>();
  const byUri = new Map<string, ExistingRow>();
  const byMediaId = new Map<string, ExistingRow>();
  for (const e of existing) {
    if (e.ig_shortcode) byShortcode.set(e.ig_shortcode, e);
    byUri.set(e.ig_post_uri, e);
    const mid = mediaIdFromUri(e.ig_post_uri);
    if (mid && !e.ig_shortcode) byMediaId.set(mid, e);
  }
  // ig_shortcode é UNIQUE global (não por cliente): confere se algum já pertence a outro cliente.
  const foreignSet = new Set<string>();
  if (!STORIES) {
    // stories não têm shortcode
    const { data: foreign, error: fErr } = await db
      .schema("orbit")
      .from("ig_posts")
      .select("ig_shortcode, client_id")
      .in(
        "ig_shortcode",
        posts.map((p) => p.shortcode),
      )
      .neq("client_id", clientId);
    assertNoError(fErr, "leitura ig_posts (shortcode em outro cliente)");
    for (const r of foreign ?? []) foreignSet.add(String(r.ig_shortcode));
  }

  const claimed = new Set<string>();
  const plan: PlanItem[] = [];
  for (const p of posts) {
    if (foreignSet.has(p.shortcode)) {
      plan.push({
        post: p,
        action: "reject",
        divergences: [],
        reason: `shortcode ${p.shortcode} já pertence a OUTRO cliente`,
      });
      continue;
    }
    let row = byShortcode.get(p.shortcode);
    let how: PlanItem["matchedBy"] = row ? "shortcode" : undefined;
    if (!row) {
      row = byUri.get(p.uri);
      if (row) how = "uri";
    }
    if (!row) {
      const byId = byMediaId.get(p.sourceKey);
      if (byId && !claimed.has(byId.id)) {
        row = byId;
        how = "id";
      }
    }
    if (!row && !STORIES) {
      // stories: só por permalink (sem casamento por data: vários stories no mesmo minuto)
      const cands = existing.filter(
        (e) =>
          !e.ig_shortcode &&
          !claimed.has(e.id) &&
          e.content_format === p.format &&
          (() => {
            const d =
              (new Date(e.published_at).getTime() - p.publishedAt.getTime()) /
              1000;
            return d >= DATE_WINDOW_MIN_S && d <= DATE_WINDOW_MAX_S;
          })(),
      );
      if (cands.length > 1) {
        plan.push({
          post: p,
          action: "reject",
          divergences: [],
          reason: `ambíguo por data (${cands.length} candidatos) — não grava`,
        });
        continue;
      }
      if (cands.length === 1) {
        row = cands[0];
        how = "data";
      }
    }
    if (!row) {
      plan.push({ post: p, action: "insert", divergences: [] });
      continue;
    }
    claimed.add(row.id);

    const patch: Record<string, unknown> = {};
    const divergences: string[] = [];
    const COHERENT: MetricField[] = [
      "reach",
      "likes",
      "comments",
      "shares",
      "saves",
    ];
    // No modo --prefer-csv, as 5 métricas de engajamento são trocadas JUNTAS (um único snapshot por post).
    const swap =
      PREFER_CSV &&
      COHERENT.some((f) => {
        const inc = valueFor(p, f);
        const cur = row[f];
        return inc !== null && cur !== null && cur !== inc;
      });
    for (const f of METRIC_FIELDS) {
      const incoming = valueFor(p, f);
      const current = row[f];
      if (incoming === null) continue;
      if (current === null) patch[f] = incoming;
      else if (current !== incoming) {
        if (swap && COHERENT.includes(f)) {
          patch[f] = incoming;
          divergences.push(
            `${f}: banco=${current} → csv=${incoming} (ATUALIZADO, --prefer-csv)`,
          );
        } else
          divergences.push(
            `${f}: banco=${current} csv=${incoming} (mantido banco)`,
          );
      }
    }
    if (how === "data" || how === "id") patch.ig_shortcode = p.shortcode;
    if (p.caption !== null) {
      if (isBlank(row.caption)) patch.caption = p.caption;
      else if (MOJIBAKE_RE.test(row.caption ?? "")) {
        const sameText =
          lettersPrefix(repairMojibake(row.caption ?? "")) ===
          lettersPrefix(p.caption);
        if (!sameText)
          divergences.push(
            "caption com mojibake, mas o texto reparado não confere com o CSV — mantida",
          );
        else if (REPAIR_CAPTIONS) patch.caption = p.caption;
        else
          divergences.push(
            "caption com mojibake no banco; o CSV traz o texto limpo (use --repair-captions)",
          );
      }
    }
    if (patch.reach !== undefined && row.confidence_level !== "L2" && !STORIES)
      patch.confidence_level = "L1";
    const dtH =
      (new Date(row.published_at).getTime() - p.publishedAt.getTime()) /
      3600000;
    if (Math.abs(dtH) > 0.1)
      divergences.push(
        `published_at: banco=${row.published_at} csv(UTC)=${p.publishedAt.toISOString()} (Δ=${dtH.toFixed(2)} h; mantido banco)`,
      );
    plan.push({
      post: p,
      action: Object.keys(patch).length > 0 ? "update" : "noop",
      matchedBy: how,
      existing: row,
      patch,
      divergences,
    });
  }
  // lacunas no sentido inverso: posts do banco dentro do período do CSV sem correspondente no arquivo
  const orphans = period
    ? existing.filter(
        (e) =>
          !claimed.has(e.id) &&
          (!STORIES || e.content_format === "story") &&
          e.published_at.slice(0, 10) >= period.start &&
          e.published_at.slice(0, 10) <= period.end,
      )
    : [];
  return { plan, orphans };
}

function insertPayload(
  clientId: string,
  sessionId: string,
  p: ParsedPost,
): Record<string, unknown> {
  return {
    client_id: clientId,
    import_session: sessionId,
    ig_post_uri: p.uri,
    ig_shortcode: STORIES ? null : p.shortcode,
    published_at: p.publishedAt.toISOString(),
    content_format: p.format,
    caption: p.caption,
    reach: p.reach,
    impressions: impressionsFor(p),
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    follows_from: p.follows,
    reel_duration_sec: p.durationSec,
    ...(STORIES ? { profile_visits_from: p.profileVisits } : {}),
    confidence_level:
      p.format === "story" ? "L0" : p.reach !== null ? "L1" : "L0",
    is_estimated: false,
  };
}

async function verify(
  db: SupabaseClient,
  clientId: string,
  plan: PlanItem[],
): Promise<string[]> {
  const problems: string[] = [];
  const sel = plan.filter(
    (i) => i.action === "insert" || i.action === "update",
  );
  if (sel.length === 0) return problems;
  const keyCol = STORIES ? "ig_post_uri" : "ig_shortcode";
  const keyOf = (p: ParsedPost): string => (STORIES ? p.uri : p.shortcode);
  const { data, error } = await db
    .schema("orbit")
    .from("ig_posts")
    .select(
      "ig_post_uri, ig_shortcode, published_at, content_format, caption, reach, impressions, likes, comments, shares, saves, follows_from, reel_duration_sec, profile_visits_from",
    )
    .eq("client_id", clientId)
    .in(
      keyCol,
      sel.map((i) => keyOf(i.post)),
    );
  assertNoError(error, "verificação pós-gravação");
  const got = new Map(
    (data ?? []).map((r) => [
      String((r as Record<string, unknown>)[keyCol]),
      r as Record<string, unknown>,
    ]),
  );
  for (const i of sel) {
    const r = got.get(keyOf(i.post));
    if (!r) {
      problems.push(`${keyOf(i.post)}: não encontrado após gravar`);
      continue;
    }
    if (i.action === "insert") {
      if (
        new Date(String(r.published_at)).getTime() !==
        i.post.publishedAt.getTime()
      )
        problems.push(`${keyOf(i.post)}: published_at difere`);
      if (r.content_format !== i.post.format)
        problems.push(`${keyOf(i.post)}: content_format difere`);
    }
    const expectedCaption =
      i.action === "insert"
        ? i.post.caption
        : (i.patch?.caption as string | undefined);
    if (
      expectedCaption !== undefined &&
      expectedCaption !== null &&
      r.caption !== expectedCaption
    )
      problems.push(`${keyOf(i.post)}: caption difere`);
    for (const f of METRIC_FIELDS) {
      const expected =
        i.action === "insert"
          ? valueFor(i.post, f)
          : (i.patch?.[f] as number | undefined);
      if (expected === undefined) continue;
      if (r[f] !== expected)
        problems.push(
          `${keyOf(i.post)}: ${f} esperado=${expected} obtido=${String(r[f])}`,
        );
    }
  }
  return problems;
}

/* ── Main ───────────────────────────────────────────────────────────────── */
async function run(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════");
  console.log(
    `🔄 ORBIT · Ingest Meta Business Suite CSV — v1.2.0 · kind=${KIND}`,
  );
  console.log(`📄 Arquivo: ${FILE}`);
  console.log(`🕒 Fuso do CSV: ${TZ}`);
  console.log(
    `${APPLY ? "💾 APPLY (grava)" : PARSE_ONLY ? "🔎 PARSE-ONLY (sem banco)" : "🧪 DRY RUN (nada é gravado)"}`,
  );
  console.log("═══════════════════════════════════════════════════════");

  const sourceFile = path.basename(FILE!);
  const { text, hash } = readFileText(FILE!);
  const period = parseFileName(FILE!);
  if (!period)
    console.warn(
      "⚠️  Nome do arquivo fora do padrão Mon-DD-YYYY_Mon-DD-YYYY_<id>.csv — período não registrado na sessão.",
    );
  const {
    posts,
    rejected,
    skippedNotTotal,
    usernames: handles,
  } = parsePosts(text);
  if (handles.size > 1)
    throw new Error(`CSV com mais de uma conta: ${[...handles].join(", ")}`);
  const handle = CLIENT_ARG ?? [...handles][0];
  if (!handle)
    throw new Error(
      "Não foi possível determinar o cliente (use --client=<handle>)",
    );
  if (CLIENT_ARG && handles.size === 1 && !handles.has(CLIENT_ARG)) {
    throw new Error(
      `--client=${CLIENT_ARG} não corresponde à conta do CSV (${[...handles][0]})`,
    );
  }

  if (posts.length === 0 && rejected.length === 0)
    throw new Error(
      `Nenhuma linha com Data = "Total" no arquivo (ignoradas=${skippedNotTotal})`,
    );
  console.log(`\n📱 Cliente: ${handle} | sha256: ${hash.slice(0, 16)}…`);
  console.log(
    `📋 Linhas válidas=${posts.length} rejeitadas=${rejected.length} ignoradas(Data≠Total)=${skippedNotTotal}`,
  );
  if (period)
    console.log(`📅 Período do arquivo: ${period.start} → ${period.end}`);
  for (const p of posts) {
    const created = (
      p.storyId ? mediaPkCreatedAt(p.storyId) : shortcodeCreatedAt(p.shortcode)
    )!;
    console.log(
      `   ✔ L${p.line} ${p.format} ${p.storyId ?? p.shortcode} publicado(UTC)=${p.publishedAt.toISOString()} ` +
        `Δcriação=${((p.publishedAt.getTime() - created.getTime()) / 1000).toFixed(0)}s ` +
        `views=${p.impressions ?? "—"} alcance=${p.reach ?? "—"} curt=${p.likes ?? "—"} comp=${p.shares ?? "—"} ` +
        `seg=${p.follows ?? "—"} coment=${p.comments ?? "—"} salv=${p.saves ?? "—"}${STORIES ? ` visitas=${p.profileVisits ?? "—"}` : ""}`,
    );
    for (const w of p.warnings) console.warn(`     ⚠️  ${w}`);
    if (period) {
      const day = p.publishedAt.toISOString().slice(0, 10);
      if (day < period.start || day > period.end)
        console.warn(`     ⚠️  publicado fora do período do arquivo (${day})`);
    }
  }
  for (const r of rejected)
    console.error(`   ✖ L${r.line} [${r.sourceKey}] REJEITADA: ${r.reason}`);
  if (PARSE_ONLY) {
    console.log("\n🔎 PARSE-ONLY concluído.");
    if (rejected.length > 0) process.exit(1);
    return;
  }

  const db = getSupabase();
  const clientId = await resolveClientId(db, handle);
  if (CLIENT_ID_ARG && CLIENT_ID_ARG !== clientId) {
    throw new Error(
      `--client-id=${CLIENT_ID_ARG} não é o id de "${handle}" no banco (${clientId}). Nada foi gravado.`,
    );
  }
  console.log(
    `🆔 client_id: ${clientId}${CLIENT_ID_ARG ? " (confere com --client-id)" : ""} | impressions a partir de Visualizações: ${STORIES ? (IMPRESSIONS_MODE === "none" ? "none" : "sempre (stories)") : IMPRESSIONS_MODE}`,
  );
  const { plan, orphans } = await buildPlan(db, clientId, posts, period);
  const counts = { insert: 0, update: 0, noop: 0, reject: 0 };
  console.log("\n🗺️  Plano:");
  for (const i of plan) {
    counts[i.action]++;
    console.log(
      `   ${i.action.toUpperCase().padEnd(6)} ${i.post.storyId ?? i.post.shortcode}${i.matchedBy ? ` [casou por ${i.matchedBy}]` : ""}` +
        `${i.patch && Object.keys(i.patch).length ? " patch=" + JSON.stringify(i.patch) : ""}${i.reason ? " — " + i.reason : ""}`,
    );
    for (const d of i.divergences) console.warn(`      ↳ divergência: ${d}`);
  }
  const fills: Record<string, number> = {};
  for (const i of plan)
    for (const k of Object.keys(i.patch ?? {})) fills[k] = (fills[k] ?? 0) + 1;
  const fillsTxt = Object.entries(fills)
    .map(([k, n]) => `${k}=${n}`)
    .join(" ");
  if (fillsTxt)
    console.log(`   lacunas preenchidas (campos por post): ${fillsTxt}`);
  if (orphans.length > 0) {
    console.warn(
      `   ⚠️  ${orphans.length} post(s) do banco dentro do período do CSV SEM correspondente no arquivo:`,
    );
    for (const o of orphans)
      console.warn(
        `      · ${o.published_at} ${o.content_format} ${o.ig_post_uri}`,
      );
  }
  const totalRejected = rejected.length + counts.reject;
  console.log(
    `\n   inserir=${counts.insert} atualizar=${counts.update} sem mudança=${counts.noop} rejeitadas=${totalRejected}`,
  );

  if (!APPLY) {
    console.log(
      "\n✅ DRY RUN — nada gravado. Reexecute com --apply para gravar.",
    );
    return;
  }
  if (totalRejected > 0 && !ALLOW_PARTIAL) {
    console.error(
      "\n⛔ Há linhas rejeitadas. Nada foi gravado. Corrija o arquivo ou use --allow-partial.",
    );
    process.exit(1);
  }

  const s = db.schema("orbit");
  const { data: sess, error: sErr } = await s
    .from("ig_import_sessions")
    .upsert(
      {
        client_id: clientId,
        export_zip_hash: hash,
        export_period_start: period?.start ?? null,
        export_period_end: period?.end ?? null,
        scripts_run: [INGEST_SCRIPT_ENUM],
        files_processed: [sourceFile],
        files_missing: [],
        status: "processing",
        error_log: null,
        processed_at: null,
      },
      { onConflict: "client_id,export_zip_hash" },
    )
    .select("id")
    .single();
  if (sErr || !sess) throw new Error(`sessão: ${sErr?.message}`);
  const sessionId = String(sess.id);
  const close = async (status: "done" | "failed", log: string | null) => {
    const { error } = await s
      .from("ig_import_sessions")
      .update({
        status,
        error_log: log,
        processed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    assertNoError(error, "fechar sessão");
  };

  try {
    // 1) payload bruto (reprocessável): uma linha por post, sem duplicar
    const keys = [
      ...posts.map((p) => p.sourceKey),
      ...rejected.map((r) => r.sourceKey),
    ].filter(Boolean);
    const { data: haveRaw, error: rErr } = await s
      .from("raw_ig_ingest")
      .select("source_key")
      .eq("client_id", clientId)
      .eq("source_file", sourceFile)
      .in("source_key", keys);
    assertNoError(rErr, "leitura raw_ig_ingest");
    const haveSet = new Set((haveRaw ?? []).map((r) => String(r.source_key)));
    const rawRows = [
      ...posts
        .filter((p) => !haveSet.has(p.sourceKey))
        .map((p) => ({
          client_id: clientId,
          import_session: sessionId,
          source_file: sourceFile,
          source_key: p.sourceKey,
          ingest_script: INGEST_SCRIPT_ENUM,
          raw_payload: p.raw,
          confidence_level:
            p.format === "story" ? "L0" : p.reach !== null ? "L1" : "L0",
          parsed: true,
          parse_error: null,
          parsed_into: "ig_posts",
        })),
      ...rejected
        .filter((r) => r.sourceKey && !haveSet.has(r.sourceKey))
        .map((r) => ({
          client_id: clientId,
          import_session: sessionId,
          source_file: sourceFile,
          source_key: r.sourceKey,
          ingest_script: INGEST_SCRIPT_ENUM,
          raw_payload: r.raw,
          confidence_level: "L0",
          parsed: false,
          parse_error: r.reason,
          parsed_into: null,
        })),
    ];
    if (rawRows.length > 0) {
      const { error } = await s.from("raw_ig_ingest").insert(rawRows);
      assertNoError(error, "insert raw_ig_ingest");
    }

    // 2) posts novos
    const inserts = plan
      .filter((i) => i.action === "insert")
      .map((i) => insertPayload(clientId, sessionId, i.post));
    if (inserts.length > 0) {
      const { error } = await s.from("ig_posts").insert(inserts);
      assertNoError(error, "insert ig_posts");
    }

    // 3) posts existentes: só preenche nulos
    for (const i of plan.filter((x) => x.action === "update")) {
      const { error } = await s
        .from("ig_posts")
        .update(i.patch!)
        .eq("id", i.existing!.id)
        .eq("client_id", clientId);
      assertNoError(
        error,
        `update ig_posts ${i.post.storyId ?? i.post.shortcode}`,
      );
    }

    // 4) releitura e conferência
    const problems = await verify(db, clientId, plan);
    if (problems.length > 0)
      throw new Error(`verificação falhou: ${problems.join("; ")}`);
    await close("done", null);
    console.log(
      `\n🎉 Gravado e verificado: novos=${counts.insert} atualizados=${counts.update} raw=${rawRows.length} sessão=${sessionId}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await close("failed", msg);
    } catch (ce) {
      console.error("❌ falhou fechar sessão:", ce);
    }
    throw e;
  }
}

run().catch((err: unknown) => {
  console.error("❌ Erro:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
