'use client'

import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { rangoUltimosDias } from '@/lib/utils/reportes-utils'
import {
  formatearPorcentajeAsistencia,
  solicitarReporteAsistencia,
  TEXTO_SIN_TURNOS_FINALIZADOS,
  validarRangoFechasAsistencia,
  type MetricaAsistencia,
  type ReporteAsistenciaDTO,
} from '@/lib/utils/reportes-asistencia-utils'
import styles from './turnos-especialidad-reporte.module.css'
import estilosAsistencia from './asistencia-reporte.module.css'

type EstadoReporte = 'inicial' | 'cargando' | 'exito' | 'error' | 'rango_invalido'

const formatoNumero = new Intl.NumberFormat('es-AR')

/** Las fechas YYYY-MM-DD se muestran como DD/MM/YYYY sin desplazamiento de zona horaria. */
function formatearFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

const TARJETAS = [
  { clave: 'atendidos', titulo: 'Atendidos', color: '#1a8f5a', singular: 'turno atendido', plural: 'turnos atendidos' },
  { clave: 'ausentes', titulo: 'Ausentes', color: '#c66a32', singular: 'turno ausente', plural: 'turnos ausentes' },
  { clave: 'cancelados', titulo: 'Cancelados', color: '#b42318', singular: 'turno cancelado', plural: 'turnos cancelados' },
] as const

interface Props {
  reportesHref?: string
}

export default function AsistenciaReporte({ reportesHref = '/dashboard/admin/reportes' }: Props) {
  const rangoInicial = rangoUltimosDias(30)
  const [fechaDesde, setFechaDesde] = useState(rangoInicial.desde)
  const [fechaHasta, setFechaHasta] = useState(rangoInicial.hasta)
  const [estado, setEstado] = useState<EstadoReporte>('inicial')
  const [reporte, setReporte] = useState<ReporteAsistenciaDTO | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  // Solo la última consulta puede actualizar las tarjetas: evita mezclar resultados de rangos distintos.
  const ultimaConsulta = useRef(0)

  const generarReporte = async (e: FormEvent) => {
    e.preventDefault()

    // Validar antes de iniciar cualquier estado de carga o petición HTTP.
    const validacion = validarRangoFechasAsistencia(fechaDesde, fechaHasta)
    if (!validacion.ok) {
      ultimaConsulta.current += 1
      setReporte(null)
      setMensajeError(validacion.error)
      setEstado('rango_invalido')
      return
    }

    const idConsulta = ++ultimaConsulta.current
    setReporte(null)
    setMensajeError(null)
    setEstado('cargando')

    const resultado = await solicitarReporteAsistencia(fechaDesde, fechaHasta, (url) =>
      fetch(url, { cache: 'no-store' })
    )
    if (idConsulta !== ultimaConsulta.current) return

    if (resultado.estado === 'exito') {
      setReporte(resultado.reporte)
      setEstado('exito')
    } else {
      setMensajeError(resultado.error)
      setEstado(resultado.estado)
    }
  }

  const cargando = estado === 'cargando'
  const errorVisible = estado === 'error' || estado === 'rango_invalido'

  return (
    <section className={styles.reporte} aria-busy={cargando}>
      <header className={styles.encabezado}>
        <div>
          <Link className={styles.volver} href={reportesHref}>
            ← Volver a Reportes
          </Link>
          <p className={styles.ruta}>Reportes / Asistencia</p>
          <h1>Asistencia de pacientes</h1>
          <p>Porcentaje de turnos atendidos, ausentes y cancelados del período seleccionado.</p>
        </div>
      </header>

      <div className={styles.filtrosTarjeta}>
        <div className={styles.filtrosCabecera}>
          <h2 className={styles.filtrosTitulo}>Período de consulta</h2>
        </div>

        <form
          onSubmit={generarReporte}
          className={styles.formularioFechas}
          aria-label="Filtrar asistencia de pacientes según rango de fechas"
          noValidate
        >
          <label className={styles.campoFecha} htmlFor="asistencia-fecha-desde">
            <span>Fecha Desde</span>
            <input
              id="asistencia-fecha-desde"
              name="fechaDesde"
              type="date"
              className={styles.inputFecha}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              aria-invalid={estado === 'rango_invalido'}
              required
            />
          </label>

          <label className={styles.campoFecha} htmlFor="asistencia-fecha-hasta">
            <span>Fecha Hasta</span>
            <input
              id="asistencia-fecha-hasta"
              name="fechaHasta"
              type="date"
              className={styles.inputFecha}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              aria-invalid={estado === 'rango_invalido'}
              required
            />
          </label>

          <button type="submit" className={styles.botonGenerar} disabled={cargando}>
            {cargando ? 'Aplicando filtros…' : 'Aplicar filtros'}
          </button>
        </form>
      </div>

      {errorVisible && mensajeError && (
        <div className={styles.error} role="alert">
          {mensajeError}
        </div>
      )}

      {estado === 'inicial' && (
        <div className={styles.estadoVacio} role="status">
          <strong>Todavía no se aplicaron filtros</strong>
          Seleccioná el período y presioná «Aplicar filtros» para ver las métricas de asistencia.
        </div>
      )}

      {cargando && (
        <div className={styles.estadoVacio} role="status">
          Calculando métricas de asistencia…
        </div>
      )}

      {estado === 'exito' && reporte && (
        <>
          <p className={estilosAsistencia.periodo}>
            Del {formatearFechaCorta(reporte.fechaDesde)} al {formatearFechaCorta(reporte.fechaHasta)} ·{' '}
            {formatoNumero.format(reporte.totalTurnosFinalizados)}{' '}
            {reporte.totalTurnosFinalizados === 1 ? 'turno finalizado' : 'turnos finalizados'}
          </p>

          <div className={styles.resumenGrid}>
            {TARJETAS.map((tarjeta) => (
              <TarjetaMetrica
                key={tarjeta.clave}
                titulo={tarjeta.titulo}
                color={tarjeta.color}
                metrica={reporte[tarjeta.clave]}
                sinDatos={reporte.sinResultados}
                unidad={reporte[tarjeta.clave].cantidad === 1 ? tarjeta.singular : tarjeta.plural}
                clave={tarjeta.clave}
              />
            ))}
          </div>

          {reporte.sinResultados && (
            <div className={styles.estadoVacio} role="status">
              <strong>{reporte.mensaje || TEXTO_SIN_TURNOS_FINALIZADOS}</strong>
              Período consultado: {formatearFechaCorta(reporte.fechaDesde)} al{' '}
              {formatearFechaCorta(reporte.fechaHasta)}.
            </div>
          )}

          {reporte.turnosNoFinalizados > 0 && (
            <p className={estilosAsistencia.nota} role="note">
              {formatoNumero.format(reporte.turnosNoFinalizados)}{' '}
              {reporte.turnosNoFinalizados === 1
                ? 'turno confirmado todavía no tiene estado final y no se contabiliza'
                : 'turnos confirmados todavía no tienen estado final y no se contabilizan'}{' '}
              en estas métricas.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function TarjetaMetrica({
  titulo,
  color,
  metrica,
  sinDatos,
  unidad,
  clave,
}: {
  titulo: string
  color: string
  metrica: MetricaAsistencia
  sinDatos: boolean
  unidad: string
  clave: string
}) {
  const porcentaje = formatearPorcentajeAsistencia(metrica.porcentaje)
  return (
    <div
      className={`${styles.kpiCard} ${estilosAsistencia.tarjeta}`}
      style={
        { '--acento': color, '--proporcion': metrica.porcentaje / 100, borderLeftColor: color } as CSSProperties
      }
    >
      <span className={styles.kpiLabel}>{titulo}</span>
      <span className={styles.kpiValor} data-testid={`porcentaje-${clave}`}>
        {porcentaje}
      </span>
      <span
        className={estilosAsistencia.pista}
        role="meter"
        aria-label={`${titulo}: ${porcentaje}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={metrica.porcentaje}
      >
        <span className={estilosAsistencia.relleno} />
      </span>
      <span className={styles.kpiDetalle}>
        {sinDatos ? 'Sin turnos finalizados' : `${formatoNumero.format(metrica.cantidad)} ${unidad}`}
      </span>
    </div>
  )
}
