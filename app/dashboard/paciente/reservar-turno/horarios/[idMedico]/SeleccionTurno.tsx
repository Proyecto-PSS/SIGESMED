'use client'

// Permite seleccionar un día y un horario sin duplicar la lógica de consulta del servidor.
import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from './horarios.module.css'

type Turno = {
  id: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: string
}

type Props = {
  turnos: Turno[]
}

const nombresDias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const nombresMeses = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function fechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00`)
}

function fechaCorta(fecha: string) {
  const fechaFormateada = fechaLocal(fecha)
  return {
    dia: nombresDias[fechaFormateada.getDay()],
    numero: fechaFormateada.getDate(),
    mes: nombresMeses[fechaFormateada.getMonth()],
  }
}

export default function SeleccionTurno({ turnos }: Props) {
  const meses = useMemo(() => {
    const fechas = [...new Set(turnos.map((turno) => turno.fecha.slice(0, 7)))].sort()
    return fechas.map((mes) => ({
      mes,
      turnos: turnos.filter((turno) => turno.fecha.startsWith(mes)),
    }))
  }, [turnos])
  const [mesSeleccionado, setMesSeleccionado] = useState(meses[0]?.mes ?? '')
  const mesActual = meses.find((mes) => mes.mes === mesSeleccionado) ?? meses[0]
  const dias = useMemo(
    () =>
      [...new Set(mesActual?.turnos.map((turno) => turno.fecha) ?? [])].sort().map((fecha) => ({
        fecha,
        turnos: mesActual?.turnos.filter((turno) => turno.fecha === fecha) ?? [],
      })),
    [mesActual]
  )
  const [diaSeleccionado, setDiaSeleccionado] = useState(dias[0]?.fecha ?? '')
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string | null>(null)
  const diaActual = dias.find((dia) => dia.fecha === diaSeleccionado)
  const disponibles = diaActual?.turnos.filter((turno) => turno.estado === 'DISPONIBLE') ?? []
  const seleccionado = disponibles.find((turno) => turno.id === turnoSeleccionado)
  const duracion = seleccionado?.duracionMinutos ?? disponibles[0]?.duracionMinutos

  if (dias.length === 0) {
    return (
      <div className={styles.seleccion}>
        <p className={styles.vacio}>Este profesional no tiene días disponibles por el momento.</p>
      </div>
    )
  }

  return (
    <div className={styles.seleccion}>
      <section className={styles.bloque} aria-labelledby="titulo-dia">
        <div className={styles.bloqueEncabezado}>
          <h2 id="titulo-dia" className={styles.bloqueTitulo}>
            <span className={styles.bloqueNumero}>1</span>
            Elegí el día
          </h2>
          {meses.length > 1 && (
            <div className={styles.meses} role="group" aria-label="Mes">
              {meses.map((mes) => (
                <button
                  key={mes.mes}
                  type="button"
                  onClick={() => {
                    setMesSeleccionado(mes.mes)
                    setDiaSeleccionado(mes.turnos[0]?.fecha ?? '')
                    setTurnoSeleccionado(null)
                  }}
                  className={`${styles.mes} ${mes.mes === mesSeleccionado ? styles.mesActivo : ''}`}
                  aria-pressed={mes.mes === mesSeleccionado}
                >
                  {fechaCorta(`${mes.mes}-01`).mes}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.dias}>
          {dias.map((dia) => {
            const info = fechaCorta(dia.fecha)
            const libres = dia.turnos.filter((turno) => turno.estado === 'DISPONIBLE').length
            const activo = dia.fecha === diaSeleccionado

            return (
              <button
                key={dia.fecha}
                type="button"
                disabled={libres === 0}
                onClick={() => {
                  setDiaSeleccionado(dia.fecha)
                  setTurnoSeleccionado(null)
                }}
                className={`${styles.dia} ${activo && libres > 0 ? styles.diaActivo : ''}`}
                aria-pressed={activo}
                aria-label={`${info.dia} ${info.numero} de ${info.mes}: ${libres === 0 ? 'sin horarios' : `${libres} horarios libres`}`}
              >
                <span className={styles.diaNombre}>{info.dia.slice(0, 3)}</span>
                <span className={styles.diaNumero}>{info.numero}</span>
                <span className={styles.diaEstado}>{libres === 0 ? 'Agotado' : `${libres} libres`}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.bloque} aria-labelledby="titulo-hora">
        <div className={styles.bloqueEncabezado}>
          <h2 id="titulo-hora" className={styles.bloqueTitulo}>
            <span className={styles.bloqueNumero}>2</span>
            Elegí el horario
          </h2>
          {duracion ? <span className={styles.nota}>Duración de la consulta: {duracion} min</span> : null}
        </div>

        {disponibles.length === 0 ? (
          <p className={styles.vacio}>No hay horarios libres para este día. Probá con otro.</p>
        ) : (
          <div className={styles.horarios}>
            {disponibles.map((turno) => (
              <button
                key={turno.id}
                type="button"
                onClick={() => setTurnoSeleccionado(turno.id)}
                className={`${styles.hora} ${turno.id === turnoSeleccionado ? styles.horaActiva : ''}`}
                aria-pressed={turno.id === turnoSeleccionado}
              >
                {turno.hora}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.resumen} aria-live="polite">
        <div>
          <span className={styles.resumenLabel}>Tu turno</span>
          <span className={styles.resumenValor}>
            {seleccionado
              ? `${fechaCorta(seleccionado.fecha).dia} ${fechaCorta(seleccionado.fecha).numero} de ${fechaCorta(seleccionado.fecha).mes} · ${seleccionado.hora} hs`
              : 'Elegí un día y un horario'}
          </span>
        </div>
        {seleccionado ? (
          <Link
            href={`/dashboard/paciente/reservar-turno/modalidad?turno=${seleccionado.id}`}
            className={styles.continuar}
          >
            Continuar
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className={`${styles.continuar} ${styles.continuarDeshabilitado}`} aria-disabled="true">
            Continuar
            <span aria-hidden="true">→</span>
          </span>
        )}
      </section>
    </div>
  )
}
