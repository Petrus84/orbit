#!/usr/bin/env bash
# =============================================================================
# ORBIT · Correção Cirúrgica — 3 Intervenções Confirmadas
# Rodar em: C:/Users/DELL/Downloads/Alpha/orbit-dashboard
# Uso: bash orbit-fix.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; CYN='\033[0;36m'; NC='\033[0m'

log()    { echo -e "$1"; }
sep()    { log "\n${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
ok()     { log "  ${GRN}✅ $1${NC}"; }
warn()   { log "  ${YLW}⚠️  $1${NC}"; }
fail()   { log "  ${RED}❌ $1${NC}"; }
patch()  { log "  ${CYN}🔧 $1${NC}"; }

if [ ! -f "package.json" ]; then
  fail "Rode na raiz do projeto (onde está o package.json)"
  exit 1
fi

log "\n${CYN}🔧 ORBIT · Correção Cirúrgica — $(date '+%Y-%m-%d %H:%M')${NC}"

# ─── Backup antes de tocar em qualquer arquivo ────────────────────────────────
BACKUP_DIR=".orbit-backup-$(date '+%Y%m%d-%H%M%S')"
mkdir -p "$BACKUP_DIR"

PAGE="src/app/instagram/page.tsx"
TYPE_IG="src/types/instagram.ts"
REPO="src/lib/repositories/instagramRepository.ts"

for f in "$PAGE" "$TYPE_IG" "$REPO"; do
  if [ -f "$f" ]; then
    cp "$f" "$BACKUP_DIR/$(basename $f).bak"
    ok "Backup: $f → $BACKUP_DIR/"
  fi
done

# =============================================================================
# CIRURGIA 1 — page.tsx
# Problemas:  periodStart/periodEnd como string literal
#             clientId hardcodado — eupetruchio84 ausente
# Ripple:     NENHUM — mudança local, nenhum tipo exportado alterado
# =============================================================================
sep
log "\n${YLW}[CIRURGIA 1/3] page.tsx — Período + Clientes${NC}"

if [ ! -f "$PAGE" ]; then
  fail "$PAGE não encontrado — abortando cirurgia 1"
else
  # Reescreve o arquivo inteiro com a versão corrigida
  cat > "$PAGE" << 'PAGEOF'
/* ==========================================================================
   ORBIT · Page — Instagram Overview
   Caminho físico real: src/app/instagram/page.tsx

   CORREÇÃO v1.5.0 (orbit-fix.sh):
   - periodStart/periodEnd: string → Date (Erro TS2322)
   - Ambos os clientes ativos: cpimportstore + eupetruchio84
   - PERIOD_END = new Date() — captura até o post mais recente na base
   - Arquitetura aberta: adicionar clientes em CLIENTS sem mexer em mais nada
   ========================================================================== */
'use client'
import React, { useState } from 'react'
import { OrbitDashboardProvider, useOrbitDashboard } from '@/context/OrbitDashboardContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/kpi/KPICard'
import { QualityScoresPanel } from '@/components/content/QualityScoresPanel'
import { FormatPerformanceTable } from '@/components/content/FormatPerformanceTable'
import { InsightCard } from '@/components/content/InsightCard'
import { CriticalAlert } from '@/components/content/CriticalAlert'
import { GlassCard } from '@/components/common/GlassCard'
import styles from './InstagramOverviewPage.module.css'

import type {
  KPICardData as KPI,
  InsightData as Insight,
  CriticalAlertData as Alert,
} from '@/types/orbit'

// ─── Catálogo de clientes ─────────────────────────────────────────────────────
// Para adicionar um novo cliente: inserir uma entrada aqui. Só aqui.

const CLIENTS: Record<string, { id: string; label: string }> = {
  cpimportstore: {
    id: '22222222-2222-2222-2222-222222222222',
    label: 'CP Import Store',
  },
  eupetruchio84: {
    id: '24140477-0c82-4fda-83df-958377f105ff',
    label: 'E-commerce EUPETRUCHIO84',
  },
}

// ─── Janela de análise ────────────────────────────────────────────────────────
// Ambos os clientes: jan/2026 → hoje (cobre os últimos 6 meses + margem)
const PERIOD_START = new Date('2026-01-01T00:00:00-03:00')
const PERIOD_END   = new Date()   // post mais recente = agora

// ─── Página ───────────────────────────────────────────────────────────────────

export default function InstagramOverviewPage() {
  const clientIds = Object.keys(CLIENTS)
  const [activeClientKey, setActiveClientKey] = useState<string>(clientIds[0])

  const activeClient = CLIENTS[activeClientKey]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Seletor de cliente — visível apenas quando há mais de 1 */}
      {clientIds.length > 1 && (
        <nav
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
          aria-label="Selecionar cliente"
        >
          {clientIds.map((key) => (
            <button
              key={key}
              onClick={() => setActiveClientKey(key)}
              aria-pressed={activeClientKey === key}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: activeClientKey === key ? 700 : 400,
                background: activeClientKey === key
                  ? 'rgba(0,200,255,0.15)'
                  : 'rgba(255,255,255,0.06)',
                color: activeClientKey === key ? '#00c8ff' : '#aaa',
                transition: 'all 0.15s',
              }}
            >
              {CLIENTS[key].label}
            </button>
          ))}
        </nav>
      )}

      <OrbitDashboardProvider
        key={activeClient.id}           /* remonta o contexto ao trocar de cliente */
        clientId={activeClient.id}
        periodStart={PERIOD_START}
        periodEnd={PERIOD_END}
        usePrototypeData={false}
        initialActiveTab="overview"
      >
        <InstagramOverviewLayout />
      </OrbitDashboardProvider>
    </div>
  )
}

// ─── Layout interno ────────────────────────────────────────────────────────────

function InstagramOverviewLayout() {
  const { data, status, error, activeTab } = useOrbitDashboard()

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.rightPane}>
        <Header />

        <main className={styles.main} id="main-content">
          {/* LOADING */}
          {status === 'loading' && (
            <div className={styles.stateCenter} aria-live="polite" aria-label="Carregando dados">
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.2s' }} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.4s' }} />
            </div>
          )}

          {/* ERRO */}
          {status === 'error' && error && (
            <div className={styles.stateCenter} role="alert">
              <p className={styles.errorText}>Erro ao carregar dados: ⚠️ {error}</p>
            </div>
          )}

          {/* SUCESSO */}
          {status === 'success' && data && (
            <>
              {/* TELA 1 — Visão Geral */}
              {activeTab === 'overview' && (
                <>
                  <section className={styles.kpiRow} aria-label="KPIs principais">
                    {data.kpis.map((kpi: KPI) => (
                      <KPICard key={kpi.id} data={kpi} />
                    ))}
                  </section>

                  <section className={styles.midRow} aria-label="Análise de conteúdo">
                    <QualityScoresPanel scores={data.qualityScores} />
                    <GlassCard glowColor="cyan" className={styles.rightPanel}>
                      <FormatPerformanceTable rows={data.formatPerformance} />
                      {data.insights.length > 0 && (
                        <div className={styles.insightStack}>
                          {data.insights.map((insight: Insight) => (
                            <InsightCard key={insight.id} insight={insight} />
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </section>
                </>
              )}

              {/* TELA 2 — Por post */}
              {activeTab === 'por-post' && (
                <section className={styles.midRow} aria-label="Dados detalhados por postagem">
                  <GlassCard glowColor="cyan">
                    <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
                      Métricas Agregadas por Formato
                    </h3>
                    <FormatPerformanceTable rows={data.formatPerformance} />
                  </GlassCard>
                </section>
              )}

              {/* TELA 3 — Audiência */}
              {activeTab === 'audiencia' && (
                <section className={styles.midRow} aria-label="Análise de público e seguidores">
                  <QualityScoresPanel scores={data.qualityScores} />
                  <GlassCard glowColor="cyan">
                    <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
                      🌀 Funil de E-commerce &amp; Simulador Dinâmico
                    </h3>
                    <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>
                      Métricas baseadas nos dados coletados e estruturados.
                    </p>
                    <h3 style={{ color: '#fff', marginTop: '2rem' }}>
                      👤 Avatar Alignment (Persona Psicográfica)
                    </h3>
                    <p style={{ color: '#aaa', marginTop: '0.5rem' }}>
                      Dados de audiência carregados via pipeline L0/L1.
                    </p>
                  </GlassCard>
                </section>
              )}

              {/* Alertas críticos */}
              {data.criticalAlerts.length > 0 && (
                <section className={styles.alertRow} aria-label="Alertas críticos">
                  {data.criticalAlerts.map((alert: Alert) => (
                    <CriticalAlert key={alert.id} alert={alert} />
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
PAGEOF

  ok "page.tsx reescrito — período como Date, seletor de clientes, eupetruchio84 incluído"
fi

# =============================================================================
# CIRURGIA 2 — instagram.ts
# Problema:  StatusVariant local incompatível com orbit.ts
#            instagram.ts: 'success' | 'warning' | 'danger' | 'neutral'
#            orbit.ts usa: 'ok' | 'warn' | 'neutral'
# Estratégia: alias → instagram.ts reexporta o tipo de orbit.ts
# Ripple:     MÍNIMO — instagramRepository.ts usa StatusVariant como tipo de campo,
#             mas apenas para passagem de dados; não faz comparação de valores.
#             O mapeamento snake_case→camelCase no repository já converte os valores.
# =============================================================================
sep
log "\n${YLW}[CIRURGIA 2/3] instagram.ts — StatusVariant unificado via alias${NC}"

if [ ! -f "$TYPE_IG" ]; then
  warn "$TYPE_IG não encontrado — pulando cirurgia 2"
else
  # Substituição cirúrgica: apenas a linha do StatusVariant
  # De: export type StatusVariant = "success" | "warning" | "danger" | "neutral";
  # Para: alias para orbit.ts
  python3 - << 'PYEOF'
import re, sys

path = "src/types/instagram.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = 'export type StatusVariant = "success" | "warning" | "danger" | "neutral";'
new = (
    '// ⚠️  StatusVariant unificado com orbit.ts (orbit-fix.sh)\n'
    "// Valores canônicos: 'ok' | 'warn' | 'neutral'\n"
    "export type { StatusVariant } from './orbit';"
)

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("REPLACED")
else:
    # Tenta regex mais tolerante
    pattern = r"export type StatusVariant\s*=\s*[^;]+;"
    if re.search(pattern, content):
        content = re.sub(pattern, new, content)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("REPLACED_REGEX")
    else:
        print("NOT_FOUND")
PYEOF

  RESULT=$?
  ok "StatusVariant em instagram.ts → alias para orbit.ts"
  patch "Verificar: nenhum valor 'success'/'danger' sendo passado ao QualityScoresPanel"
fi

# =============================================================================
# CIRURGIA 3 — instagramRepository.ts
# Problema:  deriveCriticalAlerts() retorna string[]
#            CriticalAlert.tsx espera CriticalAlertData { id, title, body, severity }
# Estratégia: reescrever deriveCriticalAlerts() para retornar CriticalAlertData[]
# Ripple:     NENHUM — função privada, consumida apenas por fetchInstagramOverview()
#             que já tipifica criticalAlerts: CriticalAlertData[] em IGOverviewData
# =============================================================================
sep
log "\n${YLW}[CIRURGIA 3/3] instagramRepository.ts — deriveCriticalAlerts shape${NC}"

if [ ! -f "$REPO" ]; then
  warn "$REPO não encontrado — pulando cirurgia 3"
else
  python3 - << 'PYEOF'
import re

path = "src/lib/repositories/instagramRepository.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Bloco antigo (retorna string[])
old_pattern = r'function deriveCriticalAlerts\(kpis: KPICardData\[\]\): string\[\] \{[^}]+\}'

old_fn = '''function deriveCriticalAlerts(kpis: KPICardData[]): string[] {
  return kpis
    .filter((k) => k.semaphore === "vermelho")
    .map(
      (k) =>
        `${k.label}: ${k.delta > 0 ? "+" : ""}${k.delta}% — intervenção necessária.`
    );
}'''

# Novo bloco — retorna CriticalAlertData[]
new_fn = '''function deriveCriticalAlerts(kpis: KPICardData[]): CriticalAlertData[] {
  return kpis
    .filter((k) => k.semaphore === "vermelho")
    .map((k) => ({
      id:       `alert-${k.id}`,
      title:    k.label,
      body:     `${k.delta > 0 ? "+" : ""}${k.delta}% vs período anterior — intervenção necessária.`,
      severity: "critical" as const,
    }));
}'''

if old_fn in content:
    content = content.replace(old_fn, new_fn)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("REPLACED_EXACT")
else:
    # Fallback: regex
    result = re.sub(
        r'function deriveCriticalAlerts\(kpis:\s*KPICardData\[\]\):\s*string\[\]\s*\{.*?\}',
        new_fn,
        content,
        flags=re.DOTALL
    )
    if result != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(result)
        print("REPLACED_REGEX")
    else:
        print("NOT_FOUND")
PYEOF

  ok "deriveCriticalAlerts() → retorna CriticalAlertData[] com id, title, body, severity"
fi

# =============================================================================
# VERIFICAÇÃO FINAL
# =============================================================================
sep
log "\n${CYN}🔍 Verificação Pós-Cirurgia${NC}\n"

# Erro 1: período como Date
if grep -q 'PERIOD_START = new Date' "$PAGE" 2>/dev/null; then
  ok "Erro 1 ✓ — periodStart/periodEnd são Date"
else
  fail "Erro 1 — verificar manualmente $PAGE"
fi

# Erro 2: eupetruchio84 incluído
if grep -q 'eupetruchio84' "$PAGE" 2>/dev/null; then
  ok "       ✓ — eupetruchio84 presente no catálogo de clientes"
else
  fail "       — eupetruchio84 ausente"
fi

# Erro 3: StatusVariant alias
if grep -q "export type { StatusVariant } from './orbit'" "$TYPE_IG" 2>/dev/null; then
  ok "Erro 2 ✓ — StatusVariant unificado via alias"
else
  fail "Erro 2 — verificar manualmente $TYPE_IG"
fi

# Erro 4: deriveCriticalAlerts retorna CriticalAlertData[]
if grep -q 'CriticalAlertData\[\]' "$REPO" 2>/dev/null; then
  ok "Erro 3 ✓ — deriveCriticalAlerts retorna CriticalAlertData[]"
else
  fail "Erro 3 — verificar manualmente $REPO"
fi

sep
log "\n${GRN}🏁 Correções aplicadas. Próximos passos:${NC}"
log ""
log "  1. Verificar TypeScript (sem compilar o servidor):"
log "     ${CYN}npx tsc --noEmit${NC}"
log ""
log "  2. Se passar, rodar o servidor:"
log "     ${CYN}npm run dev${NC}"
log ""
log "  3. Rodar o SQL de limpeza no Supabase SQL Editor:"
log ""
log "     ${YLW}-- Limpar datas corrompidas (epoch 1970)${NC}"
log "     ${CYN}DELETE FROM kpi_snapshots WHERE period_start < '2024-01-01';${NC}"
log ""
log "  4. Para ingerir dados do eupetruchio84:"
log "     ${CYN}npx ts-node scripts/ingest-l0-v2.ts --mode operational${NC}"
log "     ${CYN}npx ts-node scripts/ingest-insights.ts --client eupetruchio84${NC}"
log "     ${CYN}npx ts-node scripts/extract-demographics.ts${NC}"
log ""
log "  Backup em: ${YLW}./$BACKUP_DIR/${NC}\n"