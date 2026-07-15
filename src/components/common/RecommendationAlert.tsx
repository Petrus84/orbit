import React, { useState } from "react";
import { AlignmentStatus } from "../../types/avatar";

interface RecommendationAlertProps {
  status: AlignmentStatus;
  score: number;
}

interface Recommendation {
  icon: string;
  title: string;
  desc: string;
}

interface StatusConfig {
  icon: string;
  title: string;
  borderColor: string;
  bgColor: string;
  iconBg: string;
  titleColor: string;
  badgeColor: string;
  badgeLabel: string;
  recommendations: Recommendation[];
}

const STATUS_CONFIG: Record<AlignmentStatus, StatusConfig> = {
  critical: {
    icon: "🚨",
    title: "Alinhamento Crítico — Ação Imediata Necessária",
    borderColor: "border-rose-500/60",
    bgColor: "bg-rose-950/40",
    iconBg: "bg-rose-500/20",
    titleColor: "text-rose-400",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    badgeLabel: "CRÍTICO",
    recommendations: [
      {
        icon: "🎯",
        title: "Revisar segmentação de anúncios",
        desc: "Ajuste os critérios de gênero nas campanhas pagas — o desvio de 31pp é o principal driver do score baixo.",
      },
      {
        icon: "📅",
        title: "Auditar faixa etária",
        desc: "A audiência real está 10 anos acima do avatar definido. Considere revisar o posicionamento de conteúdo.",
      },
      {
        icon: "📍",
        title: "Verificar geotargeting",
        desc: "Concentração em RJ diverge do foco em SP. Ative exclusões geográficas ou crie campanhas regionais separadas.",
      },
      {
        icon: "🔄",
        title: "Redefinir avatar ou estratégia",
        desc: "Se a audiência real é recorrente e engajada, considere atualizar o avatar para refletir a realidade atual.",
      },
    ],
  },
  warning: {
    icon: "⚠️",
    title: "Alinhamento com Desvios — Monitoramento Recomendado",
    borderColor: "border-amber-500/60",
    bgColor: "bg-amber-950/40",
    iconBg: "bg-amber-500/20",
    titleColor: "text-amber-400",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    badgeLabel: "ATENÇÃO",
    recommendations: [
      {
        icon: "📊",
        title: "Monitorar tendências",
        desc: "Acompanhe as métricas semanalmente para detectar desvios crescentes antes que se tornem críticos.",
      },
      {
        icon: "🎯",
        title: "Ajustes pontuais de segmentação",
        desc: "Pequenos ajustes nas variáveis com menor alinhamento podem elevar o score rapidamente.",
      },
    ],
  },
  healthy: {
    icon: "✅",
    title: "Alinhamento Saudável — Continue o Bom Trabalho",
    borderColor: "border-emerald-500/60",
    bgColor: "bg-emerald-950/30",
    iconBg: "bg-emerald-500/20",
    titleColor: "text-emerald-400",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    badgeLabel: "SAUDÁVEL",
    recommendations: [
      {
        icon: "📈",
        title: "Manter a estratégia atual",
        desc: "O avatar está bem alinhado com a audiência real. Continue monitorando para manter esse nível.",
      },
    ],
  },
  pending: {
    icon: "⏳",
    title: "Alinhamento Pendente — Aguardando Cálculo",
    borderColor: "border-slate-500/60",
    bgColor: "bg-slate-950/40",
    iconBg: "bg-slate-500/20",
    titleColor: "text-slate-400",
    badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    badgeLabel: "CALCULANDO",
    recommendations: [
      {
        icon: "⚙️",
        title: "Configurar avatar esperado",
        desc: "Preencha os campos de avatar esperado em orbit.clients (gênero, faixa etária, localização, interesse).",
      },
      {
        icon: "📊",
        title: "Gerar snapshot de audiência",
        desc: "Execute extract-demographics.ts para importar dados de audiência do Instagram e calcular o alinhamento.",
      },
    ],
  },
};

export const RecommendationAlert: React.FC<RecommendationAlertProps> = ({
  status,
  score,
}) => {
  const [expanded, setExpanded] = useState(true);
  const cfg = STATUS_CONFIG[status];

  return (
    <div className={`border ${cfg.borderColor} ${cfg.bgColor} rounded-xl overflow-hidden`}>
      {/* Alert header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${cfg.iconBg} flex items-center justify-center text-lg`}>
          {cfg.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-bold border rounded px-2 py-0.5 uppercase tracking-wider ${cfg.badgeColor}`}
            >
              {cfg.badgeLabel}
            </span>
            <span className="text-xs text-gray-500">Score: {score}%</span>
          </div>
          <p className={`text-sm font-semibold mt-0.5 ${cfg.titleColor}`}>
            {cfg.title}
          </p>
        </div>

        <span className="text-gray-500 text-xs flex-shrink-0">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Recommendations list */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="h-px bg-gray-700/50 mb-3" />
          {cfg.recommendations.map((rec: Recommendation, i: number) => (
            <div
              key={i}
              className="flex gap-3 bg-gray-900/40 rounded-lg p-3 border border-gray-700/30"
            >
              <span className="text-base flex-shrink-0 mt-0.5">{rec.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-200">
                  {rec.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  {rec.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
