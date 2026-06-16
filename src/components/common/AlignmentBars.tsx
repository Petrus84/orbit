import React from "react";
import { AlignmentBar as AlignmentBarType } from "../../types/avatar";
import { AlignmentBar } from "./AlignmentBar";

interface AlignmentBarsProps {
  bars: AlignmentBarType[];
}

export const AlignmentBars: React.FC<AlignmentBarsProps> = ({ bars }) => {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Alinhamento por Variável
      </h2>

      <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm space-y-5">
        {bars.map((bar, index) => (
          <React.Fragment key={bar.label}>
            <AlignmentBar bar={bar} />
            {index < bars.length - 1 && (
              <div className="border-t border-gray-800" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
