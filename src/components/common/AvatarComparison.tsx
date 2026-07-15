import React from "react";
import { AvatarProfile, AlignmentStatus } from "../../types/avatar";
import { AvatarCard } from "./AvatarCard";

interface AvatarComparisonProps {
  expected: AvatarProfile;
  real: AvatarProfile;
  score: number;
  status: AlignmentStatus;
}

const STATUS_CONFIG: Record<
  AlignmentStatus,
  { label: string; color: string; ring: string; bg: string }
> = {
  critical: {
    label: "Crítico",
    color: "text-rose-400",
    ring: "ring-rose-500/50",
    bg: "bg-rose-500/10",
  },
  warning: {
    label: "Atenção",
    color: "text-amber-400",
    ring: "ring-amber-500/50",
    bg: "bg-amber-500/10",
  },
  healthy: {
    label: "Saudável",
    color: "text-emerald-400",
    ring: "ring-emerald-500/50",
    bg: "bg-emerald-500/10",
  },
  pending: {
    label: "Calculando",
    color: "text-slate-400",
    ring: "ring-slate-500/50",
    bg: "bg-slate-500/10",
  },
};

export const AvatarComparison: React.FC<AvatarComparisonProps> = ({
  expected,
  real,
  score,
  status,
}) => {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Comparação de Avatar
        </h2>
        {/* Global score badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full ring-1 ${cfg.ring} ${cfg.bg}`}
        >
          <span className={`text-xl font-black ${cfg.color}`}>{score}%</span>
          <span className={`text-xs font-semibold ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex gap-3">
        <AvatarCard profile={expected} title="Avatar Esperado" variant="expected" />

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center gap-1 px-1">
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gray-600 to-transparent" />
          <span className="text-xs font-black text-gray-600 tracking-widest">
            VS
          </span>
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gray-600 to-transparent" />
        </div>

        <AvatarCard profile={real} title="Audiência Real" variant="real" />
      </div>
    </div>
  );
};
