import React, { useId } from 'react';

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
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-sans text-xs font-medium text-zinc-400">
          {label}
        </label>
        <span className="font-mono text-xs font-semibold tabular-nums text-[#C8FF57]">
          {display}
        </span>
      </div>

      {/* Track + thumb */}
      <div className="relative flex items-center">
        {/* Filled track background */}
        <div className="pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-[#C8FF57]/60 transition-all duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="
            relative w-full cursor-pointer appearance-none bg-transparent
            focus:outline-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[#C8FF57]
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_2px_rgba(200,255,87,0.45)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:bg-[#C8FF57]
            [&::-webkit-slider-runnable-track]:h-1
            [&::-webkit-slider-runnable-track]:rounded-full
            [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-moz-range-track]:h-1
            [&::-moz-range-track]:rounded-full
            [&::-moz-range-track]:bg-zinc-800
          "
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
        />
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-zinc-700">
          {formatDisplay ? formatDisplay(min) : `${min}${unit}`}
        </span>
        <span className="font-mono text-[10px] text-zinc-700">
          {formatDisplay ? formatDisplay(max) : `${max}${unit}`}
        </span>
      </div>
    </div>
  );
}
