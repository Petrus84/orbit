// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// 🐛 CORRIGIDO 07/09/2026: importava '../styles/ssot-globals.css' direto,
// pulando './globals.css' — o único arquivo que faz `@import 'tailwindcss'`.
// Resultado: o Tailwind NUNCA entrava no pipeline de build (build passava
// sem erro, mas nenhuma classe utilitária era gerada — confirmado via
// inspeção do CSS final em .next/). Também era a causa do erro de
// "recursion depth" ao colocar @layer em ssot-globals.css: esse arquivo
// virava uma segunda raiz de import, sem @import 'tailwindcss' na própria
// cadeia. Import corrigido para o único ponto de entrada correto.
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ORBIT · Dashboard",
  description: "Sistema de Gestão de Funil de E-commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}