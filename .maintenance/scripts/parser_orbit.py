import re

def snake_to_camel(name):
    return ''.join(part.capitalize() for part in name.split('_'))

def parse_sql_dump(path):
    enums = {}
    tables = {}

    with open(path, encoding="utf-8") as f:
        sql = f.read()

    # Captura enums
    for m in re.finditer(r'CREATE TYPE "orbit"\."(\w+)" AS ENUM \((.*?)\);', sql, re.S):
        enum_name = m.group(1)
        values = [v.strip(" '") for v in m.group(2).split(",")]
        enums[enum_name.lower()] = values

    # Captura tabelas (simplificado)
    for m in re.finditer(r'CREATE TABLE "orbit"\."(\w+)" \((.*?)\);', sql, re.S):
        table_name = m.group(1)
        cols_raw = m.group(2).split(",")
        cols = {}
        for c in cols_raw:
            parts = c.strip().split()
            if len(parts) >= 2:
                col_name = parts[0].strip('"')
                col_type = parts[1]
                cols[col_name] = col_type
        tables[table_name.lower()] = cols

    return {"enums": enums, "tables": tables}

def parse_orbit_ts(path):
    enums = {}
    interfaces = {}

    with open(path, encoding="utf-8") as f:
        ts = f.read()

    # Captura types com literais
    for m in re.finditer(r'export type (\w+) = ([^\n]+)', ts):
        type_name = m.group(1).lower()
        values = [v.strip(" '\"") for v in m.group(2).split("|")]
        enums[type_name] = values

    # Captura interfaces
    for m in re.finditer(r'export interface (\w+) \{([^}]*)\}', ts, re.S):
        iface_name = m.group(1).lower()
        body = m.group(2)
        fields = {}
        for line in body.splitlines():
            line = line.strip()
            if ":" in line:
                parts = line.split(":")
                field = parts[0].strip()
                tipo = parts[1].strip().rstrip(",")
                fields[field] = tipo
        interfaces[iface_name] = fields

    return {"enums": enums, "interfaces": interfaces}

def compare(db, ts):
    obs = {"Alinhados": [], "Divergentes": [], "Fantasmas": []}

    # Comparar enums
    for enum_name, db_values in db["enums"].items():
        ct_values = ts["enums"].get(enum_name)
        if ct_values:
            for v in db_values:
                if v in ct_values:
                    obs["Alinhados"].append(f"{enum_name}.{v}")
                else:
                    obs["Divergentes"].append(f"{enum_name}.{v} — existe no DB mas não no TS")
            for v in ct_values:
                if v not in db_values:
                    obs["Divergentes"].append(f"{enum_name}.{v} — existe no TS mas não no DB")
        else:
            obs["Fantasmas"].append(f"{enum_name} — enum no DB sem contrato correspondente")

    # Comparar tabelas vs interfaces (simplificado: só nomes)
    for table_name, cols in db["tables"].items():
        iface = ts["interfaces"].get(table_name)
        if iface:
            for col in cols:
                if col in iface:
                    obs["Alinhados"].append(f"{table_name}.{col}")
                else:
                    obs["Fantasmas"].append(f"{table_name}.{col} — coluna no DB sem campo no TS")
            for field in iface:
                if field not in cols:
                    obs["Fantasmas"].append(f"{table_name}.{field} — campo no TS sem coluna no DB")
        else:
            obs["Fantasmas"].append(f"{table_name} — tabela no DB sem interface correspondente")

    return obs

def gerar_relatorio(obs, output_path):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Resultado da Conciliação\n\n")
        f.write("## Observações\n")
        for cat, itens in obs.items():
            f.write(f"### {cat}\n")
            if itens:
                for item in itens:
                    f.write(f"- {item}\n")
            else:
                f.write("- Nenhum\n")
            f.write("\n")

        f.write("## Sugestões\n")
        f.write("- Atualizar contrato ou evoluir schema conforme divergências listadas.\n")
        f.write("- Revisar campos fantasmas e decidir SSOT.\n\n")

        f.write("## Decisão SSOT\n")
        f.write("- Contrato é SSOT: depende\n")
        f.write("- Dump é SSOT: depende\n")
        f.write("- Itens bloqueadores: ver Divergentes acima\n")

if __name__ == "__main__":
    db = parse_sql_dump("dump_orbit.sql")
    ts = parse_orbit_ts("orbit.ts")
    obs = compare(db, ts)
    gerar_relatorio(obs, "resultado_conciliacao.md")
    print("Relatório gerado em resultado_conciliacao.md")
