import type { Database } from "./supabase";
import * as OrbitTypes from "./orbit";

// Utilitário para extrair nomes de tabelas do Supabase
type SupabaseTables = keyof Database["public"]["Tables"];

function listSupabaseSchema(): { tableName: string; columns: string[] }[] {
  type Tables = Database["public"]["Tables"];
  return Object.entries({} as Tables).map(([tableName]) => ({
    tableName,
    // não temos valores em runtime, então só listamos nomes via type
    columns: Object.keys(({} as Tables)[tableName]["Row"] ?? {})
  }));
}

function listOrbitSchema(): { tableName: string; columns: string[] }[] {
  return Object.entries(OrbitTypes).map(([tableName, def]) => ({
    tableName,
    columns: Object.keys(def as Record<string, unknown>)
  }));
}

function main() {
  const supabaseSchema = listSupabaseSchema();
  const orbitSchema = listOrbitSchema();

  supabaseSchema.forEach(({ tableName, columns }) => {
    const orbitTable = orbitSchema.find(t => t.tableName === tableName);
    if (!orbitTable) {
      console.log(`⚠️ Tabela ${tableName} existe no Supabase mas não no Orbit`);
      return;
    }

    const missingInOrbit = columns.filter(c => !orbitTable.columns.includes(c));
    const extraInOrbit = orbitTable.columns.filter(c => !columns.includes(c));

    if (missingInOrbit.length > 0) {
      console.log(`🚨 Campos faltando em Orbit.${tableName}: ${missingInOrbit.join(", ")}`);
    }
    if (extraInOrbit.length > 0) {
      console.log(`⚠️ Campos extras em Orbit.${tableName} (não existem no Supabase): ${extraInOrbit.join(", ")}`);
    }
  });
}

main();
