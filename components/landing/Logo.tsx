import Link from 'next/link'
import styles from './Logo.module.css'

export default function Logo({ tono = 'oscuro', href = '/' }: { tono?: 'oscuro' | 'claro'; href?: string }) {
  return (
    <Link href={href} className={`${styles.logo} ${styles[tono]}`} aria-label="SIGESMED, ir al inicio">
      <svg
        className={styles.icono}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 3H5a2 2 0 0 0-2 2v4a5 5 0 0 0 10 0V5a2 2 0 0 0-2-2h-1" />
        <path d="M8 14v1a6 6 0 0 0 12 0v-2" />
        <circle cx="20" cy="11" r="2" />
      </svg>
      <span className={styles.texto}>SIGESMED</span>
    </Link>
  )
}
