import React, { useId } from 'react';
import styles from './Slider.module.css';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  formatDisplay?: (value: number) => string;
  unit?: string;
}

export default function Slider({
  label,
  min,
  max,
  step = 0.1,
  value,
  onChange,
  formatDisplay,
  unit = '%',
}: SliderProps): React.ReactElement {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatDisplay ? formatDisplay(value) : `${value.toFixed(1)}${unit}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <span className={styles.valueDisplay}>{display}</span>
      </div>

      <div className={styles.trackRow}>
        <div className={styles.trackFill} aria-hidden="true">
          <div className={styles.trackFillInner} style={{ width: `${pct}%` }} />
        </div>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={styles.input}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
        />
      </div>

      <div className={styles.rangeLabels}>
        <span className={styles.rangeLabel}>{formatDisplay ? formatDisplay(min) : `${min}${unit}`}</span>
        <span className={styles.rangeLabel}>{formatDisplay ? formatDisplay(max) : `${max}${unit}`}</span>
      </div>
    </div>
  );
}