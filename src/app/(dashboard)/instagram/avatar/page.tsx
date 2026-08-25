/* ==========================================================================
   ORBIT · Avatar — redirect para rota canônica
   Caminho: src/app/(dashboard)/instagram/avatar/page.tsx

   Seção 5.5: /avatar e /instagram/avatar divergiam de fato (label vs name,
   estado ativo do botão, aria-pressed ausente em /instagram/avatar).
   Canônica decidida pelo usuário: /avatar (implementação mais completa —
   já tinha aria-pressed, type="button" e cor de estado ativo).
   ========================================================================== */

import { redirect } from 'next/navigation'

export default function InstagramAvatarRedirect() {
  redirect('/avatar')
}
