'use client'

import Link from 'next/link'
import { useState } from 'react'
import { RESERVA_CONFIG } from '@/lib/config/reserva-config'
import { esperar, fetchConTimeout } from '@/lib/utils/resilient-fetch'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './mis-citas.module.css'

type Cita = {
  idTurno: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: string
  modalidad?: string | null
  pagos?: Array<{
    idPago: string
    estado: string
    monto: any
    moneda: string
    comprobante?: {
      idComprobante: string
      numeroComprobante: string
      estado: string
      nombreArchivo?: string
    } | null
  }>
  medico: {
    nombre: string
    apellido: string
    especialidad: string
    consultorio: string | null
  }
}

type Props = {
  citas: Cita[]
}

// Partes de la fecha para el bloque de calendario de cada tarjeta (en UTC, como se guardan).
function partesFecha(fecha: string) {
  const d = new Date(fecha)
  const opciones = { timeZone: 'UTC' } as const
  return {
    diaSemana: d.toLocaleDateString('es-AR', { ...opciones, weekday: 'short' }).replace('.', ''),
    numero: d.toLocaleDateString('es-AR', { ...opciones, day: 'numeric' }),
    mes: d.toLocaleDateString('es-AR', { ...opciones, month: 'short' }).replace('.', ''),
  }
}

function formatearFecha(fecha: string) {
  const fechaLocal = new Date(fecha)

  return fechaLocal.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function puedeCancelar(cita: Cita) {
  const [anio, mes, dia] = cita.fecha
    .slice(0, 10)
    .split('-')
    .map(Number)

  const [hora, minutos] = cita.hora
    .split(':')
    .map(Number)

  const fechaTurno = new Date(
    anio,
    mes - 1,
    dia,
    hora,
    minutos,
    0,
    0
  )

  const ahora = new Date()

  const diferenciaMilisegundos =
    fechaTurno.getTime() - ahora.getTime()

  const horasRestantes =
    diferenciaMilisegundos / (1000 * 60 * 60)

  return horasRestantes > 48
}

type EstadoCancelacion = 'idle' | 'cancelando' | 'reintentando' | 'verificando'

export default function MisCitas({ citas }: Props) {
  const [citasActuales, setCitasActuales] = useState(citas)
  const [error, setError] = useState('')
  const [citaSeleccionada, setCitaSeleccionada] = useState<string | null>(null)
  const [estadoCancelacion, setEstadoCancelacion] = useState<EstadoCancelacion>('idle')
  const [descargandoComprobanteId, setDescargandoComprobanteId] = useState<string | null>(null)
  const [errorDescargaComprobante, setErrorDescargaComprobante] = useState<string>('')

  const cancelando = estadoCancelacion !== 'idle'

  async function descargarComprobante(idPago: string, nombreArchivoSugerido?: string) {
    if (descargandoComprobanteId) return
    setDescargandoComprobanteId(idPago)
    setErrorDescargaComprobante('')

    try {
      const res = await fetch(`/api/pagos/${idPago}/comprobante/descargar`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'No se pudo descargar el comprobante.')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivoSugerido || `comprobante-${idPago}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setErrorDescargaComprobante(err.message || 'Error al descargar el comprobante.')
    } finally {
      setDescargandoComprobanteId(null)
    }
  }

  function abrirConfirmacion(idTurno: string) {
    setCitaSeleccionada(idTurno)
    setError('')
  }

  function cerrarConfirmacion() {
    if (cancelando) {
      return
    }

    setCitaSeleccionada(null)
  }

  async function verificarSiFueCancelado(idTurno: string): Promise<boolean> {
    try {
      const res = await fetchConTimeout(
        '/api/pacientes/citas',
        { method: 'GET' },
        RESERVA_CONFIG.VERIFY_TIMEOUT_MS
      )
      if (res.ok) {
        const data = await res.json()
        const citasActualizadas: Cita[] = data.citas ?? []
        // Si ya no figura en la lista de citas activas del paciente, fue cancelado
        return !citasActualizadas.some((c) => c.idTurno === idTurno)
      }
    } catch {
      // Error de verificación
    }
    return false
  }

  async function cancelarCita() {
    if (!citaSeleccionada || cancelando) {
      return
    }

    const idTurnoParaCancelar = citaSeleccionada
    setError('')
    setEstadoCancelacion('cancelando')

    let intento = 0
    let canceladoExitoso = false

    while (intento <= RESERVA_CONFIG.MAX_RETRIES && !canceladoExitoso) {
      try {
        if (intento > 0) {
          setEstadoCancelacion('reintentando')
          const delay = RESERVA_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, intento - 1)
          await esperar(delay)
        }

        const response = await fetchConTimeout(
          `/api/pacientes/citas/${idTurnoParaCancelar}/cancelar`,
          {
            method: 'POST',
          },
          RESERVA_CONFIG.REQUEST_TIMEOUT_MS
        )

        if (response.ok) {
          canceladoExitoso = true
          break
        }

        // Error definitivo de negocio (e.g. 409: menos de 48h, 404: no encontrado, 403: no autorizado)
        if (response.status === 409 || response.status === 400 || response.status === 404 || response.status === 403) {
          const data = await response.json().catch(() => ({}))
          setError(data.error ?? 'No se pudo cancelar el turno')
          setEstadoCancelacion('idle')
          return
        }

        // Error transitorio de servidor (502, 503, 504)
        if ((RESERVA_CONFIG.TRANSIENT_STATUS_CODES as readonly number[]).includes(response.status)) {
          intento++
          continue
        }

        const data = await response.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo cancelar el turno')
        setEstadoCancelacion('idle')
        return
      } catch {
        // Timeout o fallo de red
        intento++
        // Antes del siguiente reintento o si se agotaron, verificar si ya se canceló en el servidor
        setEstadoCancelacion('verificando')
        const yaCancelado = await verificarSiFueCancelado(idTurnoParaCancelar)
        if (yaCancelado) {
          canceladoExitoso = true
          break
        }
      }
    }

    if (canceladoExitoso) {
      setCitasActuales((citasPrevias) =>
        citasPrevias.filter((cita) => cita.idTurno !== idTurnoParaCancelar)
      )
      setCitaSeleccionada(null)
      setError('')
      setEstadoCancelacion('idle')
    } else {
      setError(
        'Error de conexión. No pudimos verificar la cancelación del turno. Tus datos se mantienen intactos. Por favor, intentá nuevamente.'
      )
      setEstadoCancelacion('idle')
    }
  }

  return (
    <div className={ui.pila}>
      {/* Error - los datos de las citas permanecen visibles siempre */}
      {error && (
        <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">
          {error}
        </p>
      )}

      {errorDescargaComprobante && (
        <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">
          {errorDescargaComprobante}
        </p>
      )}

      {/* Sin turnos */}
      {citasActuales.length === 0 && (
        <section className={ui.vacio}>
          <h2 className={ui.tarjetaTitulo}>No tenés turnos próximos</h2>
          <p className={ui.tarjetaTexto}>Cuando reserves un turno, lo vas a ver acá.</p>
          <div style={{ marginTop: '1.25rem' }}>
            <Link href="/dashboard/paciente/reservar-turno" className={ui.botonPrimario}>
              Sacar un turno
            </Link>
          </div>
        </section>
      )}

      {/* Lista de turnos */}
      {citasActuales.length > 0 && (
        <ul className={styles.lista}>
          {citasActuales.map((cita) => {
            const cancelable = puedeCancelar(cita)
            const mostrandoConfirmacion = citaSeleccionada === cita.idTurno
            const esParticular = cita.modalidad !== 'COBERTURA'
            const pago = cita.pagos?.[0]
            const pagoAprobado = pago?.estado === 'APROBADO'
            const fecha = partesFecha(cita.fecha)

            return (
              <li key={cita.idTurno} className={styles.item}>
                <article className={styles.cita}>
                  <div className={styles.fecha} aria-hidden="true">
                    <span className={styles.fechaDia}>{fecha.diaSemana}</span>
                    <span className={styles.fechaNumero}>{fecha.numero}</span>
                    <span className={styles.fechaMes}>{fecha.mes}</span>
                  </div>

                  <div className={styles.info}>
                    <div className={styles.etiquetas}>
                      <span className={`${ui.etiqueta} ${ui.etiquetaPrimaria}`}>
                        {nombreEspecialidadMedica(cita.medico.especialidad)}
                      </span>
                      {esParticular ? (
                        pagoAprobado ? (
                          <span className={`${ui.etiqueta} ${ui.etiquetaExito}`}>Pago aprobado</span>
                        ) : (
                          <span className={`${ui.etiqueta} ${ui.etiquetaAviso}`}>Pago pendiente</span>
                        )
                      ) : (
                        <span className={`${ui.etiqueta} ${ui.etiquetaNeutra}`}>Obra social</span>
                      )}
                    </div>
                    <h2 className={styles.medico}>
                      {cita.medico.nombre} {cita.medico.apellido}
                    </h2>
                    <p className={styles.detalle}>
                      {formatearFecha(cita.fecha)} · {cita.hora} hs
                    </p>
                    <p className={styles.detalle}>{cita.medico.consultorio ?? 'Consultorio a confirmar'}</p>
                  </div>

                  <div className={styles.acciones}>
                    {esParticular && !pagoAprobado && (
                      <Link href={`/dashboard/paciente/pagos/${cita.idTurno}`} className={`${ui.botonPrimario} ${ui.botonChico}`}>
                        Abonar consulta
                      </Link>
                    )}

                    {esParticular && pago && pagoAprobado && (
                      <button
                        type="button"
                        onClick={() => descargarComprobante(pago.idPago, pago.comprobante?.nombreArchivo)}
                        disabled={descargandoComprobanteId === pago.idPago}
                        className={`${ui.botonSecundario} ${ui.botonChico}`}
                        title="Descargar comprobante en PDF"
                      >
                        {descargandoComprobanteId === pago.idPago ? 'Descargando…' : 'Comprobante PDF'}
                      </button>
                    )}

                    {cancelable ? (
                      <button
                        type="button"
                        onClick={() => abrirConfirmacion(cita.idTurno)}
                        disabled={cancelando}
                        className={`${ui.botonPeligro} ${ui.botonChico}`}
                      >
                        Cancelar turno
                      </button>
                    ) : (
                      <span className={styles.nota}>Ya no se puede cancelar (menos de 48 hs)</span>
                    )}
                  </div>
                </article>

                {/* Confirmación de cancelación */}
                {mostrandoConfirmacion && cancelable && (
                  <section className={styles.confirmacion} aria-labelledby={`cancelar-${cita.idTurno}`}>
                    <h3 id={`cancelar-${cita.idTurno}`} className={ui.tarjetaTitulo}>
                      ¿Cancelar este turno?
                    </h3>
                    <p className={ui.tarjetaTexto}>
                      Vas a cancelar el turno del {formatearFecha(cita.fecha)} a las {cita.hora} hs. El horario va a
                      quedar libre para otro paciente.
                    </p>

                    {estadoCancelacion === 'reintentando' && (
                      <p className={`${ui.alerta} ${ui.alertaAviso} ${ui.conIcono}`} role="status" aria-live="polite">
                        <span className={ui.spinner} aria-hidden="true" />
                        Error de conexión, reintentando…
                      </p>
                    )}

                    {estadoCancelacion === 'verificando' && (
                      <p className={`${ui.alerta} ${ui.alertaInfo} ${ui.conIcono}`} role="status" aria-live="polite">
                        <span className={ui.spinner} aria-hidden="true" />
                        Verificando el estado de la cancelación…
                      </p>
                    )}

                    <div className={styles.confirmacionAcciones}>
                      <button
                        type="button"
                        onClick={cerrarConfirmacion}
                        disabled={cancelando}
                        className={ui.botonSecundario}
                      >
                        No, conservar
                      </button>
                      <button
                        type="button"
                        onClick={cancelarCita}
                        disabled={cancelando}
                        className={ui.botonPeligro}
                      >
                        {cancelando && <span className={ui.spinner} aria-hidden="true" />}
                        {estadoCancelacion === 'cancelando'
                          ? 'Cancelando…'
                          : estadoCancelacion === 'reintentando'
                            ? 'Reintentando…'
                            : estadoCancelacion === 'verificando'
                              ? 'Verificando…'
                              : 'Sí, cancelar turno'}
                      </button>
                    </div>
                  </section>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
