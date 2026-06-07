# ORBIT · Dashboard — Arquitetura de Código

**Versão:** 1.0.0 · **Data:** 2026-06-01  
**Stack:** Next.js 14 · React 18 · TypeScript · CSS Modules · Supabase

---

## Fluxo da Informação

```
[Supabase / Views SQL]
        ↓
[instagramOverviewRepository.ts]   ← executa queries tipadas
        ↓
[useInstagramOverview.ts]          ← gerencia estado + loading + realtime
        ↓
[OrbitDashboardContext.tsx]        ← disponibiliza para a árvore React
        ↓
[instagram/index.tsx (Page)]       ← apenas renderiza, zero lógica
        ↓
[KPICard · QualityScoresPanel · FormatPerformanceTable · ...]
```

---

## Estrutura de Arquivos

```
styles/
  orbit-design-tokens.css          ← tokens canônicos (NÃO ALTERAR valores)
  orbit-globals.css                 ← reset + base (importa os tokens)

src/
  types/
    orbit.ts                        ← todos os tipos do domínio

  lib/
    supabaseClient.ts               ← singleton do cliente Supabase
    prototypeConstants.ts           ← dados hardcoded (Sprint 1)

  repositories/
    instagramOverviewRepository.ts  ← queries ao Supabase (camada de dados)

  hooks/
    useInstagramOverview.ts         ← fetch + estado + polling + realtime

  context/
    OrbitDashboardContext.tsx        ← Provider + useOrbitDashboard()

  components/
    common/
      GlassCard.tsx + .module.css   ← container neomorphic reutilizável
      StatusPill.tsx + .module.css  ← badge glowing (cyan/red/gold)

    kpi/
      KPICard.tsx + .module.css     ← card completo de métrica
      SemaphoreIndicator.tsx        ← badge circular ✓ / ⚠ / ✕
      GlowingNumber.tsx             ← número com text-shadow neon
      DeltaText.tsx                 ← ↑ cyan / ↓ red

    content/
      QualityScoresPanel.tsx        ← grade 2×2 de scores
      FormatPerformanceTable.tsx    ← tabela com StatusPill
      InsightCard.tsx               ← card de insight com 💡
      CriticalAlert.tsx             ← alerta full-width com glow

    layout/
      Sidebar.tsx + .module.css     ← 240px fixed, 3 seções de nav
      Header.tsx + .module.css      ← 60px fixed, 3 abas exatas

  pages/
    _app.tsx                        ← entry Next.js (importa globals)
    instagram/
      index.tsx                     ← página principal
      InstagramOverviewPage.module.css
```

---

## Como Usar (Sprint 1 — dados hardcoded)

1. Clone o projeto e instale as dependências:
   ```bash
   npm install @supabase/supabase-js next react react-dom
   npm install -D typescript @types/react @types/node
   ```

2. Crie o `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
   ```

3. Importe os tokens no `_app.tsx` (já feito).

4. Acesse `/instagram` — verá os dados do protótipo.

---

## Migrar para Supabase Real (Sprint 2)

No arquivo `src/pages/instagram/index.tsx`, mude:

```tsx
// DE:
usePrototypeData={true}

// PARA:
usePrototypeData={false}
```

O Repository vai automaticamente buscar das views:
- `v_kpi_snapshots` → KPI Cards
- `v_quality_scores` → Scores de Qualidade
- `v_format_performance` → Tabela de Formatos
- `alerts` → Alertas Críticos

---

## Design Tokens

Todos os tokens ficam em `styles/orbit-design-tokens.css`.  
**Regra:** nunca use valores hexadecimais hardcoded nos componentes — use sempre `var(--nome-do-token)`.

### Tokens Principais

| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#0D1117` | Background principal |
| `--bg-card` | `#0F1419` | Cards |
| `--neon-cyan` | `#00FFFF` | Positivo, glow |
| `--neon-red` | `#FF4136` | Negativo, alertas |
| `--neon-gold` | `#FFC300` | Atenção |
| `--font-mono` | `Space Mono` | Números KPI |
| `--font-family` | `Syne` | Texto UI |

---

## Semáforos

| Estado | Ícone | Cor |
|---|---|---|
| `verde` | ✓ | `#00FF00` |
| `ambar` | ⚠ | `#FFC300` |
| `vermelho` | ✕ | `#FF4136` |
