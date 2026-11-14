import Link from 'next/link'
import type { Acceso } from './accesos'
import styles from './AccesoCard.module.css'

// Toda la tarjeta es el link; el "botón" blanco es solo visual.
// Si el acceso todavía no está disponible, se muestra igual pero sin link.
export default function AccesoCard({ acceso }: { acceso: Acceso }) {
  const contenido = (
    <>
      <p className={styles.bajada}>{acceso.bajada}</p>
      <h2 className={styles.titulo}>{acceso.titulo}</h2>
      <p className={styles.descripcion}>{acceso.descripcion}</p>
      <span className={styles.boton}>
        {acceso.boton}
        {!acceso.proximamente && <span aria-hidden="true">→</span>}
      </span>
    </>
  )
  const fondo = { ['--acceso-imagen' as string]: `url(${acceso.imagen})` }

  if (acceso.proximamente) {
    return (
      <div className={`${styles.tarjeta} ${styles.inactiva}`} style={fondo} aria-disabled="true">
        {contenido}
      </div>
    )
  }

  return (
    <Link href={acceso.href} className={styles.tarjeta} style={fondo}>
      {contenido}
    </Link>
  )
}
