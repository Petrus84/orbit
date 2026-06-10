/* ==========================================================================
   ORBIT · Root Route Gateway
   Caminho físico real: src/app/page.tsx
   Responsabilidade: Executar o redirecionamento nativo e seguro para o dashboard.
   ========================================================================== */

import { redirect } from 'next/navigation';

export default function RootPage() {
  // 💡 EXECUTA O GATILHO: Redireciona o usuário antes de carregar a árvore DOM
  redirect('/instagram');
  
  // Fallback visual nulo exigido pelo Next.js para satisfazer o contrato de Componente
  return null;
}
