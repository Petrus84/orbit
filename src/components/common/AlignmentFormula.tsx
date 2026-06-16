import React from "react";

export const AlignmentFormula: React.FC = () => {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Fórmula de Cálculo
      </h2>

      <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
        {/* Formula display */}
        <div className="bg-gray-950/80 rounded-lg p-4 font-mono text-sm border border-gray-800 overflow-x-auto">
          <div className="text-gray-500 mb-1 text-xs">
            {/* Score de Alinhamento de Avatar */}
          </div>
          <div>
            <span className="text-violet-400">score</span>
            <span className="text-gray-400"> = </span>
            <span className="text-amber-300">{"("}</span>
          </div>
          <div className="pl-4">
            <span className="text-emerald-400">alinhamento_genero</span>
            <span className="text-gray-400"> × </span>
            <span className="text-sky-400">0.40</span>
            <span className="text-gray-600 ml-1">{"// peso 40%"}</span>
          </div>
          <div className="pl-4">
            <span className="text-gray-500">+ </span>
            <span className="text-emerald-400">alinhamento_faixa_etaria</span>
            <span className="text-gray-400"> × </span>
            <span className="text-sky-400">0.35</span>
            <span className="text-gray-600 ml-1">{"// peso 35%"}</span>
          </div>
          <div className="pl-4">
            <span className="text-gray-500">+ </span>
            <span className="text-emerald-400">alinhamento_geo</span>
            <span className="text-gray-400"> × </span>
            <span className="text-sky-400">0.25</span>
            <span className="text-gray-600 ml-1">{"// peso 25%"}</span>
          </div>
          <div>
            <span className="text-amber-300">{")"}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">alinhamento_X</span>
              <span className="text-gray-500">=</span>
              <span className="text-gray-300">
                1 − |esperado − real| / 100
              </span>
            </div>
          </div>
        </div>

        {/* Weight legend */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Gênero", weight: "40%", color: "text-violet-400" },
            { label: "Faixa Etária", weight: "35%", color: "text-sky-400" },
            { label: "Geolocalização", weight: "25%", color: "text-teal-400" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-gray-800/50 rounded-lg px-3 py-2 text-center border border-gray-700/50"
            >
              <p className={`text-sm font-bold ${item.color}`}>{item.weight}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};