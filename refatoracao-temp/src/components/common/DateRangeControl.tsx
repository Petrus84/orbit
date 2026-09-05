/* ==========================================================================
   ORBIT · Component — DateRangeControl
   Caminho: src/components/common/DateRangeControl.tsx

   NOVO ARQUIVO — criado na refatoração de "período dinâmico" (2026-08-31).

   Por que existe:
   - Antes desta refatoração, PERIOD_START/PERIOD_END (src/lib/constants.ts)
     eram lidos como constantes fixas e passados direto para
     <OrbitDashboardProvider>, sem nenhuma forma de o usuário escolher outro
     intervalo — o dashboard sempre mostrava a mesma janela de análise.
   - As três páginas que montam o próprio OrbitDashboardProvider
     (instagram/page.tsx, (dashboard)/funil/page.tsx, (dashboard)/avatar/page.tsx)
     precisavam do mesmo controle, então ele foi extraído para cá em vez de
     ser reimplementado três vezes com comportamento levemente diferente.

   Contrato:
   - Não declara nenhum tipo de domínio novo (REGRA-01). `PeriodRange` é um
     alias derivado por indexed access de `DashboardHeaderMeta['dateRange']`,
     que já existe em src/types/orbit.ts — a mesma forma { start: Date; end: Date }
     que os hooks/repositórios já produzem em `meta.dateRange`. Isso preserva
     a compatibilidade com `meta.dateRange`/`meta.periodLabel` (nada nos hooks
     ou nos repositórios muda).
   - Puramente controlado: recebe `value` + `onChange`, não guarda estado
     próprio. Quem usa decide onde o estado mora (nas 3 páginas, por enquanto
     — ver nota em (dashboard)/layout.tsx sobre por que ele NÃO ganhou um
     controle).
   - Não usa TOKENS (`src/lib/tokens.ts`) porque as 3 páginas que o consomem
     também não usam — seguem o mesmo padrão de inline style com variáveis
     CSS (`var(--line)`, `var(--acc)`, etc.) já presente nelas. Se/quando
     essas páginas migrarem para TOKENS, este componente deve migrar junto.
   ========================================================================== */

'use client'

import type { ChangeEvent } from 'react'
import type { DashboardHeaderMeta } from '@/types/orbit'

/** Mesma forma de src/types/orbit.ts (`DashboardHeaderMeta['dateRange']`) — não é um tipo novo. */
export type PeriodRange = DashboardHeaderMeta['dateRange']

export interface DateRangeControlProps {
  value: PeriodRange
  onChange: (next: PeriodRange) => void
  /** Limite inferior selecionável (ex.: PERIOD_START — início da janela com dado ingerido). */
  minDate?: Date
  /** Limite superior selecionável (ex.: PERIOD_END — "agora", não faz sentido período futuro). */
  maxDate?: Date
  /** Desabilita os dois inputs (ex.: enquanto status === 'loading'). */
  disabled?: boolean
}

function toInputValue(date: Date): string {
  // yyyy-mm-dd, o formato que <input type="date"> espera
  return date.toISOString().slice(0, 10)
}

function parseInputValue(raw: string, endOfDay: boolean): Date | null {
  if (!raw) return null
  const parsed = new Date(`${raw}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--t0)',
  fontSize: '13px',
  fontFamily: 'inherit',
  colorScheme: 'dark',
}

export function DateRangeControl({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
}: DateRangeControlProps) {
  const handleStartChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseInputValue(e.target.value, false)
    if (!next) return
    // não deixa o início passar do fim já selecionado
    if (next > value.end) return
    onChange({ start: next, end: value.end })
  }

  const handleEndChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseInputValue(e.target.value, true)
    if (!next) return
    // não deixa o fim ficar antes do início já selecionado
    if (next < value.start) return
    onChange({ start: value.start, end: next })
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      role="group"
      aria-label="Selecionar período de análise"
    >
      <input
        type="date"
        aria-label="Início do período"
        value={toInputValue(value.start)}
        min={minDate ? toInputValue(minDate) : undefined}
        max={toInputValue(value.end)}
        onChange={handleStartChange}
        disabled={disabled}
        style={inputStyle}
      />
      <span style={{ color: 'var(--t2)', fontSize: '13px' }} aria-hidden="true">
        até
      </span>
      <input
        type="date"
        aria-label="Fim do período"
        value={toInputValue(value.end)}
        min={toInputValue(value.start)}
        max={maxDate ? toInputValue(maxDate) : undefined}
        onChange={handleEndChange}
        disabled={disabled}
        style={inputStyle}
      />
    </div>
  )
}
