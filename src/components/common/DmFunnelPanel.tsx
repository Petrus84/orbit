"use client";

import React from "react";
import type { DmFunnelSummary } from "@/types/orbit";
import { CONFIANCA } from "@/lib/ui-labels";
import styles from "./DmFunnelPanel.module.css";

interface DmFunnelPanelProps {
  dm: DmFunnelSummary;
}

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Etapas de conversa no direct. Contagens cumulativas (quem chegou ao menos
 * até a etapa). Classificação automática por palavra-chave: é estimativa e
 * NÃO substitui a venda informada (que acontece fora do Instagram).
 */
export default function DmFunnelPanel({
  dm,
}: DmFunnelPanelProps): React.ReactElement {
  const rows: Array<[string, number]> = [
    ["Conversas comerciais", dm.conversasComerciais],
    ["Pediram preço", dm.pediuPreco],
    ["Disseram que querem comprar", dm.intencaoCompra],
    ["Fechamento provável", dm.fechamentoProvavel],
    ["Venda com evidência forte na conversa", dm.vendaEvidenciaForte],
  ];
  return (
    <div className={styles.wrap}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{value.toLocaleString("pt-BR")}</span>
        </div>
      ))}
      <p className={styles.note}>
        {CONFIANCA[dm.confidenceLevel]} · conversas de{" "}
        {formatDate(dm.periodStart)} a {formatDate(dm.periodEnd)}.
        {dm.partialPeriods
          ? " O período escolhido corta algum mês: a contagem vem do mês inteiro."
          : ""}{" "}
        Isso mostra o que foi dito no Instagram. Pix, retirada ou combinado por
        WhatsApp só viram venda quando informados.
        {dm.followupsPending > 0
          ? ` ${dm.followupsPending} conversas de intenção ou fechamento provável pedem retomada.`
          : ""}
      </p>
    </div>
  );
}
