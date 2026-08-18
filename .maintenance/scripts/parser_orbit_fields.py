#!/usr/bin/env python3
import re
from collections import defaultdict

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
        # contar campos dentro do bloco
        block = lines[start:j+1]
        field_count = 0
        for b in block[1:]:
            b_strip = b.strip()
            if b_strip and not b_strip.startswith('//') and ':' in b_strip:
                field_count += 1
        decls.append(('interface', name, start+1, j+1, field_count))
        i = j + 1
        continue
    m2 = re.match(r'^export type (\w+)', line)
    if m2:
        name = m2.group(1)
        decls.append(('type', name, i+1, i+1, 1))
        i += 1
        continue
    i += 1

# detectar duplicatas
names = defaultdict(list)
for kind, name, start, end, fields in decls:
    names[name].append((kind, start, end, fields))

duplicates = {name: entries for name, entries in names.items() if len(entries) > 1}

# gerar tabela Markdown
print(f"# Orbit Types & Interfaces Report\n")
print(f"Total top-level export declarations parsed: {len(decls)}\n")
print("| Nome | Tipo | Linhas | Campos | Duplicata |")
print("|------|------|--------|--------|-----------|")
for kind, name, start, end, fields in decls:
    dup_flag = "⚠️" if name in duplicates else ""
    print(f"| {name} | {kind} | {start}-{end} | {fields} | {dup_flag} |")

if duplicates:
    print("\n## Duplicatas detectadas\n")
    for name, entries in duplicates.items():
        print(f"- **{name}** aparece {len(entries)} vezes:")
        for kind, start, end, fields in entries:
            print(f"  - {kind} linhas {start}-{end} ({fields} campos)")
