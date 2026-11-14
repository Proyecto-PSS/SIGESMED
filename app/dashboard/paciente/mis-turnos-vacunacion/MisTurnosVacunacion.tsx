'use client'

import { useState } from 'react'
import styles from './mis-turnos-vacunacion.module.css'

type TurnoVacunacion = {
  id: string
  fecha: string
  hora: string
  vacuna: string
  enfermero: string
}

type CancelacionVacunacion = {
  id: string
  fecha: string
  hora: string
  vacuna: string
  motivo: string
  canceladoAt: string
}

const MOTIVOS = [
  'Cambio de disponibilidad',
  'Ya no necesito la vacuna',
  'Problema de salud',
  'Otro motivo',
]

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function formatearFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export default function MisTurnosVacunacion({
  turnos: iniciales,
  cancelaciones: cancelacionesIniciales,
}: {
  turnos: TurnoVacunacion[]
  cancelaciones: CancelacionVacunacion[]
}) {
  const [turnos, setTurnos] = useState(iniciales)
  const [cancelaciones, setCancelaciones] = useState(cancelacionesIniciales)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function confirmarCancelacion() {
    if (!seleccionado || !motivo || procesando) return
    setProcesando(true)
    setError('')
    setMensaje('')

    try {
      const response = await fetch(`/api/pacientes/vacunacion/turnos/${encodeURIComponent(seleccionado)}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo cancelar el turno.')

      setTurnos((actuales) => actuales.filter((turno) => turno.id !== seleccionado))
      setCancelaciones((actuales) => [{
        id: data.cancelacion.idCancelacion,
        fecha: data.cancelacion.fecha,
        hora: data.cancelacion.hora,
        vacuna: data.cancelacion.nombreVacuna,
        motivo: data.cancelacion.motivo,
        canceladoAt: data.cancelacion.canceladoAt,
      }, ...actuales])
      setMensaje(data.horarioLiberado
        ? 'El turno se canceló y quedó en tu historial. El horario futuro se liberó y la dosis volvió al stock.'
        : 'El turno se canceló y quedó en tu historial. Como el horario ya pasó, no se volvió a ofrecer; la dosis volvió al stock.')
      setSeleccionado(null)
      setMotivo('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al cancelar el turno.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className={styles.contenido}>
      {mensaje && <p className={styles.mensaje} role="status">{mensaje}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section aria-label="Turnos de vacunación confirmados">
        {turnos.length === 0
          ? <p className={styles.vacio}>Cuando tengas un turno confirmado, lo vas a encontrar acá.</p>
          : <ul className={styles.lista}>{turnos.map((turno) => (
          <li className={styles.tarjeta} key={turno.id}>
            <div className={styles.info}>
              <h2>{turno.vacuna}</h2>
              <p>{formatearFecha(turno.fecha)} · {turno.hora}</p>
              <p>Atiende: {turno.enfermero}</p>
            </div>
            {seleccionado === turno.id ? (
              <div className={styles.confirmacion}>
                <label htmlFor={`motivo-${turno.id}`}>¿Por qué necesitás cancelar?</label>
                <select id={`motivo-${turno.id}`} value={motivo} onChange={(event) => setMotivo(event.target.value)}>
                  <option value="">Seleccioná un motivo</option>
                  {MOTIVOS.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                </select>
                <p>Al confirmar, el horario se libera y la dosis vuelve al stock.</p>
                <div className={styles.acciones}>
                  <button type="button" className={styles.secundario} disabled={procesando} onClick={() => { setSeleccionado(null); setMotivo(''); setError('') }}>
                    Volver / Conservar turno
                  </button>
                  <button type="button" className={styles.cancelar} disabled={procesando || !motivo} onClick={confirmarCancelacion}>
                    {procesando ? 'Cancelando…' : 'Confirmar cancelación'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.cancelar} onClick={() => { setSeleccionado(turno.id); setError(''); setMensaje('') }}>
                Cancelar turno
              </button>
            )}
          </li>
          ))}</ul>}
      </section>
      {cancelaciones.length > 0 && (
        <section className={styles.historial} aria-label="Historial de turnos de vacunación cancelados">
          <h2>Turnos cancelados</h2>
          <ul className={styles.lista}>
            {cancelaciones.map((cancelacion) => (
              <li className={styles.tarjeta} key={cancelacion.id}>
                <div className={styles.info}>
                  <h3>{cancelacion.vacuna} <span className={styles.estadoCancelado}>Cancelado</span></h3>
                  <p>Turno: {formatearFecha(cancelacion.fecha)} · {cancelacion.hora}</p>
                  <p>Cancelado el: {formatearFechaHora(cancelacion.canceladoAt)}</p>
                  <p>Motivo: {cancelacion.motivo}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
