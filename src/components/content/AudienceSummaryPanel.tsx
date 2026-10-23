/* ==========================================================================
   ORBIT · Component — AudienceSummaryPanel
   Versão: 1.1.1  |  Data: 2026-10-19
   
   Atualizado para suportar a visualização de GAP (Opção C) cruzando o dado
   real (summary) com o esperado do onboarding (avatar_expected_gender_pct).
   ========================================================================== */

import { GlassCard } from "@/components/common/GlassCard";
import styles from "./AudienceSummaryPanel.module.css";
import type { AudienceSummary } from "@/types/orbit";
import type { Database } from "@/types/database.types";

export interface AudienceSummaryPanelProps {
  summary: AudienceSummary;
  // Novas propriedades mapeadas diretamente de client_onboarding
  expectedGenderCategory?: Database["orbit"]["Enums"]["gender_category"] | null;
  expectedGenderPct?: number | null;
}

function formatPct(value: number | null): string {
  return value != null ? `${value.toFixed(1)}%` : "—";
}

export function AudienceSummaryPanel({
  summary,
  expectedGenderCategory,
  expectedGenderPct,
}: AudienceSummaryPanelProps) {
  const hasGender =
    summary.genderFemalePct != null || summary.genderMalePct != null;
  const hasCities = summary.topCities.length > 0;

  // Lógica de cálculo do GAP
  let realGenderPct: number | null = null;
  let genderLabel = "Gênero";

  if (expectedGenderCategory === "female") {
    realGenderPct = summary.genderFemalePct ?? null;
    genderLabel = "Feminino";
  } else if (expectedGenderCategory === "male") {
    realGenderPct = summary.genderMalePct ?? null;
    genderLabel = "Masculino";
  }

  const hasGapData = realGenderPct != null && expectedGenderPct != null;
  const gapValue = hasGapData ? realGenderPct! - expectedGenderPct! : 0;
  const isPositiveGap = gapValue >= 0;

  return (
    <GlassCard glowColor="cyan" className={styles.panel}>
      <p className={styles.panelTitle}>AUDIÊNCIA — {summary.periodLabel}</p>

      {/* MÉTRICAS GERAIS (Mantido do original) */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Alcance por seguidor</p>
          <p className={styles.statValue}>
            {formatPct(summary.reachFollowersPct)}
          </p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Visitas ao perfil</p>
          <p className={styles.statValue}>{summary.profileVisits ?? "—"}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Cliques no link</p>
          <p className={styles.statValue}>{summary.linkClicks ?? "—"}</p>
        </div>
      </div>

      {/* NOVA SESSÃO: GAP ANALYSIS (OPÇÃO C) */}
      {hasGapData && (
        <div className={styles.gapSection}>
          <p className={styles.blockLabel}>
            ANÁLISE DE ALINHAMENTO: {genderLabel.toUpperCase()}
          </p>

          <div className={styles.gapCards}>
            <div className={styles.metricCardReal}>
              <span className={styles.metricValue}>
                {realGenderPct?.toFixed(1)}%
              </span>
              <span className={styles.metricLabel}>REALIZADO</span>
            </div>
            <div className={styles.metricCardExpected}>
              <span className={styles.metricValue}>
                {expectedGenderPct?.toFixed(1)}%
              </span>
              <span className={styles.metricLabel}>ESPERADO</span>
            </div>
          </div>

          <div
            className={styles.gapBadge}
            data-status={isPositiveGap ? "positive" : "negative"}
          >
            GAP {gapValue > 0 ? "+" : ""}
            {gapValue.toFixed(1)}% /{" "}
            {isPositiveGap ? "Acima da Meta" : "Abaixo da Meta"}
          </div>

          <div className={styles.gapBarsContainer}>
            <div className={styles.barGroup}>
              <div className={styles.barLabels}>
                <span className={styles.textReal}>
                  Real: {realGenderPct?.toFixed(1)}%
                </span>
                <span className={styles.textRest}>
                  {(100 - realGenderPct!).toFixed(1)}% Restante
                </span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFillReal}
                  style={{ width: `${realGenderPct}%` }}
                />
              </div>
            </div>

            <div className={styles.barGroup}>
              <div className={styles.barLabels}>
                <span className={styles.textExpected}>
                  Esperado: {expectedGenderPct?.toFixed(1)}%
                </span>
                <span className={styles.textRest}>
                  {(100 - expectedGenderPct!).toFixed(1)}% Restante
                </span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFillExpected}
                  style={{ width: `${expectedGenderPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPLIT TRADICIONAL & CIDADES (Mantido) */}
      {hasGender && !hasGapData && (
        <div className={styles.genderBlock}>
          {" "}
          {/* Correção aplicada aqui (faltava o '<') */}
          <p className={styles.blockLabel}>GÊNERO</p>
          <div className={styles.genderBar}>
            {summary.genderFemalePct != null && (
              <div
                className={styles.genderBarFemale}
                style={{ width: `${summary.genderFemalePct}%` }}
              />
            )}
            {summary.genderMalePct != null && (
              <div
                className={styles.genderBarMale}
                style={{ width: `${summary.genderMalePct}%` }}
              />
            )}
          </div>
          <div className={styles.genderLegend}>
            <span>
              <span className={styles.dotFemale} /> Feminino{" "}
              {formatPct(summary.genderFemalePct)}
            </span>
            <span>
              <span className={styles.dotMale} /> Masculino{" "}
              {formatPct(summary.genderMalePct)}
            </span>
            {summary.genderOtherPct != null && summary.genderOtherPct > 0 && (
              <span>Outro {formatPct(summary.genderOtherPct)}</span>
            )}
          </div>
        </div>
      )}

      {hasCities && (
        <div className={styles.citiesBlock}>
          <p className={styles.blockLabel}>PRINCIPAIS CIDADES</p>
          <div className={styles.citiesList}>
            {summary.topCities.slice(0, 5).map((city) => (
              <div key={city.name} className={styles.cityRow}>
                <span className={styles.cityName}>{city.name}</span>
                <span className={styles.cityPct}>{city.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasGender && !hasCities && !hasGapData && (
        <p className={styles.emptyState}>
          Os dados de audiência deste período aparecem aqui assim que chegarem.
        </p>
      )}
    </GlassCard>
  );
}
