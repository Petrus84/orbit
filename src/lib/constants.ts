/* ==========================================================================
   ORBIT · Constants (SSOT)
   Caminho: src/lib/constants.ts
   Versão: 1.0.0

   Single Source of Truth para CLIENTS e períodos de análise.
   Importar daqui em TODAS as páginas — nunca duplicar.
   ========================================================================== */

export const CLIENTS = {
  cpimportstore: {
    id: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
    name: 'CP Import Store',
    label: 'CP Import Store',
  },
  eupetruchio84: {
    id: '24140477-0c82-4fda-83df-958377f105ff',
    name: 'E-commerce EUPETRUCHIO84',
    label: 'E-commerce EUPETRUCHIO84',
  },
} as const

export type ClientKey = keyof typeof CLIENTS

// Janela de análise global — cobre todos os dados ingeridos
export const PERIOD_START = new Date('2026-01-01T00:00:00-03:00')
export const PERIOD_END   = new Date()