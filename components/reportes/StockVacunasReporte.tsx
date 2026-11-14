'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { StockVacuna } from '@/lib/utils/reportes-utils'
import styles from './stock-vacunas-reporte.module.css'

const numero = new Intl.NumberFormat('es-AR')

export default function StockVacunasReporte({ reportesHref }: { reportesHref: string }) {
  const [vacunas, setVacunas] = useState<StockVacuna[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargarStock = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const response = await fetch('/api/reportes/stock-vacunas', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el stock de vacunas.')
      setVacunas(data.vacunas ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el reporte.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargarStock() }, [cargarStock])

  return (
    <section className={styles.reporte} aria-busy={cargando}>
      <header className={styles.encabezado}>
        <div>
          <Link className={styles.volver} href={reportesHref}>← Volver a Reportes</Link>
          <p className={styles.ruta}>Reportes / Stock de vacunas</p>
          <h1>Stock de vacunas</h1>
          <p>Inventario actual y alertas según el umbral mínimo de cada vacuna.</p>
        </div>
        <button type="button" onClick={() => void cargarStock()} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {cargando && vacunas.length === 0 ? (
        <p className={styles.estado} role="status">Cargando inventario…</p>
      ) : vacunas.length === 0 ? (
        <p className={styles.estado}>No hay vacunas registradas.</p>
      ) : (
        <div className={styles.tablaContenedor}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th scope="col">Vacuna</th>
                <th scope="col">Stock actual</th>
                <th scope="col">Umbral mínimo</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {vacunas.map((vacuna) => (
                <tr key={vacuna.idVacuna} className={vacuna.stockBajo ? styles.stockBajo : undefined}>
                  <th scope="row">{vacuna.nombre}</th>
                  <td>{numero.format(vacuna.stock)} dosis</td>
                  <td>{numero.format(vacuna.umbralAlerta)} dosis</td>
                  <td>
                    {vacuna.stockBajo
                      ? <span className={styles.alerta}>⚠ Stock bajo</span>
                      : <span className={styles.normal}>✓ Normal</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.pie}>
        {vacunas.length} {vacunas.length === 1 ? 'vacuna registrada' : 'vacunas registradas'}
        {vacunas.some((vacuna) => vacuna.stockBajo)
          ? ` · ${vacunas.filter((vacuna) => vacuna.stockBajo).length} con stock bajo`
          : ' · Sin alertas de stock'}
      </p>
    </section>
  )
}
