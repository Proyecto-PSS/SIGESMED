'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  rangoUltimosDias,
  TEXTO_RANGO_FECHAS_INVERTIDO,
  TEXTO_SIN_TURNOS_PERIODO,
  type ReporteTurnosPorEspecialidadDTO,
} from '@/lib/utils/reportes-utils'
import { parseFechaFiltro } from '@/lib/utils/admin-turnos-utils'
import styles from './turnos-especialidad-reporte.module.css'

const formatoNumero = new Intl.NumberFormat('es-AR')
const PERIODOS_RAPIDOS = [7, 30, 90] as const

const COLORES_ESPECIALIDAD: Record<string, string> = {
  CLINICA_MEDICA: '#00899c',
  PEDIATRIA: '#6b5bd6',
  TRAUMATOLOGIA_ORTOPEDIA: '#d0782e',
}

interface Props {
  reportesHref?: string
  ocultarVolver?: boolean
}

export default function TurnosEspecialidadReporte({
  reportesHref = '/dashboard/admin/reportes',
  ocultarVolver = false,
}: Props) {
  const rangoInicial = rangoUltimosDias(30)
  const [fechaDesde, setFechaDesde] = useState(rangoInicial.desde)
  const [fechaHasta, setFechaHasta] = useState(rangoInicial.hasta)
  const [reporte, setReporte] = useState<ReporteTurnosPorEspecialidadDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const consultarReporte = useCallback(async (desde: string, hasta: string) => {
    setError(null)

    const desdeLimpia = desde.trim()
    const hastaLimpia = hasta.trim()

    if (!desdeLimpia || !hastaLimpia) {
      setError('Las fechas desde y hasta son obligatorias para generar el reporte.')
      return
    }

    const desdeDate = parseFechaFiltro(desdeLimpia)
    const hastaDate = parseFechaFiltro(hastaLimpia)

    if (!desdeDate || !hastaDate) {
      setError('El formato de fecha es inválido. Debe utilizarse el formato YYYY-MM-DD.')
      return
    }

    if (desdeDate.getTime() > hastaDate.getTime()) {
      setError(TEXTO_RANGO_FECHAS_INVERTIDO)
      return
    }

    setCargando(true)
    try {
      const params = new URLSearchParams({
        fechaDesde: desdeLimpia,
        fechaHasta: hastaLimpia,
      })
      const response = await fetch(`/api/admin/reportes/turnos-especialidad?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el reporte de turnos por especialidad.')
      }

      setReporte(data)
    } catch (err: any) {
      setError(err?.message || 'Error al conectar con el servidor de reportes.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultarReporte(rangoInicial.desde, rangoInicial.hasta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultarReporte])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void consultarReporte(fechaDesde, fechaHasta)
  }

  const handleSeleccionarPeriodoRapido = (dias: number) => {
    const nuevo = rangoUltimosDias(dias)
    setFechaDesde(nuevo.desde)
    setFechaHasta(nuevo.hasta)
    void consultarReporte(nuevo.desde, nuevo.hasta)
  }

  const especialidades = reporte?.especialidades ?? []
  const totalGeneral = reporte?.totalGeneral ?? 0
  const maximoEspecialidad = Math.max(0, ...especialidades.map((e) => e.cantidad))

  const totalConfirmados = especialidades.reduce((acc, e) => acc + e.porEstado.CONFIRMADO, 0)
  const totalAtendidos = especialidades.reduce((acc, e) => acc + e.porEstado.ATENDIDO, 0)
  const totalAusentes = especialidades.reduce((acc, e) => acc + e.porEstado.AUSENTE, 0)
  const totalCancelados = especialidades.reduce((acc, e) => acc + e.porEstado.CANCELADO, 0)

  return (
    <section className={styles.reporte} aria-busy={cargando}>
      <header className={styles.encabezado}>
        <div>
          {!ocultarVolver && (
            <Link className={styles.volver} href={reportesHref}>
              ← Volver a Reportes
            </Link>
          )}
          <p className={styles.ruta}>Reportes / Turnos por Especialidad</p>
          <h1>Turnos por Especialidad</h1>
          <p>
            Cantidad de turnos reservados y efectivos agrupados por área clínica dentro del período
            seleccionado.
          </p>
        </div>
      </header>

      {/* Filtros de Rango de Fechas (RF-40.1) */}
      <div className={styles.filtrosTarjeta}>
        <div className={styles.filtrosCabecera}>
          <h2 className={styles.filtrosTitulo}>Período de consulta</h2>
          <div className={styles.chips} role="group" aria-label="Períodos rápidos">
            {PERIODOS_RAPIDOS.map((dias) => {
              const op = rangoUltimosDias(dias)
              const activo = op.desde === fechaDesde && op.hasta === fechaHasta
              return (
                <button
                  key={dias}
                  type="button"
                  onClick={() => handleSeleccionarPeriodoRapido(dias)}
                  className={`${styles.chip} ${activo ? styles.chipActivo : ''}`}
                  aria-pressed={activo}
                >
                  Últimos {dias} días
                </button>
              )
            })}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={styles.formularioFechas}
          aria-label="Filtrar turnos por especialidad según rango de fechas"
          noValidate
        >
          <label className={styles.campoFecha} htmlFor="fecha-desde-input">
            <span>Fecha desde</span>
            <input
              id="fecha-desde-input"
              name="fechaDesde"
              type="date"
              className={styles.inputFecha}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              required
            />
          </label>

          <label className={styles.campoFecha} htmlFor="fecha-hasta-input">
            <span>Fecha hasta</span>
            <input
              id="fecha-hasta-input"
              name="fechaHasta"
              type="date"
              className={styles.inputFecha}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              required
            />
          </label>

          <button type="submit" className={styles.botonGenerar} disabled={cargando}>
            {cargando ? 'Generando reporte…' : 'Generar Reporte'}
          </button>
        </form>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {cargando && !reporte ? (
        <div className={styles.estadoVacio} role="status">
          Cargando reporte de turnos por especialidad…
        </div>
      ) : reporte && reporte.totalGeneral === 0 ? (
        <div className={styles.estadoVacio} role="status">
          <strong>{reporte.mensaje || TEXTO_SIN_TURNOS_PERIODO}</strong>
          <p style={{ margin: '0.25rem 0 0' }}>
            Período consultado: {reporte.fechaDesde} al {reporte.fechaHasta}.
          </p>
        </div>
      ) : reporte ? (
        <>
          {/* Tarjetas totalizadoras */}
          <div className={styles.resumenGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total general de turnos</span>
              <span className={styles.kpiValor}>{formatoNumero.format(totalGeneral)}</span>
              <span className={styles.kpiDetalle}>
                Del {reporte.fechaDesde} al {reporte.fechaHasta}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Confirmados y Atendidos</span>
              <span className={styles.kpiValor}>
                {formatoNumero.format(totalConfirmados + totalAtendidos)}
              </span>
              <span className={styles.kpiDetalle}>
                {formatoNumero.format(totalConfirmados)} confirmados ·{' '}
                {formatoNumero.format(totalAtendidos)} atendidos
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Ausentes y Cancelados</span>
              <span className={styles.kpiValor}>
                {formatoNumero.format(totalAusentes + totalCancelados)}
              </span>
              <span className={styles.kpiDetalle}>
                {formatoNumero.format(totalAusentes)} ausentes ·{' '}
                {formatoNumero.format(totalCancelados)} cancelados
              </span>
            </div>
          </div>

          {/* Gráfico comparativo de barras */}
          <div className={styles.graficoTarjeta}>
            <h2 className={styles.graficoTitulo}>Distribución por especialidad médica</h2>
            <ul className={styles.listaBarras} aria-label="Gráfico de turnos por especialidad">
              {especialidades.map((item) => {
                const anchoPct =
                  maximoEspecialidad > 0 ? Math.round((item.cantidad / maximoEspecialidad) * 100) : 0
                const color = COLORES_ESPECIALIDAD[item.especialidad] ?? '#237b88'
                return (
                  <li key={item.especialidad} className={styles.filaBarra}>
                    <div className={styles.cabeceraBarra}>
                      <span className={styles.nombreEspecialidad}>{item.nombre}</span>
                      <span className={styles.valorBarra}>
                        {formatoNumero.format(item.cantidad)}{' '}
                        {item.cantidad === 1 ? 'turno' : 'turnos'} ({item.porcentaje.toFixed(2)}%)
                      </span>
                    </div>
                    <div className={styles.pistaBarra}>
                      <div
                        className={styles.rellenoBarra}
                        style={{ width: `${anchoPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Tabla analítica con desglose y totalizador general */}
          <div className={styles.tablaContenedor}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th scope="col">Especialidad médica</th>
                  <th scope="col" className={styles.columnaNumero}>
                    Confirmados
                  </th>
                  <th scope="col" className={styles.columnaNumero}>
                    Atendidos
                  </th>
                  <th scope="col" className={styles.columnaNumero}>
                    Ausentes
                  </th>
                  <th scope="col" className={styles.columnaNumero}>
                    Cancelados
                  </th>
                  <th scope="col" className={styles.columnaNumero}>
                    Total turnos
                  </th>
                  <th scope="col" className={styles.columnaNumero}>
                    Participación
                  </th>
                </tr>
              </thead>
              <tbody>
                {especialidades.map((item) => (
                  <tr key={item.especialidad}>
                    <th scope="row">{item.nombre}</th>
                    <td className={styles.columnaNumero}>
                      {formatoNumero.format(item.porEstado.CONFIRMADO)}
                    </td>
                    <td className={styles.columnaNumero}>
                      {formatoNumero.format(item.porEstado.ATENDIDO)}
                    </td>
                    <td className={styles.columnaNumero}>
                      {formatoNumero.format(item.porEstado.AUSENTE)}
                    </td>
                    <td className={styles.columnaNumero}>
                      {formatoNumero.format(item.porEstado.CANCELADO)}
                    </td>
                    <td className={styles.columnaNumero}>
                      <strong>{formatoNumero.format(item.cantidad)}</strong>
                    </td>
                    <td className={styles.columnaNumero}>
                      <span className={styles.badgePorcentaje}>{item.porcentaje.toFixed(2)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total general</th>
                  <td className={styles.columnaNumero}>{formatoNumero.format(totalConfirmados)}</td>
                  <td className={styles.columnaNumero}>{formatoNumero.format(totalAtendidos)}</td>
                  <td className={styles.columnaNumero}>{formatoNumero.format(totalAusentes)}</td>
                  <td className={styles.columnaNumero}>{formatoNumero.format(totalCancelados)}</td>
                  <td className={styles.columnaNumero}>{formatoNumero.format(totalGeneral)}</td>
                  <td className={styles.columnaNumero}>100.00%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}

