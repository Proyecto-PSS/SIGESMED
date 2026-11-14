'use client'

import { useRouter } from 'next/navigation'
import styles from './BotonVolver.module.css'

interface BotonVolverProps {
  /** Adónde ir si no hay página anterior (por ejemplo, si se abrió el link directo). */
  fallback: string
  label?: string
}

// Flecha para volver a la página anterior del historial del navegador.
export default function BotonVolver({ fallback, label = 'Volver' }: BotonVolverProps) {
  const router = useRouter()

  function volver() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button type="button" onClick={volver} className={styles.boton}>
      <svg
        className={styles.flecha}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}
