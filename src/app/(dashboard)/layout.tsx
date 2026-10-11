/* ==========================================================================
   ORBIT · Dashboard Shell Layout
   Caminho: src/app/(dashboard)/layout.tsx
   Versão: 1.0.0

   Corrige Seção 5.3 do prompt de auditoria: Sidebar/Header só eram
   montados dentro de src/app/instagram/page.tsx — /carteira, /alertas,
   /avatar, /funil, /instagram/avatar, /instagram/funil e /onboarding
   renderizavam a tela isolada, sem caminho de volta.

   Decisão confirmada com o usuário (não inventada aqui):
   - Header.tsx fica SÓ em /instagram — está fisicamente hardcoded para a
     tela de Instagram Overview (título "Instagram — CP Import Store" e as
     3 abas Overview/Por post/Audiência lidas de data.meta), então colocá-lo
     neste layout mostraria informação enganosa nas outras rotas.
   - Sidebar.tsx é reaproveitada exatamente como está (não redesenhada).
     Ela depende de useOrbitDashboard() (lança exceção sem Provider), então
     este layout paga o custo de um OrbitDashboardProvider (fetch de
     Instagram Overview) só para currentClient/alertCount funcionarem aqui
     — custo aceito explicitamente pelo usuário, não decisão unilateral.
   - Cliente usado para esse Provider "de sidebar": o primeiro de CLIENTS
     (mesma ordem usada como default em avatar/funil/onboarding). Cada
     página filha que precisa de um cliente diferente já gerencia seu
     próprio seletor + OrbitDashboardProvider aninhado (avatar/funil), que
     sobrescreve este para os componentes abaixo dele na árvore — a Sidebar
     em si, por estar acima desses providers aninhados (renderizada aqui no
     layout), sempre lê deste Provider externo.
   ========================================================================== */

"use client";

import { useEffect, useState } from "react";
import { OrbitDashboardProvider } from "@/context/OrbitDashboardContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { CLIENTS, PERIOD_START, getPeriodEnd } from "@/lib/constants";
import { useClientNow } from "@/hooks/useClientNow";
import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultClientKey = Object.keys(CLIENTS)[0] as keyof typeof CLIENTS;
  const defaultClient = CLIENTS[defaultClientKey];

  // FIX v1.0.2 (ripple effect de src/lib/constants.ts): ver nota em
  // src/app/(dashboard)/funil/page.tsx sobre por que PERIOD_END virou
  // getPeriodEnd() + useClientNow().
  const clientNow = useClientNow();
  const periodEnd = clientNow ?? getPeriodEnd();

  // Drawer da sidebar abaixo de 1024px (CSS em layout.module.css). Acima
  // disso o estado é ignorado — a sidebar fica sempre visível.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <OrbitDashboardProvider
      clientId={defaultClient.id}
      periodStart={PERIOD_START}
      periodEnd={periodEnd}
    >
      {/* FIX shell/responsivo (11/10/2026): teto de 1500px no shell inteiro
          (sidebar + conteúdo) e `minWidth: 0` no conteúdo — o `minWidth: 680`
          impedia os grids de encolher e forçava rolagem horizontal. Abaixo
          de 1024px a sidebar vira drawer (botão flutuante + backdrop). */}
      <div className={styles.shell} data-open={menuOpen}>
        <div
          id="orbit-sidebar"
          className={styles.slot}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
          }}
        >
          <Sidebar />
        </div>
        <button
          type="button"
          className={styles.menuBtn}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="orbit-sidebar"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
        <div
          className={styles.backdrop}
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
        <div className={styles.content}>{children}</div>
      </div>
    </OrbitDashboardProvider>
  );
}
