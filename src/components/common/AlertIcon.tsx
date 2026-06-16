import React from 'react';

export type AlertType =
  | 'ctr_low'
  | 'cpa_high'
  | 'frequency_high'
  | 'engagement_low'
  | 'avatar_misaligned'
  | 'fatigue_high'
  | 'boost_candidate';

interface AlertIconProps {
  type: AlertType;
  className?: string;
}

const ICON_MAP: Record<AlertType, string> = {
  ctr_low:           '📉',
  cpa_high:          '💸',
  frequency_high:    '🔄',
  engagement_low:    '⚡',
  avatar_misaligned: '🎯',
  fatigue_high:      '😴',
  boost_candidate:   '🚀',
};

export default function AlertIcon({ type, className = '' }: AlertIconProps): React.ReactElement {
  return (
    <span role="img" aria-label={type} className={`text-base leading-none select-none ${className}`}>
      {ICON_MAP[type]}
    </span>
  );
}
