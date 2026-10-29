// ============================================================================
// check-ingestion.ts
// Consulta as ingestões mais recentes em orbit.raw_ig_ingest.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "../../src/types/database.types.ts";

dotenv.config({ path: ".env.local" });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function parseLimit(raw: string | undefined): number {
  const limit = raw === undefined ? 200 : Number(raw);

  if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) {
    throw new Error("INGEST_CHECK_LIMIT deve ser um inteiro entre 1 e 5000.");
  }

  return limit;
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const limit = parseLimit(process.env.INGEST_CHECK_LIMIT);

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main(): Promise<void> {
  console.log("Verificando as ingestões mais recentes...\n");

  const { data, error, count } = await supabase
    .schema("orbit")
    .from("raw_ig_ingest")
    .select(
      `
        id,
        client_id,
        import_session,
        ingested_at,
        source_file,
        source_key,
        ingest_script,
        confidence_level,
        parsed,
        parse_error,
        parsed_into,
        client:clients!raw_ig_ingest_client_id_fkey(handle)
      `,
      { count: "exact" },
    )
    .order("ingested_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Falha ao consultar orbit.raw_ig_ingest (${error.code}): ${error.message}`,
    );
  }

  const rows = data ?? [];

  console.log(`Total correspondente à consulta: ${count ?? "desconhecido"}`);
  console.log(`Exibindo até ${limit} registro(s) mais recente(s).\n`);

  if (rows.length === 0) {
    console.log("Nenhum registro encontrado em orbit.raw_ig_ingest.");
    return;
  }

  console.table(
    rows.map((row) => ({
      id: `${row.id.slice(0, 8)}…`,
      handle: row.client?.handle ?? `${row.client_id.slice(0, 8)}…`,
      ingest_script: row.ingest_script,
      source_file: row.source_file,
      ingested_at: row.ingested_at,
      parsed: row.parsed,
      ingest_confidence: row.confidence_level,
      parse_error: row.parse_error?.replace(/\s+/g, " ").slice(0, 160) ?? "",
      parsed_into: row.parsed_into,
    })),
  );
}

void main().catch((error: unknown) => {
  console.error(
    "Erro ao verificar ingestões:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
