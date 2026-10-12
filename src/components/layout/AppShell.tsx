"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./AppShell.module.css";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Shell único do app: sidebar + conteúdo, com teto `--shell-max` e drawer
 * da sidebar abaixo de 1024px. Usado por (dashboard)/layout.tsx e por
 * /instagram, para as duas árvores terem o mesmo comportamento.
 *
 * A rolagem é a da janela (não há mais rolagem interna por página), e a
 * sidebar fica sticky em telas largas.
 */
export function AppShell({ sidebar, children }: AppShellProps) {
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
    <div className={styles.shell} data-open={menuOpen}>
      <div
        id="orbit-sidebar"
        className={styles.slot}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
        }}
      >
        {sidebar}
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
  );
}
