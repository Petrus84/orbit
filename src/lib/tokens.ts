// src/lib/tokens.ts

export const TOKENS = {
  // Camadas Neomorphic do Ecossistema Orbit (Fundo e Containers)
  bg: {
    base: "var(--bg)",         // #0C0C0F - Fundo absoluto do app
    sidebar: "var(--bg1)",      // #111116 - Lateral esquerda
    card: "var(--bg2)",         // #18181F - Fundo padrão dos cards
    hover: "var(--bg3)",        // #1F1F28 - Estado hover
    active: "var(--bg4)",       // #26262F - Estado ativo / Skeletons
  },

  // Hierarquia de Texto com Warmth (Off-white Quente)
  text: {
    primary: "var(--t0)",       // #F0EFE8 - Títulos principais, valores de destaque
    secondary: "var(--t1)",     // #B8B6B0 - Textos de leitura comum
    muted: "var(--t2)",         // #706E6A - Labels secundárias, descrições pequenas
    dim: "var(--t3)",           // #454340 - Textos ocultos ou extremamente discretos
  },

  // Identidade Única e Acentos de Marca
  accent: {
    lima: "var(--acc)",         // #C8FF57 - Ícones e itens ativos selecionados
    purple: "var(--acc2)",      // #8B5CF6 - Roxo secundário
    orange: "var(--acc3)",      // #FF6B35 - Laranja terciário
  },

  // Status Semafóricos e Nuances Aplicadas na Imagem
  status: {
    red: "var(--red)",          // #FF4444 - Métricas críticas
    amber: "var(--amber)",      // #FFB020 - Alertas, triângulos e números de atenção
    green: "var(--green)",      // #2ECC71 - Valores positivos e saudáveis
    blue: "var(--blue)",        // #4A90FF - Informativos e botões de filtro (Overview)
  },

  // Efeitos de Iluminação Neon e Bordas Glow (Idênticos ao Prototipado)
  glow: {
    cyan: {
      border: "var(--border-glow-cyan)",   // #00FFFF
      shadow: "var(--shadow-glow-cyan)",   // Sombra projetada cyan
    },
    red: {
      border: "var(--border-glow-red)",    // #FF4444
      shadow: "var(--shadow-glow-red)",
    },
    gold: {
      border: "var(--border-glow-gold)",   // #FFC300
      shadow: "var(--shadow-glow-gold)",
    },
    lineDefault: "var(--line)",             // #2A2A35 - Borda neutra dos cartões
  },

  // Sistema de Tipografia do Layout
  typography: {
    fontSans: "var(--font)",    // 'DM Sans', sans-serif - Textos comuns e KPI
    fontMono: "var(--mono)",    // 'DM Mono', monospace - Fórmulas e Logs matemáticos
    size: {
      xs: "var(--font-size-xs)",   // 10px
      sm: "var(--font-size-sm)",   // 12px
      base: "var(--font-size-base)", // 14px
      xl: "var(--font-size-xl)",   // 16px
      xl3: "var(--font-size-3xl)", // 26px
    }
  },

  // Sistema de Espaçamento Estrito de 4px
  space: (multiplier: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 12) => `var(--space-${multiplier})`,

  // Raio de Curvatura das Bordas
  radius: {
    sm: "var(--r4)",   // 4px - Badges e pequenos botões
    md: "var(--r8)",   // 8px - Inputs e botões normais
    lg: "var(--r12)",  // 12px - Cartões principais e seções
  }
} as const;
