# Validação de Ingestão — Sumário Final

**Data:** 2026-07-08  
**Status:** ❌ **FALHOU** — Lacuna crítica encontrada (P-011)

---

## Achados

### ✅ Validações Confirmadas (no JSON)

| Premissa | Status | Evidência |
|----------|--------|-----------|
| **P-002** | ✅ CONFIRMADA | 24/24 posts no JSON têm `likes_count: 0`, `comments_count: 0`, `video_play_count: null` |
| **P-003** | ✅ CONFIRMADA | 24/24 posts têm `posted_at` preenchido (ISO 8601); nenhum será pulado por timestamp |

### ❌ Achado Crítico (P-011)

| Métrica | JSON | Banco | Delta |
|---------|------|-------|-------|
| **Posts totais** | 24 | 0 | **−24** ❌ |
| **Cliente A (cpimportstore)** | 6 | 0 | **−6** ❌ |
| **Cliente B (eupetruchio84)** | 18 | 0 | **−18** ❌ |

**Classificação:** `NOT EXPLAINED BY P-001, P-002, P-003` → Abrir **P-011**

---

## Critério de Sucesso (do Plano de Ação)

**Original:** "100% das diferenças de contagem mapeadas a uma premissa documentada ou a um item novo de lacuna"

**Status:** ⏳ **PARCIALMENTE ATENDIDO**
- ✅ P-002 mapeada (ausência de métricas explicada)
- ✅ P-003 mapeada (timestamp válido, nenhum skip esperado)
- ❌ P-011 encontrada mas **CAUSA RAIZ AINDA DESCONHECIDA**
  - 24 posts não explicados por P-001/P-002/P-003
  - Hipóteses: ingestão não rodou, erro silencioso, client_id mismatch, período, ou deletados

---

## Próximos Passos Obrigatórios

1. **Executar P-011 Diagnostic Queries** (veja `P-011-DIAGNOSTIC-QUERIES.md`)
2. **Identificar qual hipótese (H1–H5) é a causa**
3. **Documentar revisão de P-011** com causa raiz confirmada
4. **Executar correção** (re-ingestão, data fix, script fix)
5. **Re-validar** a contagem de posts no banco

---

## Arquivos Relacionados

- `AUDIT-INGESTION-VALIDATION.md` — Relatório original (JSON vs. banco esperado)
- `AUDIT-INGESTION-RESULT-CORRECTED.md` — Resultado real do banco (0 posts)
- `P-011-DIAGNOSTIC-QUERIES.md` — Queries SQL para diagnóstico
- `audit-ingestion-json-analysis.json` — Análise estrutural do JSON

---

## Conclusão

A validação de ingestão **não pode ser considerada fechada** até que P-011 seja resolvida e a causa raiz da perda de 24 posts seja identificada e corrigida. O "problema de consumo de dados" mencionado no documento de sprint review está **confirmado em nível de Camada 1 (Ingestão Bruta)**, não em camadas posteriores.

Recomendação: Parar auditoria das camadas 2–5 até P-011 ser resolvida, pois dados vazios na Camada 1 cascatearão para todas as camadas seguintes.
