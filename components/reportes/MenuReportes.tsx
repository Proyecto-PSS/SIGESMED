import Link from 'next/link'
import styles from './menu-reportes.module.css'

export default function MenuReportes({ href }: { href: string }) {
  return (
    <main className={styles.contenedor}>
      <p className={styles.ruta}>Reportes</p>
      <h1>Reportes</h1>
      <p className={styles.descripcion}>Seleccioná el reporte que querés consultar.</p>
      <Link className={styles.opcion} href={`${href}/stock-vacunas`}>
        <span className={styles.icono} aria-hidden="true">▤</span>
        <span>
          <strong>Stock de vacunas</strong>
          <span className={styles.detalle}>Inventario actual y alertas por stock bajo.</span>
        </span>
        <span className={styles.flecha} aria-hidden="true">→</span>
      </Link>
    </main>
  )
}
