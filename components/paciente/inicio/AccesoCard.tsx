import Link from 'next/link'
import type { Acceso } from './accesos'
import styles from './AccesoCard.module.css'

// Toda la tarjeta es el link; el "botón" blanco es solo visual.
export default function AccesoCard({ acceso }: { acceso: Acceso }) {
  return (
    <Link
      href={acceso.href}
      className={styles.tarjeta}
      style={{ ['--acceso-imagen' as string]: `url(${acceso.imagen})` }}
    >
      <p className={styles.bajada}>{acceso.bajada}</p>
      <h2 className={styles.titulo}>{acceso.titulo}</h2>
      <p className={styles.descripcion}>{acceso.descripcion}</p>
      <span className={styles.boton}>
        {acceso.boton}
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  )
}
