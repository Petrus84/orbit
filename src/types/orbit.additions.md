# Adições em `src/types/orbit.ts` (aplicar ANTES dos outros arquivos)

O `orbit.ts` não veio no zip, então estas adições são manuais. Todas as novas
chaves de `PostingCadence` são opcionais (não quebram quem constrói o objeto
sem elas); as de `BenchmarkCadence` são obrigatórias porque o repository sempre
as preenche.

```ts
export interface PostingCadence {
  // ...campos existentes (postsPerWeek, nPosts, windowDays, reason, weeksPerPost)

  // Cadência no span ativo — mesma régua de v_benchmark_cadence_by_segment.
  activeSpanDays?: number | null;
  postsPerWeekActive?: number | null; // null = sem base (< 5 posts ou < 28 dias)
  weeksPerPostActive?: number | null;
  firstPostOn?: string | null; // 'YYYY-MM-DD'
  lastPostOn?: string | null; // 'YYYY-MM-DD'
  collectedOn?: string | null; // 'YYYY-MM-DD' — âncora da recência
  daysLastPostToCollection?: number | null;
}

export interface BenchmarkCadence {
  // ...campos existentes (segmentCategory, periodStart, periodEnd, windowDays,
  //    benchmarkAccountsTotal, accountsWithPosts, postsTotal,
  //    meanPostsPerDay, medianPostsPerDay, p25PostsPerDay, p75PostsPerDay)

  eligibleAccounts: number;
  recentAccounts: number;
  recencyThresholdDays: number;
  meanPostsPerWeek: number;
  medianPostsPerWeek: number;
  p25PostsPerWeek: number;
  p75PostsPerWeek: number;
  medianPostsPerWeekRecent: number | null;
  p25PostsPerWeekRecent: number | null;
  p75PostsPerWeekRecent: number | null;
  medianDaysLastPostToCollection: number | null;
}
```

Se `IGOverviewData.benchmarkCadence` já aponta para `BenchmarkCadence`, nada mais
muda. O repository ainda declara um `BenchmarkCadence` local (duplicado); ele foi
estendido com os mesmos campos para continuar compatível estruturalmente.
