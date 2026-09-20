import styles from './DataStatusNotice.module.css'
import type { DataStatusNotice as Notice } from '@/lib/dataStatusCopy'

export interface DataStatusNoticeProps {
  notices: Notice[]
}

export function DataStatusNotice({ notices }: DataStatusNoticeProps) {
  if (notices.length === 0) return null
  return (
    <section className={styles.notice} role="note" aria-label="Sobre os dados deste cliente">
      <ul className={styles.list}>
        {notices.map((n) => (
          <li key={n.id} className={styles.item}>
            {n.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
