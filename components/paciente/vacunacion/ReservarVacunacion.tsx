'use client'

import { useState, useMemo } from 'react'
import ui from '@/components/paciente/ui/ui.module.css'
import s from './vacunacion.module.css'

/* ---- Tipos ---- */
interface Slot {
  idTurnoVacunacion: string
  hora: string
}

interface Dia {
  fecha: string // YYYY-MM-DD
  slots: Slot[]
}

interface VacunaDisponible {
  idVacuna: string
  nombre: string
  stock: number
  dias: Dia[]
}

type Paso = 'seleccion' | 'confirmacion' | 'exito'

interface Props {
  vacunas: VacunaDisponible[]
}

/* ---- Helpers ---- */
function formatoFecha(fechaStr: string) {
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function capitalizar(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function generarIdempotencyKey() {
  return `pac-vac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* ---- Componente ---- */
export default function ReservarVacunacion({ vacunas }: Props) {
  const [paso, setPaso] = useState<Paso>('seleccion')

  // Selecciones del Paso 1
  const [idVacunaSeleccionada, setIdVacunaSeleccionada] = useState<string | null>(null)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null)
  const [idTurnoSeleccionado, setIdTurnoSeleccionado] = useState<string | null>(null)

  // Estado del Paso 2
  const [reservando, setReservando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnoConfirmado, setTurnoConfirmado] = useState<{
    fecha: string
    hora: string
    vacuna: string
  } | null>(null)

  const vacunaActual = useMemo(
    () => vacunas.find((v) => v.idVacuna === idVacunaSeleccionada) ?? null,
    [vacunas, idVacunaSeleccionada]
  )

  const diasDisponibles = vacunaActual?.dias ?? []

  const diaActual = useMemo(
    () => diasDisponibles.find((d) => d.fecha === fechaSeleccionada) ?? null,
    [diasDisponibles, fechaSeleccionada]
  )

  const slotActual = useMemo(
    () => diaActual?.slots.find((sl) => sl.idTurnoVacunacion === idTurnoSeleccionado) ?? null,
    [diaActual, idTurnoSeleccionado]
  )

  function seleccionarVacuna(id: string) {
    setIdVacunaSeleccionada(id)
    setFechaSeleccionada(null)
    setIdTurnoSeleccionado(null)
    setError(null)
  }

  function seleccionarFecha(fecha: string) {
    setFechaSeleccionada(fecha)
    setIdTurnoSeleccionado(null)
    setError(null)
  }

  function irAConfirmacion() {
    if (!idTurnoSeleccionado) return
    setError(null)
    setPaso('confirmacion')
  }

  function volverASeleccion() {
    setError(null)
    setPaso('seleccion')
  }

  async function confirmarReserva() {
    if (!idTurnoSeleccionado || !vacunaActual || !diaActual || !slotActual) return
    setReservando(true)
    setError(null)

    const idempotencyKey = generarIdempotencyKey()

    try {
      const res = await fetch(
        `/api/pacientes/vacunacion/turnos/${idTurnoSeleccionado}/reservar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          // Turno tomado mientras elegía — volver a selección con mensaje
          setError(
            data.error ||
              'El horario fue reservado por otro paciente. Por favor elegí otro.'
          )
          setPaso('seleccion')
          // Invalidar selección de slot
          setIdTurnoSeleccionado(null)
        } else {
          setError(data.error || 'Ocurrió un error al confirmar la reserva.')
        }
        return
      }

      setTurnoConfirmado({
        fecha: diaActual.fecha,
        hora: slotActual.hora,
        vacuna: vacunaActual.nombre,
      })
      setPaso('exito')
    } catch {
      setError('Error de conexión. Revisá tu internet e intentá de nuevo.')
    } finally {
      setReservando(false)
    }
  }

  /* ---- Paso: Éxito ---- */
  if (paso === 'exito' && turnoConfirmado) {
    return (
      <div className={s.exitoContenedor}>
        <div className={s.exitoIcono} aria-hidden="true">✓</div>
        <h2 className={s.exitoTitulo}>¡Turno confirmado!</h2>
        <p className={s.exitoTexto}>
          Tu turno de vacunación fue reservado exitosamente.
        </p>
        <dl className={`${ui.datos} ${s.exitoDatos}`}>
          <div>
            <dt>Vacuna</dt>
            <dd>{turnoConfirmado.vacuna}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{capitalizar(formatoFecha(turnoConfirmado.fecha))}</dd>
          </div>
          <div>
            <dt>Hora</dt>
            <dd>{turnoConfirmado.hora} hs</dd>
          </div>
        </dl>
        <p className={s.exitoAyuda}>
          Podés ver y cancelar tu turno en <strong>Mis turnos de vacunación</strong>.
        </p>
        <div className={ui.acciones}>
          <a href="/dashboard/paciente/mis-turnos-vacunacion" className={`${ui.botonPrimario} ${ui.botonPrimario} ${ui.botonPrimario}`}>
            Ver mis turnos
          </a>
          <button
            type="button"
            className={`${ui.botonSecundario} ${ui.botonSecundario} ${ui.botonSecundario}`}
            onClick={() => {
              setPaso('seleccion')
              setIdVacunaSeleccionada(null)
              setFechaSeleccionada(null)
              setIdTurnoSeleccionado(null)
              setTurnoConfirmado(null)
              setError(null)
            }}
          >
            Reservar otro turno
          </button>
        </div>
      </div>
    )
  }

  /* ---- Paso: Confirmación ---- */
  if (paso === 'confirmacion') {
    return (
      <div className={s.confirmacionContenedor}>
        <h2 className={s.seccionTitulo}>Confirmá tu reserva</h2>
        <p className={s.seccionTexto}>
          Revisá los datos antes de confirmar. Una vez confirmado, el turno queda reservado a tu nombre.
        </p>

        <div className={s.resumenCard}>
          <dl className={ui.datos}>
            <div>
              <dt>Vacuna</dt>
              <dd>{vacunaActual?.nombre}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{diaActual ? capitalizar(formatoFecha(diaActual.fecha)) : '—'}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>{slotActual?.hora} hs</dd>
            </div>
          </dl>
        </div>

        {error && (
          <div className={`${ui.alerta} ${ui.alertaError}`} role="alert">
            {error}
          </div>
        )}

        <div className={`${ui.acciones} ${s.confirmacionAcciones}`}>
          <button
            type="button"
            className={`${ui.botonSecundario} ${ui.botonSecundario} ${ui.botonSecundario}`}
            onClick={volverASeleccion}
            disabled={reservando}
          >
            ← Volver
          </button>
          <button
            type="button"
            className={`${ui.botonPrimario} ${ui.botonPrimario} ${ui.botonPrimario}`}
            onClick={confirmarReserva}
            disabled={reservando}
          >
            {reservando ? (
              <span className={ui.conIcono}>
                <span className={ui.spinner} aria-hidden="true" />
                Confirmando…
              </span>
            ) : (
              'Confirmar reserva'
            )}
          </button>
        </div>
      </div>
    )
  }

  /* ---- Paso: Selección ---- */
  return (
    <div>
      {error && (
        <div className={`${ui.alerta} ${ui.alertaError} ${s.errorGlobal}`} role="alert">
          {error}
        </div>
      )}

      {/* Paso 1a: Elegir vacuna */}
      <section className={s.seccion}>
        <h2 className={s.seccionTitulo}>1. Elegí la vacuna</h2>
        {vacunas.length === 0 ? (
          <div className={ui.vacio}>
            No hay vacunas con turnos disponibles en este momento.
          </div>
        ) : (
          <ul className={`${ui.opciones} ${s.listaVacunas}`} role="listbox" aria-label="Vacunas disponibles">
            {vacunas.map((v) => {
              const activa = v.idVacuna === idVacunaSeleccionada
              return (
                <li key={v.idVacuna}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activa}
                    className={`${ui.opcion} ${activa ? ui.opcionActiva : ''} ${s.opcionVacuna}`}
                    onClick={() => seleccionarVacuna(v.idVacuna)}
                  >
                    <span className={ui.opcionMarca} aria-hidden="true" />
                    <span>
                      <span className={ui.opcionTitulo}>{v.nombre}</span>
                      <span className={ui.opcionTexto}>
                        {v.dias.length === 1 ? '1 día disponible' : `${v.dias.length} días disponibles`}
                        {' · '}
                        {v.dias.reduce((acc, d) => acc + d.slots.length, 0)} turnos
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Paso 1b: Elegir fecha */}
      {vacunaActual && (
        <section className={s.seccion}>
          <h2 className={s.seccionTitulo}>2. Elegí el día</h2>
          <ul className={`${ui.opciones} ${s.listaFechas}`} role="listbox" aria-label="Días disponibles">
            {diasDisponibles.map((dia) => {
              const activa = dia.fecha === fechaSeleccionada
              return (
                <li key={dia.fecha}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activa}
                    className={`${ui.opcion} ${activa ? ui.opcionActiva : ''}`}
                    onClick={() => seleccionarFecha(dia.fecha)}
                  >
                    <span className={ui.opcionMarca} aria-hidden="true" />
                    <span>
                      <span className={ui.opcionTitulo}>{capitalizar(formatoFecha(dia.fecha))}</span>
                      <span className={ui.opcionTexto}>
                        {dia.slots.length === 1 ? '1 horario disponible' : `${dia.slots.length} horarios disponibles`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Paso 1c: Elegir horario */}
      {diaActual && (
        <section className={s.seccion}>
          <h2 className={s.seccionTitulo}>3. Elegí el horario</h2>
          <ul className={s.listaHorarios} role="listbox" aria-label="Horarios disponibles">
            {diaActual.slots.map((slot) => {
              const activo = slot.idTurnoVacunacion === idTurnoSeleccionado
              return (
                <li key={slot.idTurnoVacunacion}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activo}
                    className={`${s.botonHorario} ${activo ? s.botonHorarioActivo : ''}`}
                    onClick={() => setIdTurnoSeleccionado(slot.idTurnoVacunacion)}
                  >
                    {slot.hora} hs
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* CTA */}
      {idTurnoSeleccionado && (
        <div className={s.ctaContenedor}>
          <button
            type="button"
            className={`${ui.botonPrimario} ${ui.botonPrimario} ${ui.botonPrimario} ${s.ctaBoton}`}
            onClick={irAConfirmacion}
          >
            Continuar →
          </button>
        </div>
      )}
    </div>
  )
}
