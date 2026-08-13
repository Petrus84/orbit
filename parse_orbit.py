import re

def parse_sql_dump(path):
    enums = {}
    tables = {}

    with open(path, encoding="utf-8") as f:
        sql = f.read()

    # Captura enums
    for m in re.finditer(r'CREATE TYPE "orbit"\."(\w+)" AS ENUM \((.*?)\);', sql, re.S):
        enum_name = m.group(1)
        values = [v.strip(" '") for v in m.group(2).split(",")]
        enums[enum_name] = values

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
        tables[table_name] = cols

    return {"enums": enums, "tables": tables}

def parse_contract(path):
    interfaces = {}
    types = {}

    with open(path, encoding="utf-8") as f:
        text = f.read()

    # Captura enums como type alias com literais
    for m in re.finditer(r'type\s+(\w+)\s*=\s*([^\n;]+);', text):
        type_name = m.group(1)
        values = [v.strip().strip('"\'') for v in m.group(2).split("|")]
        types[type_name.lower()] = values

    # Captura interfaces (simplificado)
    for m in re.finditer(r'## (\w+) \(interface.*?\)\n((?:\|.*\n)+)', text):
        iface_name = m.group(1)
        body = m.group(2)
        fields = {}
        for line in body.splitlines():
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 3 and parts[0] != "Campo":
                fields[parts[1]] = parts[2]
        interfaces[iface_name.lower()] = fields

    return {"interfaces": interfaces, "types": types}

def compare(db, contract):
    obs = {"Alinhados": [], "Divergentes": [], "Fantasmas": []}

    # Comparar enums
    for enum_name, db_values in db["enums"].items():
        ct_values = contract["types"].get(enum_name.lower())
        if ct_values:
            for v in db_values:
                if v in ct_values:
                    obs["Alinhados"].append(f"{enum_name}.{v}")
                else:
                    obs["Divergentes"].append(f"{enum_name}.{v} — existe no DB mas não no contrato")
            for v in ct_values:
                if v not in db_values:
                    obs["Divergentes"].append(f"{enum_name}.{v} — existe no contrato mas não no DB")
        else:
            obs["Fantasmas"].append(f"{enum_name} — enum no DB sem contrato correspondente")

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
    contract = parse_contract("orbit-decls.txt")
    obs = compare(db, contract)
    gerar_relatorio(obs, "resultado_conciliacao.md")
    print("Relatório gerado em resultado_conciliacao.md")
