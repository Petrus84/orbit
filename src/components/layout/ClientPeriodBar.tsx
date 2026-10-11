"use client";

import { CLIENTS, type ClientKey } from "@/lib/constants";
import {
  DateRangeControl,
  type PeriodRange,
} from "@/components/common/DateRangeControl";
import styles from "./ClientPeriodBar.module.css";

export interface PeriodControl {
  value: PeriodRange;
  onChange: (next: PeriodRange) => void;
  minDate: Date;
  maxDate: Date;
}

export interface ClientPeriodBarProps {
  activeKey: ClientKey;
  onSelect: (key: ClientKey) => void;
  /** Omitir em telas sem período (ex.: Onboarding). */
  period?: PeriodControl;
}

/**
 * Barra única de cliente + período. Substitui os <nav> copiados em
 * funil, avatar, onboarding e instagram (cada um com padding e estilo de
 * botão ativo diferentes).
 */
export function ClientPeriodBar({
  activeKey,
  onSelect,
  period,
}: ClientPeriodBarProps) {
  const keys = Object.keys(CLIENTS) as ClientKey[];

  return (
    <nav className={styles.bar} aria-label="Selecionar cliente e período">
      <div className={styles.chips}>
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.chip}
            aria-pressed={activeKey === key}
            onClick={() => onSelect(key)}
          >
            {CLIENTS[key].label}
          </button>
        ))}
      </div>
      {period ? (
        <div className={styles.period}>
          <DateRangeControl
            value={period.value}
            onChange={period.onChange}
            minDate={period.minDate}
            maxDate={period.maxDate}
          />
        </div>
      ) : null}
    </nav>
  );
}
