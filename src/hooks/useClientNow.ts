// src/hooks/useClientNow.ts
// ORBIT · Hook — useClientNow
// Versão: 1.0.0
//
// Por que existe (ripple effect do FIX v1.0.2 em src/lib/constants.ts):
// `PERIOD_END` era `new Date()` avaliado no momento em que o módulo era
// carregado — uma vez no servidor (SSR), uma vez no bundle do cliente,
// em instantes diferentes. Isso causava hydration mismatch em qualquer
// componente que usasse esse valor para renderizar atributos (ex.: `max`
// de <input type="date"> em DateRangeControl).
//
// "Agora" nunca pode ser garantidamente igual entre servidor e cliente —
// a única forma segura de expor um valor "agora" para a UI sem quebrar a
// hidratação é: renderizar um placeholder estável na primeira passada
// (idêntico em SSR e no primeiro render do cliente — aqui, `null`), e só
// preencher o valor real depois do `useEffect`, ou seja, depois que a
// hidratação já terminou e o React aceita divergência (é um novo commit,
// não uma comparação SSR vs. cliente).
//
// Uso típico:
//   const clientNow = useClientNow()
//   const periodEnd = clientNow ?? getPeriodEnd() // fallback estável enquanto clientNow === null
//
// Isso significa: por uma fração de segundo após o primeiro paint, o
// valor pode não refletir "agora" ainda — é o preço aceitável de nunca
// mentir sobre o instante real e nunca quebrar a hidratação. Para a
// maioria dos usos (limite superior de um seletor de data), essa janela
// é imperceptível ao usuário.

import { useEffect, useState } from 'react'

export function useClientNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNow(new Date())
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  return now
}