/* ==========================================================================
   ORBIT · Constants (SSOT)
   Caminho: src/lib/constants.ts
   Versão: 1.0.2

   Single Source of Truth para CLIENTS e períodos de análise.
   Importar daqui em TODAS as páginas — nunca duplicar.

   FIX v1.0.1: os dois UUIDs estavam trocados/órfãos (cpimportstore
   apontava pro ID real do eupetruchio84, e eupetruchio84 apontava pra um
   UUID órfão de public.clients que não existe em orbit.clients).
   Reconfirmado ao vivo via `select id, handle, name from orbit.clients`:

     cpimportstore  -> 2141d077-0d82-4fda-83df-558377f105ff
     eupetruchio84  -> c4722cfc-cff2-4a03-a457-f14ee8c9e0e7

   FIX v1.0.2: `export const PERIOD_END = new Date()` é avaliado UMA VEZ
   quando o módulo é carregado — não a cada render. No servidor (Next.js
   Turbopack), isso é "agora" no instante em que o processo importou o
   módulo pela primeira vez (pode ficar em memória por horas até o próximo
   redeploy); no navegador, é "agora" no instante em que o bundle carregou.
   São dois relógios com ciclos de vida diferentes, nunca garantidamente
   iguais — causava hydration mismatch em qualquer componente que
   renderizasse esse valor (ex.: `max` de <input type="date"> em
   DateRangeControl) sempre que os dois instantes caíam em dias UTC
   diferentes.

   PERIOD_END deixou de existir como valor exportado — agora é a função
   `getPeriodEnd()`. Todo consumidor client-side deve usar o hook
   `useClientNow()` (src/hooks/useClientNow.ts) para obter "agora" somente
   depois do mount no cliente (nunca durante SSR nem na primeira passada de
   hidratação), com `getPeriodEnd()` como fallback estável antes do mount.

   ⚠️ ESTA É A TENTATIVA #2 DESTE FIX. Na tentativa #1, este arquivo foi
   atualizado para remover `PERIOD_END`, mas NEM TODOS os consumidores
   (src/app/(dashboard)/funil/page.tsx, avatar/page.tsx,
   instagram/avatar/page.tsx, layout.tsx, src/app/instagram/page.tsx) foram
   migrados na mesma alteração — alguns continuaram importando o nome
   antigo `PERIOD_END`, causando o build error "Export PERIOD_END doesn't
   exist in target module". A causa raiz não era o design do fix, e sim o
   rollout parcial. Se `PERIOD_END` for reintroduzido aqui no futuro, TODOS
   os arquivos listados acima (rode `grep -rn "PERIOD_END" src`) precisam
   ser atualizados no mesmo commit.
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

  ac_enxovais: {
    id: 'a131cba6-bd51-4d86-b7be-a9e7ee481e98', 
    name: 'A.C. Enxovais',
    label: 'A.C. Enxovais',
  },


} as const

export type ClientKey = keyof typeof CLIENTS

// Janela de análise global — cobre todos os dados ingeridos.
// PERIOD_START é um literal fixo (data de início da ingestão) — seguro
// como constante de módulo, pois não representa "agora".
export const PERIOD_START = new Date('2026-01-01T00:00:00-03:00')

// ⚠️ NÃO reintroduzir `export const PERIOD_END = new Date()` aqui.
// "Agora" não pode ser uma constante de módulo (ver FIX v1.0.2 acima).
// Use `getPeriodEnd()` como fallback estável (idêntico em SSR e no
// primeiro paint do cliente) e `useClientNow()` para o valor real após o
// mount.
export function getPeriodEnd(): Date {
  return new Date()
}