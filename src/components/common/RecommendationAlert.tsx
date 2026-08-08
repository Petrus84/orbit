import React, { useState } from 'react';
import styles from './RecommendationAlert.module.css';
import type { AlignmentStatus } from '../../types/avatar';

interface RecommendationAlertProps {
  status: AlignmentStatus;
  score: number;
}

interface RecommendationItem {
  icon: string;
  title: string;
  desc: string;
}

interface StatusConfig {
  icon: string;
  title: string;
  badgeLabel: string;
  recommendations: RecommendationItem[];
}

// Conteúdo puro — nenhuma classe/cor Tailwind aqui. A cor vem inteira do
// modificador .critical/.warning/.healthy no module.css (mesmo vocabulário
// de severidade de AlertCard/Semaphore).
const STATUS_CONFIG: Record<AlignmentStatus, StatusConfig> = {
  critical: {
    icon: '🚨',
    title: 'Alinhamento Crítico — Ação Imediata Necessária',
    badgeLabel: 'CRÍTICO',
    recommendations: [
      {
        icon: '🎯',
        title: 'Revisar segmentação de anúncios',
        desc: 'Ajuste os critérios de gênero nas campanhas pagas — o desvio de 31pp é o principal driver do score baixo.',
      },
      {
        icon: '📅',
        title: 'Auditar faixa etária',
        desc: 'A audiência real está 10 anos acima do avatar definido. Considere revisar o posicionamento de conteúdo.',
      },
      {
        icon: '📍',
        title: 'Verificar geotargeting',
        desc: 'Concentração em RJ diverge do foco em SP. Ative exclusões geográficas ou crie campanhas regionais separadas.',
      },
      {
        icon: '🔄',
        title: 'Redefinir avatar ou estratégia',
        desc: 'Se a audiência real é recorrente e engajada, considere atualizar o avatar para refletir a realidade atual.',
      },
    ],
  },
  warning: {
    icon: '⚠️',
    title: 'Alinhamento com Desvios — Monitoramento Recomendado',
    badgeLabel: 'ATENÇÃO',
    recommendations: [
      {
        icon: '📊',
        title: 'Monitorar tendências',
        desc: 'Acompanhe as métricas semanalmente para detectar desvios crescentes antes que se tornem críticos.',
      },
      {
        icon: '🎯',
        title: 'Ajustes pontuais de segmentação',
        desc: 'Pequenos ajustes nas variáveis com menor alinhamento podem elevar o score rapidamente.',
      },
    ],
  },
  healthy: {
    icon: '✅',
    title: 'Alinhamento Saudável — Continue o Bom Trabalho',
    badgeLabel: 'SAUDÁVEL',
    recommendations: [
      {
        icon: '📈',
        title: 'Manter a estratégia atual',
        desc: 'O avatar está bem alinhado com a audiência real. Continue monitorando para manter esse nível.',
      },
    ],
  },
};

export const RecommendationAlert: React.FC<RecommendationAlertProps> = ({ status, score }) => {
  const [expanded, setExpanded] = useState(true);
  const cfg = STATUS_CONFIG[status];

  return (
    <div className={`${styles.wrapper} ${styles[status]}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={styles.headerBtn}
        aria-expanded={expanded}
      >
        <div className={styles.iconBadge} aria-hidden="true">
          {cfg.icon}
        </div>

        <div className={styles.headerText}>
          <div className={styles.metaRow}>
            <span className={styles.badge}>{cfg.badgeLabel}</span>
            <span className={styles.scoreText}>Score: {score}%</span>
          </div>
          <p className={styles.headline}>{cfg.title}</p>
        </div>

        <span className={styles.chevron} aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.divider} />
          {cfg.recommendations.map((rec, i) => (
            <div key={i} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden="true">
                {rec.icon}
              </span>
              <div>
                <p className={styles.itemTitle}>{rec.title}</p>
                <p className={styles.itemDesc}>{rec.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};