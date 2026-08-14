// src/types/parsesupabase.ts
import { Project, SyntaxKind, TypeGuards } from "ts-morph";

export type SupaParseResult = {
  tables: Record<string, string[]>;
  enums: Record<string, string[]>;
};

function normalizeName(s: string) {
  return s.replace(/[_-]/g, "").replace(/s$/i, "").toLowerCase();
}

function safeIndex(obj: unknown, key: string): unknown {
  const dict = obj as unknown as Record<string, unknown>;
  return dict ? dict[key] : undefined;
}

/**
 * Tenta descer em `Database.public.Tables` usando ts-morph.
 * Retorna um mapa { tableName: [col1, col2, ...] } e enums { name: [lit1, lit2] }.
 */
export function parseSupabaseFile(filePath: string): SupaParseResult {
  const project = new Project({ tsConfigFilePath: undefined });
  const sf = project.addSourceFileAtPath(filePath);

  const tables: Record<string, string[]> = {};
  const enums: Record<string, string[]> = {};

  // 1) localizar type/interface Database
  const dbAlias = sf.getTypeAlias("Database") || sf.getInterface("Database");
  if (dbAlias) {
    const dbTypeNode = dbAlias.getTypeNode?.();
    if (dbTypeNode) {
      // procurar propriedade "public"
      const publicProp = dbTypeNode.getFirstDescendant(d =>
        TypeGuards.isPropertySignature(d) && d.getName() === "public"
      );
      if (publicProp) {
        // dentro de public procurar "Tables"
        const tablesProp = publicProp.getFirstDescendant(d =>
          TypeGuards.isPropertySignature(d) && d.getName() === "Tables"
        );
        if (tablesProp) {
          // se Tables for um TypeLiteral, extrair propriedades
          const typeLit = tablesProp.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
          if (typeLit) {
            const props = typeLit.getProperties();
            props.forEach(p => {
              const name = p.getName();
              // tentar achar Row dentro do tipo da propriedade
              const rowNode = p.getFirstDescendant(d => TypeGuards.isPropertySignature(d) && d.getName() === "Row");
              if (rowNode) {
                // extrair propriedades internas do Row
                const rowTypeLit = rowNode.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
                if (rowTypeLit) {
                  const cols = rowTypeLit.getProperties().map(x => x.getName());
                  tables[name] = cols;
                } else {
                  // fallback: tentar extrair via texto (heurística)
                  const txt = rowNode.getText();
                  const cols = Array.from(txt.matchAll(/([A-Za-z0-9_]+)\s*:/g)).map(m => m[1]);
                  if (cols.length) tables[name] = cols;
                }
              } else {
                // se não há Row, tentar extrair propriedades diretas (caso o generator use outro formato)
                const propTypeLit = p.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
                if (propTypeLit) {
                  const cols = propTypeLit.getProperties().map(x => x.getName());
                  if (cols.length) tables[name] = cols;
                }
              }
            });
          }
        }
      }
    }
  }

  // 2) extrair type aliases que são unions de literais (possíveis enums)
  sf.getTypeAliases().forEach(ta => {
    const tn = ta.getTypeNode();
    if (!tn) return;
    if (tn.getKind() === SyntaxKind.UnionType) {
      const members = (tn as any).getTypeNodes?.() ?? [];
      const lits: string[] = [];
      members.forEach((m: any) => {
        const txt = m.getText?.();
        if (typeof txt === "string" && /^'/.test(txt)) {
          lits.push(txt.replace(/^'|'$/g, ""));
        }
      });
      if (lits.length) enums[ta.getName()] = lits;
    }
  });

  // 3) heurística textual para tipos com pattern `export type X = { Row: { ... } }`
  const text = sf.getFullText();
  const tableRowRegex = /export type\s+([A-Za-z0-9_]+)\s*=\s*{\s*Row:\s*{([\s\S]*?)\}\s*}/g;
  let m;
  while ((m = tableRowRegex.exec(text)) !== null) {
    const name = m[1];
    const body = m[2];
    const cols = Array.from(body.matchAll(/([A-Za-z0-9_]+)\s*:/g)).map(x => x[1]);
    if (cols.length) tables[name] = cols;
  }

  return { tables, enums };
}
