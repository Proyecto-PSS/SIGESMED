import Link from 'next/link'
import styles from './menu-reportes.module.css'

export default function MenuReportes({ href }: { href: string }) {
  const esAdmin = href.includes('/admin/')

  return (
    <main className={styles.contenedor}>
      <p className={styles.ruta}>Reportes</p>
      <h1>Reportes</h1>
      <p className={styles.descripcion}>Seleccioná el reporte que querés consultar.</p>
      <div className={styles.listaOpciones}>
        {esAdmin && (
          <Link className={styles.opcion} href={`${href}/turnos-especialidad`}>
            <span className={styles.icono} aria-hidden="true">📊</span>
            <span>
              <strong>Turnos por Especialidad</strong>
              <span className={styles.detalle}>
                Cantidad de turnos agrupados por especialidad médica según rango de fechas.
              </span>
            </span>
            <span className={styles.flecha} aria-hidden="true">→</span>
          </Link>
        )}
        {esAdmin && (
          <Link className={styles.opcion} href={`${href}/asistencia`}>
            <span className={styles.icono} aria-hidden="true">✓</span>
            <span>
              <strong>Asistencia</strong>
              <span className={styles.detalle}>
                Porcentaje de turnos atendidos, ausentes y cancelados según rango de fechas.
              </span>
            </span>
            <span className={styles.flecha} aria-hidden="true">→</span>
          </Link>
        )}
        {esAdmin && (
          <Link className={styles.opcion} href={`${href}/pagos-realizados`}>
            <span className={styles.icono} aria-hidden="true">$</span>
            <span>
              <strong>Pagos Realizados</strong>
              <span className={styles.detalle}>
                Detalle de pagos aprobados y total de ingresos según rango de fechas.
              </span>
            </span>
            <span className={styles.flecha} aria-hidden="true">→</span>
          </Link>
        )}
        <Link className={styles.opcion} href={`${href}/stock-vacunas`}>
          <span className={styles.icono} aria-hidden="true">▤</span>
          <span>
            <strong>Stock de vacunas</strong>
            <span className={styles.detalle}>Inventario actual y alertas por stock bajo.</span>
          </span>
          <span className={styles.flecha} aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  )
}
