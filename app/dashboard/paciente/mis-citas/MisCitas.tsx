'use client'

import { useState } from 'react'

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

export default function MisCitas({ citas }: Props) {
  const [citasActuales, setCitasActuales] = useState(citas)
  const [error, setError] = useState('')
  const [citaSeleccionada, setCitaSeleccionada] =
    useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)

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

  async function cancelarCita() {
    if (!citaSeleccionada || cancelando) {
      return
    }

    try {
      setCancelando(true)
      setError('')

      const response = await fetch(
        `/api/pacientes/citas/${citaSeleccionada}/cancelar`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ?? 'No se pudo cancelar el turno'
        )
      }

      setCitasActuales((citasActuales) =>
        citasActuales.filter(
          (cita) => cita.idTurno !== citaSeleccionada
        )
      )

      setCitaSeleccionada(null)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo cancelar el turno'
      )
    } finally {
      setCancelando(false)
    }
  }

  return (
    <>
      {/* Error */}
      {error && (
        <section className="mt-6 border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-800">
            {error}
          </p>
        </section>
      )}

      {/* Sin turnos */}
      {!error && citasActuales.length === 0 && (
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
      {!error && citasActuales.length > 0 && (
        <section className="mt-6 space-y-4">

          {citasActuales.map((cita) => {
            const cancelable = puedeCancelar(cita)
            const mostrandoConfirmacion =
              citaSeleccionada === cita.idTurno

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
                        <span className="mr-2 text-base">
                          ◷
                        </span>

                        {formatearFecha(cita.fecha)}, {cita.hora} hs
                      </p>

                      <p>
                        <span className="mr-2 text-base">
                          ⌖
                        </span>

                        {cita.medico.consultorio ??
                          'Consultorio no especificado'}
                      </p>
                    </div>

                    {/* Cancelación */}
                    <div className="shrink-0">
                      {cancelable ? (
                        <button
                          type="button"
                          onClick={() =>
                            abrirConfirmacion(cita.idTurno)
                          }
                          className="border border-slate-300 bg-white px-4 py-2 text-xs font-medium hover:bg-slate-50"
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
                      ¿Desea cancelar el turno del{' '}
                      {formatearFecha(cita.fecha)}? Esta acción
                      liberará la vacante para otro paciente.
                    </p>

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
                        {cancelando
                          ? '[ Cancelando... ]'
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