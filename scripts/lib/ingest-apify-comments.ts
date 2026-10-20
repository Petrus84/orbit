// ingest-apify-comments.ts — orbit v1.0.0
// Grava em orbit.ig_post_comments o TEXTO dos comentários (latestComments) de um dataset
// do Apify instagram-scraper. Casa por (client_id, ig_shortcode) com orbit.ig_posts.
//
// Regras:
//  - Dry-run por padrão. Só grava com --apply.
//  - Só grava comentário de post que JÁ existe em ig_posts (casa por shortcode); o resto vai pro relatório.
//  - Idempotente: (client_id, ig_comment_id) único; reexecutar não duplica.
//  - Autor vira hash (precisa COMMENT_HASH_SALT no .env.local). Sem @, sem foto.
//  - Comentário do dono fica gravado com is_owner_reply=true (a classificação deve ignorá-lo).
//  - Amostra: o scraper entrega no máximo ~15 comentários recentes por post, não o total.
//
// Uso:
//   npx tsx scripts/ingest-apify-comments.ts --file C:/.../dataset.json --handles a.c_enxovais,cpimportstore
//   npx tsx scripts/ingest-apify-comments.ts --file ... --handles caiopanighel --alias=caiopanighel=djcaiodogao --apply
//   (--handles usa o nome do ARQUIVO; --alias traduz para o handle do BANCO)
//
// Cliente sem ig_shortcode no banco (eupetruchio84, mauricioartphoto): rode antes
//   ingest-apify-reel-views.ts --match=date --backfill-shortcode

import dotenv from "dotenv";
import * as fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { resolveClientId } from "./resolveClientId";
import {
  buildRows,
  qualifiedPosts,
  type ApifyPost,
  type CommentRow,
} from "./apify-comments";

dotenv.config({ path: ".env.local" });

function argVal(flag: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(`--${flag}`);
  const next = process.argv[idx + 1];
  if (idx >= 0 && next && !next.startsWith("--")) return next;
  return undefined;
}

const FILE = argVal("file");
const HANDLES = (argVal("handles") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const APPLY = process.argv.includes("--apply");
const SALT = process.env.COMMENT_HASH_SALT;
const ALIASES = new Map<string, string>(
  process.argv
    .filter((a) => a.startsWith("--alias="))
    .map((a) => a.slice(8).split("=") as [string, string]),
);

if (!FILE || !fs.existsSync(FILE)) {
  console.error("❌ --file obrigatório e precisa existir");
  process.exit(1);
}
if (HANDLES.length === 0) {
  console.error(
    "❌ --handles obrigatório (nome do ARQUIVO, separado por vírgula)",
  );
  process.exit(1);
}
if (!SALT) {
  console.error(
    "❌ defina COMMENT_HASH_SALT em .env.local (segredo longo e fixo; trocar quebra o hash dos autores)",
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const items: ApifyPost[] = JSON.parse(fs.readFileSync(FILE!, "utf-8"));
  console.log(
    `${APPLY ? "🟢 APPLY" : "🟡 DRY-RUN"} — ${items.length} posts no arquivo\n`,
  );

  for (const fileHandle of HANDLES) {
    const dbHandle = ALIASES.get(fileHandle) ?? fileHandle;
    const posts = items.filter((p) => p.ownerUsername === fileHandle);
    if (posts.length === 0) {
      console.log(`⚠️  ${fileHandle}: nenhum post no arquivo`);
      continue;
    }

    const clientId = await resolveClientId(supabase, dbHandle);
    const { data: dbPosts, error } = await supabase
      .schema("orbit")
      .from("ig_posts")
      .select("id, ig_shortcode")
      .eq("client_id", clientId)
      .not("ig_shortcode", "is", null);
    if (error) {
      console.error(`❌ ${dbHandle}: ${error.message}`);
      continue;
    }
    const byCode = new Map(
      (dbPosts ?? []).map((r) => [r.ig_shortcode as string, r.id as string]),
    );

    const rows: CommentRow[] = [];
    let matched = 0,
      unmatchedWithComments = 0;
    for (const p of posts) {
      const postId = p.shortCode ? byCode.get(p.shortCode) : undefined;
      if (!postId) {
        if ((p.latestComments ?? []).length > 0) unmatchedWithComments++;
        continue;
      }
      matched++;
      rows.push(...buildRows(p, clientId, postId, dbHandle, SALT!));
    }

    console.log(
      `── ${dbHandle}${dbHandle !== fileHandle ? ` (arquivo: ${fileHandle})` : ""}`,
    );
    console.log(
      `   posts no arquivo: ${posts.length} | casados com ig_posts: ${matched} | sem correspondência (com comentários): ${unmatchedWithComments}`,
    );
    console.log(
      `   comentários a gravar: ${rows.length} (do dono: ${rows.filter((r) => r.is_owner_reply).length})`,
    );
    console.log(
      `   posts com ≥3 comentários de terceiros: ${qualifiedPosts(rows)}  (régua exige ≥5 desses para calcular)`,
    );
    if (byCode.size === 0)
      console.log(
        "   ⚠️  cliente sem ig_shortcode no banco: rode ingest-apify-reel-views --match=date --backfill-shortcode antes",
      );

    if (APPLY && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error: e } = await supabase
          .schema("orbit")
          .from("ig_post_comments")
          .upsert(rows.slice(i, i + 500), {
            onConflict: "client_id,ig_comment_id",
            ignoreDuplicates: true,
          });
        if (e) {
          console.error(`   ❌ upsert: ${e.message}`);
          break;
        }
      }
      console.log("   ✅ gravado");
    }
    console.log();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
