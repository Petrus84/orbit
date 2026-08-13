#!/usr/bin/env python3
import re

with open("src/types/orbit.ts", encoding="utf-8") as f:
    lines = f.readlines()

decls = []
i = 0
n = len(lines)

while i < n:
    line = lines[i].strip()
    m = re.match(r'^export interface (\w+)', line)
    if m:
        name = m.group(1)
        start = i
        depth = line.count('{') - line.count('}')
        j = i
        while depth > 0 and j < n - 1:
            j += 1
            depth += lines[j].count('{') - lines[j].count('}')
        block = lines[start:j+1]

        # extrair campos
        fields = []
        for b in block[1:]:
            b_strip = b.strip()
            if b_strip and not b_strip.startswith('//') and ':' in b_strip:
                # pega nome e tipo
                parts = b_strip.split(':', 1)
                field_name = parts[0].strip().rstrip(';')
                field_type = parts[1].strip().rstrip(';')
                fields.append((field_name, field_type))

        decls.append(('interface', name, start+1, j+1, fields))
        i = j + 1
        continue

    m2 = re.match(r'^export type (\w+)', line)
    if m2:
        name = m2.group(1)
        decls.append(('type', name, i+1, i+1, []))
        i += 1
        continue

    i += 1

# gerar tabela Markdown
print(f"# Orbit Types & Interfaces Detailed Report\n")
print(f"Total top-level export declarations parsed: {len(decls)}\n")

for kind, name, start, end, fields in decls:
    print(f"## {name} ({kind}, linhas {start}-{end})")
    if fields:
        print("| Campo | Tipo |")
        print("|-------|------|")
        for fname, ftype in fields:
            print(f"| {fname} | {ftype} |")
    else:
        print("_Sem campos (type alias ou vazio)_")
    print()
