'use client'

import { useState } from 'react'
import { RESERVA_CONFIG } from '@/lib/config/reserva-config'
import { esperar, fetchConTimeout } from '@/lib/utils/resilient-fetch'

type Cita = {
  idTurno: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: string
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

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
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

  const cancelando = estadoCancelacion !== 'idle'

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
    <>
      {/* Error - los datos de las citas permanecen visibles siempre */}
      {error && (
        <section className="mt-6 border border-red-200 bg-red-50 p-6" role="alert">
          <p className="text-sm text-red-800">
            {error}
          </p>
        </section>
      )}

      {/* Sin turnos */}
      {citasActuales.length === 0 && (
        <section className="mt-6 border border-slate-300 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Próximos turnos
          </p>

          <h2 className="mt-3 text-base font-bold">
            No tenés turnos confirmados
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Actualmente no tenés citas programadas.
          </p>

          <a
            href="/dashboard/paciente/reservar-turno"
            className="mt-5 inline-block bg-black px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Solicitar un turno
          </a>
        </section>
      )}

      {/* Lista de turnos */}
      {citasActuales.length > 0 && (
        <section className="mt-6 space-y-4">
          {citasActuales.map((cita) => {
            const cancelable = puedeCancelar(cita)
            const mostrandoConfirmacion = citaSeleccionada === cita.idTurno

            return (
              <div key={cita.idTurno} className="space-y-3">
                {/* Tarjeta del turno */}
                <article className="border border-slate-300 bg-white px-4 py-4">
                  {/* Cabecera de tarjeta */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                    <span className="text-[11px] font-medium uppercase tracking-wide">
                      Turno activo
                    </span>

                    <span className="text-xs text-slate-700">
                      ID: #{cita.idTurno.slice(-4).toUpperCase()}
                    </span>
                  </div>

                  {/* Información */}
                  <div className="flex flex-col gap-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Médico */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium uppercase">
                          {nombresEspecialidad[cita.medico.especialidad] ??
                            cita.medico.especialidad}
                        </span>

                        <span className="border border-slate-300 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          Programado
                        </span>
                      </div>

                      <h2 className="mt-2 text-base font-bold">
                        Dr. {cita.medico.nombre} {cita.medico.apellido}
                      </h2>
                    </div>

                    {/* Fecha y lugar */}
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="mr-2 text-base">◷</span>
                        {formatearFecha(cita.fecha)}, {cita.hora} hs
                      </p>

                      <p>
                        <span className="mr-2 text-base">⌖</span>
                        {cita.medico.consultorio ?? 'Consultorio no especificado'}
                      </p>
                    </div>

                    {/* Cancelación */}
                    <div className="shrink-0">
                      {cancelable ? (
                        <button
                          type="button"
                          onClick={() => abrirConfirmacion(cita.idTurno)}
                          disabled={cancelando}
                          className="border border-slate-300 bg-white px-4 py-2 text-xs font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          [ X Cancelar Turno ]
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Cancelación no disponible
                        </span>
                      )}
                    </div>
                  </div>
                </article>

                {/* Confirmación de cancelación */}
                {mostrandoConfirmacion && cancelable && (
                  <section className="border border-dashed border-slate-400 bg-slate-50 p-4">
                    <div className="border-b border-slate-300 pb-2">
                      <span className="text-[11px] uppercase tracking-wide text-slate-600">
                        Flujo: cancelación de turno
                      </span>
                    </div>

                    <h2 className="mt-4 text-base font-bold">
                      (?) Confirmar Cancelación de Turno
                    </h2>

                    <p className="mt-2 text-sm text-slate-700">
                      ¿Desea cancelar el turno del {formatearFecha(cita.fecha)}? Esta acción
                      liberará la vacante para otro paciente.
                    </p>

                    {estadoCancelacion === 'reintentando' && (
                      <div
                        className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                        role="status"
                        aria-live="polite"
                      >
                        Error de conexión, reintentando...
                      </div>
                    )}

                    {estadoCancelacion === 'verificando' && (
                      <div
                        className="mt-3 border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"
                        role="status"
                        aria-live="polite"
                      >
                        Verificando estado de la cancelación...
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={cerrarConfirmacion}
                        disabled={cancelando}
                        className="border border-slate-300 bg-white px-4 py-2 text-xs font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        [ No, conservar ]
                      </button>

                      <button
                        type="button"
                        onClick={cancelarCita}
                        disabled={cancelando}
                        className="bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {estadoCancelacion === 'cancelando'
                          ? '[ Cancelando... ]'
                          : estadoCancelacion === 'reintentando'
                            ? '[ Error de conexión, reintentando... ]'
                            : estadoCancelacion === 'verificando'
                              ? '[ Verificando... ]'
                              : '[ Sí, cancelar turno ]'}
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}