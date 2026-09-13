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
  mauricioartphoto: {
    id: '344445c9-08c5-4c07-be1b-c9f8f8e12865',
    name: 'Maurício Art Photo',
    label: 'Maurício Art Photo',
  },
 djcaiodogao  : {
    id: 'c2779193-d3a0-4fc7-b392-ad64fea4273f',
    name: 'DJ Caio Dogão',
    label: 'DJ Caio Dogão',
  },
dogativo: {
    id: 'e45927a7-4f3d-4fd3-bac7-543cc3545dc1',
    name: 'Dog Ativo',
    label: 'Dog Ativo',
  },


} as const

export type ClientKey = keyof typeof CLIENTS

// Janela de análise global — cobre todos os dados ingeridos
export const PERIOD_START = new Date('2026-01-01T00:00:00-03:00')
export const PERIOD_END   = new Date()