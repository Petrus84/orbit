import React, { useState } from 'react';
import { GlassCard } from './GlassCard';
import styles from './RecommendationAlert.module.css';
import type { AlignmentStatus } from '@/types/avatar';
import type { AvatarRecommendation, GlowColor } from '@/types/orbit';

interface RecommendationAlertProps {
  status: AlignmentStatus;
  score: number;
  // ✅ FIX: dado real por cliente, calculado em avatarRepository.ts a partir
  // das barras reais de alinhamento. Opcionais para não quebrar nenhum outro
  // caller existente que ainda não os passa — nesse caso cai no fallback
  // estático de sempre (STATUS_CONFIG), como já acontecia antes desta mudança.
  recommendation?: AvatarRecommendation | null;
  recommendations?: AvatarRecommendation[];
}

// ✅ FIX: efeito glass card no cartão inteiro, cor = diagnóstico real do
// cliente (mesmo mapeamento de AvatarComparison/AlignmentBars).
const STATUS_TO_GLOW: Record<AlignmentStatus, GlowColor> = {
  critical: 'red',
  warning: 'gold',
  healthy: 'green',
};

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

export const RecommendationAlert: React.FC<RecommendationAlertProps> = ({
  status,
  score,
  recommendation,
  recommendations,
}) => {
  const [expanded, setExpanded] = useState(true);
  const fallbackCfg = STATUS_CONFIG[status];

  // ✅ FIX: antes o texto era 100% estático por status (STATUS_CONFIG),
  // idêntico para qualquer cliente com o mesmo status — podendo contradizer
  // os números reais da própria tela (ex.: dizer "concentração no RJ" para
  // um cliente cuja audiência real está em SP). Agora, se o repository
  // mandou recomendação(ões) reais calculadas para este cliente, elas têm
  // prioridade; o texto estático só aparece quando não há dado real.
  const realRecommendations: RecommendationItem[] =
    recommendations && recommendations.length > 0
      ? recommendations.map((rec) => ({
          icon: rec.icon ?? fallbackCfg.icon,
          title: rec.title,
          desc: rec.description,
        }))
      : recommendation
        ? [
            {
              icon: recommendation.icon ?? fallbackCfg.icon,
              title: recommendation.title,
              desc: recommendation.description,
            },
          ]
        : [];

  const cfg: StatusConfig = {
    ...fallbackCfg,
    recommendations: realRecommendations.length > 0 ? realRecommendations : fallbackCfg.recommendations,
  };

  return (
    <GlassCard glowColor={STATUS_TO_GLOW[status]} className={`${styles.wrapper} ${styles[status]}`}>
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
    </GlassCard>
  );
};