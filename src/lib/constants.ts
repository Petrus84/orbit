/* ==========================================================================
   ORBIT · Constants (SSOT)
   Caminho: src/lib/constants.ts
   Versão: 1.0.1

   Single Source of Truth para CLIENTS e períodos de análise.
   Importar daqui em TODAS as páginas — nunca duplicar.

   FIX v1.0.1: os dois UUIDs estavam trocados/órfãos (cpimportstore
   apontava pro ID real do eupetruchio84, e eupetruchio84 apontava pra um
   UUID órfão de public.clients que não existe em orbit.clients).
   Reconfirmado ao vivo via `select id, handle, name from orbit.clients`:

     cpimportstore  -> 2141d077-0d82-4fda-83df-558377f105ff
     eupetruchio84  -> c4722cfc-cff2-4a03-a457-f14ee8c9e0e7
   ========================================================================== */

export const CLIENTS = {
  cpimportstore: {
    id: '2141d077-0d82-4fda-83df-558377f105ff',
    name: 'CP Import Store',
    label: 'CP Import Store',
  },
  eupetruchio84: {
    id: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
    name: 'E-commerce EUPETRUCHIO84',
    label: 'E-commerce EUPETRUCHIO84',
  },
} as const

export type ClientKey = keyof typeof CLIENTS

// Janela de análise global — cobre todos os dados ingeridos
export const PERIOD_START = new Date('2025-01-01T00:00:00-03:00')
export const PERIOD_END   = new Date()