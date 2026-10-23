// src/app/layout.tsx
//
// FIX (2026-09-14): este arquivo — o root layout obrigatório do App
// Router — estava com o conteúdo do dashboard shell
// (src/app/(dashboard)/layout.tsx) colado por cima do dele, byte a byte
// quase idêntico ao outro arquivo. Resultado: nenhum ponto da árvore
// renderizava <html>/<body>, e o Next.js 16 passou a recusar o build/render
// com "Missing <html> and <body> tags in the root layout" — a raiz É o
// único lugar autorizado a renderizar essas tags, e ela não fazia isso.
//
// Conteúdo restaurado a partir da versão íntegra deste arquivo (a que
// nunca foi tocada pelo redesenho de período — ver LEDGER_REGISTROS.md).
// O shell do dashboard (Sidebar + OrbitDashboardProvider) continua onde
// sempre devia estar: src/app/(dashboard)/layout.tsx, aninhado dentro
// deste root layout pelo próprio App Router — não duplicado aqui.
import type { Metadata } from "next";
// FIX (reconciliação de fontes): o SSOT (ssot-design-tokens.css) sempre
// declarou DM Sans/DM Mono como as fontes oficiais, mas este root layout
// carregava Geist/Geist_Mono — duas famílias que nenhuma regra de CSS
// consumia — enquanto "DM Sans"/"DM Mono" eram usadas como string literal
// sem nenhum loader por trás, caindo no fallback genérico do navegador.
// Substituído pela família que o design system realmente especifica.
import { DM_Sans, DM_Mono } from "next/font/google";
// 🐛 CORRIGIDO 07/09/2026: importava '../styles/ssot-globals.css' direto,
// pulando './globals.css' — o único arquivo que faz `@import 'tailwindcss'`.
// Resultado: o Tailwind NUNCA entrava no pipeline de build (build passava
// sem erro, mas nenhuma classe utilitária era gerada — confirmado via
// inspeção do CSS final em .next/). Também era a causa do erro de
// "recursion depth" ao colocar @layer em ssot-globals.css: esse arquivo
// virava uma segunda raiz de import, sem @import 'tailwindcss' na própria
// cadeia. Import corrigido para o único ponto de entrada correto.
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  // cobre --font-weight-light/normal/medium/semibold do SSOT
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "ORBIT",
  description:
    "Sistema de gestão do funil de vendas e do desempenho das contas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmMono.variable} min-h-screen flex flex-col antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
