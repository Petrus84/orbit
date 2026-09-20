# Orbit v41 — Motor Psicográfico (arquivado)

**Status:** descontinuado como diferencial em ADR-011 (20/09/2026). Nada foi deletado.

**Conteúdo**
- `orbit_v41.py`, `load_real_data.py`, `run_all.py`: motor Python isolado (não roda dentro do app Next.js; lê JSON de export local).
- `dados_psicograficos_export_20260920.json`: backup dos campos Panksepp/Schwartz de `client_onboarding` (cpimportstore e eupetruchio84 — os únicos com dado), gerado antes de qualquer `DROP COLUMN`.

**Motivo (evidência reportada pelo Lobo em 20/09/2026, não reproduzida ao arquivar)**
- léxico PT-BR de 150 termos deixava ~79% dos posts sem sinal;
- correlação fraca com o ER real (r ≈ 0,12 no melhor caso) e amostra pequena (n ≤ 26).

**Reativar:** só se houver léxico expandido e amostra maior (n > 50). No app, `SHOW_PSYCHOGRAPHY` em `src/lib/onboarding/flags.ts` volta a exibir as seções.
