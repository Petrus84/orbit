import React from "react";
import { AvatarProfile } from "../../types/avatar";

interface AvatarCardProps {
  profile: AvatarProfile;
  title: string;
  variant: "expected" | "real";
}

const VARIANT_STYLES = {
  expected: {
    border: "border-violet-500/40",
    badge: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    accent: "text-violet-400",
    genderBar: "bg-violet-500",
    genderBarAlt: "bg-violet-900",
    icon: "👤",
  },
  real: {
    border: "border-rose-500/40",
    badge: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    accent: "text-rose-400",
    genderBar: "bg-rose-500",
    genderBarAlt: "bg-rose-900",
    icon: "📊",
  },
};

export const AvatarCard: React.FC<AvatarCardProps> = ({
  profile,
  title,
  variant,
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`flex-1 bg-gray-900/60 border ${styles.border} rounded-xl p-5 backdrop-blur-sm`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{styles.icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md ${styles.badge}`}>
          {title}
        </span>
      </div>

      {/* Gender distribution */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">
          Gênero
        </p>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${styles.genderBar}`}
              style={{ width: `${profile.gender.female}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">
            ♀ Feminino{" "}
            <span className={`font-bold ${styles.accent}`}>
              {profile.gender.female}%
            </span>
          </span>
          <span className="text-gray-400">
            ♂ Masculino{" "}
            <span className={`font-bold ${styles.accent}`}>
              {profile.gender.male}%
            </span>
          </span>
        </div>
      </div>

      {/* Age Range */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          Faixa Etária
        </p>
        <p className={`text-sm font-semibold ${styles.accent}`}>
          {profile.ageRange} anos
        </p>
      </div>

      {/* Interest */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          Interesse Principal
        </p>
        <p className="text-sm text-gray-200 font-medium">{profile.interest}</p>
      </div>

      {/* Geo */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          Geolocalização
        </p>
        <p className="text-sm text-gray-200 font-medium flex items-center gap-1">
          <span>📍</span> {profile.geo}
        </p>
      </div>
    </div>
  );
};
