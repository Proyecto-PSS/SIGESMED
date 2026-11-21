'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { rangoUltimosDias } from '@/lib/utils/reportes-utils'
import {
  formatearMontoARS,
  solicitarReportePagosRealizados,
  TEXTO_SIN_PAGOS_PERIODO,
  validarRangoFechasPagos,
  type ReportePagosRealizadosDTO,
} from '@/lib/utils/reportes-pagos-utils'
import styles from './turnos-especialidad-reporte.module.css'
import estilosPagos from './pagos-realizados-reporte.module.css'

type EstadoReporte = 'inicial' | 'cargando' | 'exito' | 'error' | 'rango_invalido'

const ZONA_HORARIA_AR = 'America/Argentina/Buenos_Aires'
const formatoFechaPago = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const formatoHoraPago = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA_AR,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Las fechas YYYY-MM-DD se muestran como DD/MM/YYYY sin desplazamiento de zona horaria. */
function formatearFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

interface Props {
  reportesHref?: string
}

export default function PagosRealizadosReporte({ reportesHref = '/dashboard/admin/reportes' }: Props) {
  const rangoInicial = rangoUltimosDias(30)
  const [fechaDesde, setFechaDesde] = useState(rangoInicial.desde)
  const [fechaHasta, setFechaHasta] = useState(rangoInicial.hasta)
  const [estado, setEstado] = useState<EstadoReporte>('inicial')
  const [reporte, setReporte] = useState<ReportePagosRealizadosDTO | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  // Evita peticiones duplicadas si se presiona el botón varias veces mientras hay una en curso.
  const consultaEnCurso = useRef(false)

  const generarReporte = async (e: FormEvent) => {
    e.preventDefault()
    if (consultaEnCurso.current) return

    // RF-42.5: validar antes de iniciar cualquier estado de carga o petición HTTP.
    const validacion = validarRangoFechasPagos(fechaDesde, fechaHasta)
    if (!validacion.ok) {
      setReporte(null)
      setMensajeError(validacion.error)
      setEstado('rango_invalido')
      return
    }

    consultaEnCurso.current = true
    setReporte(null)
    setMensajeError(null)
    setEstado('cargando')

    try {
      const resultado = await solicitarReportePagosRealizados(fechaDesde, fechaHasta, (url) =>
        fetch(url, { cache: 'no-store' })
      )

      if (resultado.estado === 'exito') {
        setReporte(resultado.reporte)
        setEstado('exito')
      } else {
        setMensajeError(resultado.error)
        setEstado(resultado.estado)
      }
    } finally {
      consultaEnCurso.current = false
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
          <p className={styles.ruta}>Reportes / Pagos Realizados</p>
          <h1>Pagos Realizados</h1>
          <p>Detalle de los pagos aprobados y total de ingresos del período seleccionado.</p>
        </div>
      </header>

      <div className={styles.filtrosTarjeta}>
        <div className={styles.filtrosCabecera}>
          <h2 className={styles.filtrosTitulo}>Período de consulta</h2>
        </div>

        <form
          onSubmit={generarReporte}
          className={styles.formularioFechas}
          aria-label="Filtrar pagos realizados según rango de fechas"
          noValidate
        >
          <label className={styles.campoFecha} htmlFor="pagos-fecha-desde">
            <span>Fecha Desde</span>
            <input
              id="pagos-fecha-desde"
              name="fechaDesde"
              type="date"
              className={styles.inputFecha}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              aria-invalid={estado === 'rango_invalido'}
              required
            />
          </label>

          <label className={styles.campoFecha} htmlFor="pagos-fecha-hasta">
            <span>Fecha Hasta</span>
            <input
              id="pagos-fecha-hasta"
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
            {cargando ? 'Generando reporte…' : 'Generar Reporte'}
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
          <strong>Todavía no se generó ningún reporte</strong>
          Seleccioná el período y presioná «Generar Reporte» para ver los pagos realizados.
        </div>
      )}

      {cargando && (
        <div className={styles.estadoVacio} role="status">
          Cargando reporte de pagos realizados…
        </div>
      )}

      {estado === 'exito' && reporte && (
        <>
          <div className={styles.resumenGrid}>
            <div className={`${styles.kpiCard} ${estilosPagos.totalDestacado}`}>
              <span className={styles.kpiLabel}>Total Ingresos</span>
              <span className={styles.kpiValor} data-testid="total-ingresos">
                {formatearMontoARS(reporte.totalIngresos)}
              </span>
              <span className={styles.kpiDetalle}>
                Del {formatearFechaCorta(reporte.fechaDesde)} al {formatearFechaCorta(reporte.fechaHasta)}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Pagos aprobados</span>
              <span className={styles.kpiValor}>{reporte.cantidadPagos}</span>
              <span className={styles.kpiDetalle}>Solo se incluyen pagos en estado aprobado.</span>
            </div>
          </div>

          {reporte.sinResultados ? (
            <div className={styles.estadoVacio} role="status">
              <strong>{reporte.mensaje || TEXTO_SIN_PAGOS_PERIODO}</strong>
              Período consultado: {formatearFechaCorta(reporte.fechaDesde)} al{' '}
              {formatearFechaCorta(reporte.fechaHasta)}.
            </div>
          ) : (
            <div className={styles.tablaContenedor}>
              <table className={`${styles.tabla} ${estilosPagos.tablaPagos}`}>
                <thead>
                  <tr>
                    <th scope="col">Fecha de pago</th>
                    <th scope="col">Paciente</th>
                    <th scope="col">Profesional</th>
                    <th scope="col">Turno</th>
                    <th scope="col">Comprobante</th>
                    <th scope="col" className={styles.columnaNumero}>
                      Importe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.pagos.map((pago) => {
                    const instantePago = new Date(pago.fechaPago)
                    const fechaPago = formatoFechaPago.format(instantePago)
                    const horaPago = `${formatoHoraPago.format(instantePago)} h`
                    return (
                      <tr key={pago.idPago}>
                        <td className={estilosPagos.sinCorte}>
                          <span className={estilosPagos.principal}>{fechaPago}</span>
                          <span className={estilosPagos.secundario}>{horaPago}</span>
                        </td>
                        <th scope="row">{pago.paciente}</th>
                        <td>
                          <span className={estilosPagos.principal}>{pago.profesional}</span>
                          <span className={estilosPagos.secundario}>{pago.especialidad}</span>
                        </td>
                        <td className={estilosPagos.sinCorte}>
                          <span className={estilosPagos.principal}>
                            {formatearFechaCorta(pago.fechaTurno)}
                          </span>
                          <span className={estilosPagos.secundario}>{pago.horaTurno} h</span>
                        </td>
                        <td>
                          <span className={`${estilosPagos.principal} ${estilosPagos.comprobante}`}>
                            {pago.numeroComprobante ?? 'Sin comprobante'}
                          </span>
                          <span className={estilosPagos.secundario}>{pago.medioPago}</span>
                        </td>
                        <td className={`${styles.columnaNumero} ${estilosPagos.importe}`}>
                          {formatearMontoARS(pago.monto)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={5}>
                      Total Ingresos ({reporte.cantidadPagos}{' '}
                      {reporte.cantidadPagos === 1 ? 'pago' : 'pagos'})
                    </th>
                    <td className={`${styles.columnaNumero} ${estilosPagos.importe}`}>
                      {formatearMontoARS(reporte.totalIngresos)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
