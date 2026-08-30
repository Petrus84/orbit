/* ==========================================================================
   ORBIT · Funil — redirect para rota canônica
   Caminho: src/app/(dashboard)/instagram/funil/page.tsx

   Seção 5.5: /funil e /instagram/funil eram duas implementações quase
   idênticas da mesma tela (mesmo header comentava "src/app/instagram/
   funil/page.tsx" dentro do arquivo /funil, confirmando que uma foi
   copiada da outra). Canônica decidida pelo usuário: /funil.
   ========================================================================== */

import { redirect } from 'next/navigation'

export default function InstagramFunilRedirect() {
  redirect('/funil')
}
