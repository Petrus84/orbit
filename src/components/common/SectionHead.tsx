import React from 'react';
import styles from './SectionHead.module.css';

interface SectionHeadProps {
  title: string;
  subtitle?: string;
}

export default function SectionHead({ title, subtitle }: SectionHeadProps): React.ReactElement {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}