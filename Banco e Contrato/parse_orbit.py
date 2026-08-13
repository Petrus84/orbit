import re
import csv

# ---------------------------------------------------------------------------
# Helpers de nomenclatura
# ---------------------------------------------------------------------------

def snake_to_camel(name):
    parts = name.split('_')
    return ''.join(p.capitalize() for p in parts if p)


def maybe_singular(name):
    # heurística simples: remove 's' final se existir (ex: clients -> Client)
    if name.endswith('s') and len(name) > 3:
        return name[:-1]
    return name


# --- PATCH 1: Normalização Consistente --------------------------------------

def normalize_name(name):
    """Normaliza para lowercase para comparações"""
    return name.lower().strip()


def normalize_enum_values(values):
    """Normaliza valores de enum (lowercase, sem espaços)"""
    return [v.lower().strip() for v in values if v.strip()]


# --- PATCH 2: Busca Robusta de Interface -------------------------------------

def find_interface(table_name, interfaces):
    """Tenta múltiplas estratégias de busca"""
    candidates = [
        normalize_name(table_name),                                   # direto
        normalize_name(snake_to_camel(table_name)),                   # snake -> Camel
        normalize_name(snake_to_camel(maybe_singular(table_name))),   # singular + Camel
    ]

    for cand in candidates:
        if cand in interfaces:
            return interfaces[cand], cand

    return None, None


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def parse_sql_dump(path):
    enums = {}
    tables = {}

    with open(path, encoding="utf-8") as f:
        sql = f.read()

    # enums
    for m in re.finditer(r'CREATE TYPE\s+(?:"\w+"\.)?"?(\w+)"?\s+AS\s+ENUM\s*\((.*?)\);', sql, re.S | re.I):
        enum_name = m.group(1).lower()
        values = [v.strip(" '\"") for v in m.group(2).split(",")]
        # PATCH 1 aplicado: normaliza valores do enum no momento da captura
        enums[enum_name] = normalize_enum_values(values)

    # tables (captura colunas com tipo e nullability via pattern simples)
    for m in re.finditer(r'CREATE TABLE\s+(?:"\w+"\.)?"?(\w+)"?\s*\((.*?)\);', sql, re.S | re.I):
        table = m.group(1).lower()
        body = m.group(2)
        cols = {}
        for line in body.splitlines():
            line = line.strip().rstrip(',')
            if not line or line.upper().startswith('CONSTRAINT') or line.upper().startswith('PRIMARY KEY'):
                continue
            col_match = re.match(r'"?(\w+)"?\s+([^\s,]+)(.*)', line)
            if col_match:
                col = col_match.group(1)
                typ = col_match.group(2)
                rest = col_match.group(3)
                is_nullable = 'NOT NULL' not in rest.upper()
                cols[col] = {'db_type': typ, 'is_nullable': is_nullable, 'raw': line}
        tables[table] = cols

    return {'enums': enums, 'tables': tables}


def parse_orbit_ts(path):
    enums = {}
    interfaces = {}

    with open(path, encoding="utf-8") as f:
        ts = f.read()

    # types com literais
    for m in re.finditer(r'export\s+type\s+(\w+)\s*=\s*([^;]+);', ts):
        name = m.group(1)
        vals = [v.strip().strip('"\'') for v in m.group(2).split('|')]
        # PATCH 1 aplicado: normaliza valores do enum TS no momento da captura
        enums[name.lower()] = normalize_enum_values(vals)

    # interfaces
    for m in re.finditer(r'export\s+interface\s+(\w+)\s*\{([^}]*)\}', ts, re.S):
        name = m.group(1)
        body = m.group(2)
        fields = {}
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith('//') or ':' not in line:
                continue
            # captura "campo?: tipo" ou "campo: tipo"
            fmatch = re.match(r'(\w+)(\?)?\s*:\s*([^;]+)[,]?', line)
            if fmatch:
                fname = fmatch.group(1)
                optional = bool(fmatch.group(2))
                ftype = fmatch.group(3).strip()
                fields[fname] = {'ts_type': ftype, 'optional': optional, 'raw': line}
        interfaces[name.lower()] = fields

    return {'enums': enums, 'interfaces': interfaces}


# --- PATCH 3: Parser de Consumo (Fase NÃO CONFIRMADO) ------------------------

def parse_ts_consumption(path):
    """Extrai campos/tipos usados em queries, mutations, uso direto, etc."""
    consumption = {'queries': {}, 'mutations': {}, 'direct_usage': {}}

    with open(path, encoding="utf-8") as f:
        ts = f.read()

    # Captura uso direto: const x: TableName = {...}
    for m in re.finditer(r'const\s+\w+\s*:\s*(\w+)\s*=\s*\{([^}]*)\}', ts, re.S):
        entity = m.group(1).lower()
        body = m.group(2)
        fields = re.findall(r'(\w+)\s*:', body)
        if entity not in consumption['direct_usage']:
            consumption['direct_usage'][entity] = set()
        consumption['direct_usage'][entity].update(fields)

    # Captura queries GraphQL/REST: query GetUser { user { id name } }
    for m in re.finditer(r'(?:query|mutation)\s+\w+\s*\{([^}]*)\}', ts, re.S):
        body = m.group(1)
        fields = re.findall(r'(\w+)\s*(?:\{|$)', body)
        for f in fields:
            if f not in consumption['queries']:
                consumption['queries'][f] = set()
            consumption['queries'][f].add(f)

    return consumption


def verify_consumption(table, col, consumption):
    """Verifica se campo é consumido em algum lugar do código TS."""
    table_lower = table.lower()
    col_lower = col.lower()

    # Verifica em direct_usage
    if table_lower in consumption['direct_usage']:
        if col_lower in consumption['direct_usage'][table_lower]:
            return 'CONSUMIDO'

    # Verifica em queries
    if col_lower in consumption['queries']:
        return 'CONSUMIDO_EM_QUERY'

    return 'NAO_CONFIRMADO'


# ---------------------------------------------------------------------------
# Classificação e emissão de relatórios
# ---------------------------------------------------------------------------

# PATCH 4: classify_and_emit agora recebe `consumption` como parâmetro
def classify_and_emit(db, ts, consumption, csv_path, md_path):
    rows = []
    obs = {'Alinhados': [], 'Desalinhados': [], 'Fantasmas': [], 'NaoConfirmado': []}

    # Enums: normalizar nome snake->Camel e comparar (valores já normalizados na captura)
    for enum_db, db_vals in db['enums'].items():
        ts_key = snake_to_camel(enum_db)
        ts_vals = ts['enums'].get(normalize_name(ts_key))
        if ts_vals is None:
            obs['Fantasmas'].append(enum_db)
            rows.append([enum_db, '', 'enum', ','.join(db_vals), '', '', 'FANTASMA', 'enum no DB sem type TS'])
        else:
            # PATCH 1 aplicado: normaliza novamente por segurança antes de comparar
            db_set = set(normalize_enum_values(db_vals))
            ts_set = set(normalize_enum_values(ts_vals))
            if db_set == ts_set:
                obs['Alinhados'].append(enum_db)
                for v in sorted(db_set):
                    rows.append([enum_db, v, 'enum_value', enum_db, ts_key, '', 'CONVERGENTE', 'valor presente em ambos'])
            else:
                obs['Desalinhados'].append(enum_db)
                for v in sorted(db_set - ts_set):
                    rows.append([enum_db, v, 'enum_value', enum_db, ts_key, '', 'DESALINHADO', 'valor no DB não no TS'])
                for v in sorted(ts_set - db_set):
                    rows.append([enum_db, v, 'enum_value', enum_db, ts_key, '', 'DESALINHADO', 'valor no TS não no DB'])

    # Tabelas vs Interfaces
    for table, cols in db['tables'].items():
        # PATCH 2 aplicado: busca robusta de interface (múltiplas estratégias)
        iface, iface_name = find_interface(table, ts['interfaces'])
        if iface is None:
            obs['Fantasmas'].append(table)
            rows.append([table, '', 'table', '', '', '', 'FANTASMA', 'tabela no DB sem interface TS'])
            continue

        # comparar colunas
        for col, meta in cols.items():
            ts_field = iface.get(col)
            # PATCH 3 + 4 aplicados: verifica status de consumo no código
            consumption_status = verify_consumption(table, col, consumption)

            if ts_field:
                classificacao = 'CONVERGENTE' if consumption_status == 'CONSUMIDO' else 'NAO_CONFIRMADO'
                rows.append([
                    table, col, 'column',
                    meta['db_type'], ts_field['ts_type'],
                    str(meta['is_nullable']),
                    classificacao,
                    f'{table}.{col} existe em ambos | Status: {consumption_status}'
                ])
                if classificacao == 'CONVERGENTE':
                    obs['Alinhados'].append(f'{table}.{col}')
                else:
                    obs['NaoConfirmado'].append(f'{table}.{col}')
            else:
                rows.append([
                    table, col, 'column',
                    meta['db_type'], '',
                    str(meta['is_nullable']),
                    'DESALINHADO',
                    f'coluna no DB sem campo homônimo no TS | Status: {consumption_status}'
                ])
                obs['Desalinhados'].append(f'{table}.{col}')

        # campos TS sem coluna DB
        for field in iface:
            if field not in cols:
                rows.append([table, field, 'field', '', iface[field]['ts_type'], str(iface[field]['optional']), 'DESALINHADO', 'campo TS sem coluna DB'])
                obs['Desalinhados'].append(f'{table}.{field}')

    # export CSV
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['entidade', 'campo', 'origem', 'tipo_db', 'tipo_ts', 'is_nullable/optional', 'classificacao', 'evidencia'])
        for r in rows:
            w.writerow(r)

    # export MD resumo
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("# Resultado da Conciliação (detalhado)\n\n")
        for k in ['Alinhados', 'Desalinhados', 'Fantasmas', 'NaoConfirmado']:
            f.write(f"## {k}\n")
            items = obs.get(k, [])
            if items:
                for it in sorted(set(items)):
                    f.write(f"- {it}\n")
            else:
                f.write("- Nenhum\n")
            f.write("\n")
        f.write("CSV detalhado: " + csv_path + "\n")


if __name__ == "__main__":
    db = parse_sql_dump("dump_orbit.sql")
    ts = parse_orbit_ts("orbit.ts")
    # PATCH 4 aplicado: consumo é extraído e passado adiante
    consumption = parse_ts_consumption("orbit.ts")  # ou arquivo separado, se houver
    classify_and_emit(db, ts, consumption, "resultado_conciliacao_detalhado.csv", "resultado_conciliacao_detalhado.md")
    print("Relatórios gerados: resultado_conciliacao_detalhado.csv e resultado_conciliacao_detalhado.md")
