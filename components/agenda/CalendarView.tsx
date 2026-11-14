'use client'

import React, { useState, useMemo } from 'react'
import { Turno } from '@/lib/types/agenda'
import styles from './agenda.module.css'

const DIAS_CABECERA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADOS_TURNO: Record<Turno['estado'], { texto: string; clase: string }> = {
  DISPONIBLE: { texto: 'Libre', clase: styles.turnoLibre },
  CONFIRMADO: { texto: 'Reservado', clase: styles.turnoReservado },
  ATENDIDO: { texto: 'Atendido', clase: styles.turnoAtendido },
  AUSENTE: { texto: 'Ausente', clase: styles.turnoAusente },
  CANCELADO: { texto: 'Cancelado', clase: styles.turnoCancelado },
}

function horaDe(fechaHora: string): string {
  return fechaHora.split('T')[1].slice(0, 5)
}

function fechaLarga(fecha: string): string {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface CalendarViewProps {
  currentMonth: string // YYYY-MM
  turnos: Turno[]
  isLoading: boolean
  onMarkAbsent?: (idTurno: string) => void
}

export default function CalendarView({
  currentMonth,
  turnos,
  isLoading,
  onMarkAbsent,
}: CalendarViewProps) {
  const [vista, setVista] = useState<'mensual' | 'semanal'>('mensual')
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const [semanaOffset, setSemanaOffset] = useState<number>(0)

  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1

  // Resetear selección de día y offset semanal cuando cambia el mes
  React.useEffect(() => {
    setDiaSeleccionado(null)
    setSemanaOffset(0)
  }, [currentMonth])

  // Filtrar turnos estrictamente pertenecientes al mes seleccionado
  const turnosMesActual = useMemo(() => {
    const delMes = turnos.filter((t) => t.fecha_hora.startsWith(currentMonth))
    const horariosConTurnoActivo = new Set(
      delMes
        .filter((turno) => turno.estado === 'DISPONIBLE' || turno.estado === 'CONFIRMADO')
        .map((turno) => `${turno.fecha_hora}|${turno.duracion_minutos}`)
    )

    // Una cancelación histórica y el nuevo cupo disponible comparten horario.
    // En la agenda mostramos el cupo vigente una sola vez.
    return delMes.filter(
      (turno) =>
        (turno.estado === 'DISPONIBLE' || turno.estado === 'CONFIRMADO') ||
        !horariosConTurnoActivo.has(`${turno.fecha_hora}|${turno.duracion_minutos}`)
    )
  }, [turnos, currentMonth])

  // Agrupar turnos por fecha YYYY-MM-DD
  const turnosPorFecha = useMemo(() => {
    const mapa: Record<string, Turno[]> = {}
    for (const t of turnosMesActual) {
      const fecha = t.fecha_hora.split('T')[0]
      if (!mapa[fecha]) {
        mapa[fecha] = []
      }
      mapa[fecha].push(t)
    }
    return mapa
  }, [turnosMesActual])

  // Días de la cuadrícula mensual
  const diasMes = useMemo(() => {
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const totalDias = ultimoDia.getDate()

    let startDayOfWeek = primerDia.getDay()
    let offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

    const celdas: { fechaStr: string | null; diaNum: number | null }[] = []

    for (let i = 0; i < offset; i++) {
      celdas.push({ fechaStr: null, diaNum: null })
    }

    for (let d = 1; d <= totalDias; d++) {
      const fechaStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d
        .toString()
        .padStart(2, '0')}`
      celdas.push({ fechaStr, diaNum: d })
    }

    return celdas
  }, [year, month])

  // Semanas del mes para vista semanal
  const semanasDelMes = useMemo(() => {
    const semanas: string[][] = []
    let currentWeek: string[] = []

    const ultimoDia = new Date(year, month + 1, 0)

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const fechaStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d
        .toString()
        .padStart(2, '0')}`
      currentWeek.push(fechaStr)
      const dateObj = new Date(year, month, d)
      if (dateObj.getDay() === 0 || d === ultimoDia.getDate()) {
        semanas.push(currentWeek)
        currentWeek = []
      }
    }

    return semanas
  }, [year, month])


  const turnosDiaActivo = diaSeleccionado ? turnosPorFecha[diaSeleccionado] || [] : []

  return (
    <section className={styles.tarjeta} aria-labelledby="titulo-calendario">
      <div className={styles.calendarioControles}>
        <div>
          <h2 id="titulo-calendario" className={styles.tarjetaTitulo}>Calendario de turnos</h2>
          <p className={styles.tarjetaDetalle}>{turnosMesActual.length} turnos en agenda este mes</p>
        </div>

        <div className={styles.calendarioControles}>
          {vista === 'semanal' && semanasDelMes.length > 0 && (
            <div className={styles.semana}>
              <button
                type="button"
                disabled={semanaOffset <= 0}
                onClick={() => setSemanaOffset((prev) => Math.max(0, prev - 1))}
                className={styles.mesFlecha}
                aria-label="Semana anterior"
              >
                ‹
              </button>
              <span className={styles.nota}>
                Semana {semanaOffset + 1} de {semanasDelMes.length}
              </span>
              <button
                type="button"
                disabled={semanaOffset >= semanasDelMes.length - 1}
                onClick={() => setSemanaOffset((prev) => Math.min(semanasDelMes.length - 1, prev + 1))}
                className={styles.mesFlecha}
                aria-label="Semana siguiente"
              >
                ›
              </button>
            </div>
          )}

          <div className={styles.pestanas} role="group" aria-label="Tipo de vista">
            {(['mensual', 'semanal'] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={vista === opcion}
                onClick={() => setVista(opcion)}
                className={`${styles.pestana} ${vista === opcion ? styles.pestanaActiva : ''}`}
              >
                {opcion === 'mensual' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className={styles.vacio}>Cargando agenda…</p>
      ) : turnosMesActual.length === 0 ? (
        <div className={styles.vacio}>
          <strong>No hay turnos publicados para este mes.</strong>
          <br />
          Configurá tus horarios en la pestaña "Configurar horarios" y publicá la agenda para habilitar los cupos.
        </div>
      ) : vista === 'mensual' ? (
        <div className={styles.calendario}>
          <div>
            <div className={styles.grillaDias}>
              {DIAS_CABECERA.map((d) => (
                <span key={d} className={styles.cabeceraDia}>{d}</span>
              ))}
              {diasMes.map((celda, idx) => {
                if (!celda.fechaStr) return <span key={`vacia-${idx}`} className={styles.celdaVacia} />

                const turnosDelDia = turnosPorFecha[celda.fechaStr] || []
                const tieneTurnos = turnosDelDia.length > 0
                const isSelected = diaSeleccionado === celda.fechaStr
                const clase = isSelected ? styles.celdaSeleccionada : tieneTurnos ? styles.celdaConTurnos : ''

                return (
                  <button
                    key={celda.fechaStr}
                    type="button"
                    onClick={() => setDiaSeleccionado(celda.fechaStr)}
                    aria-pressed={isSelected}
                    aria-label={`${fechaLarga(celda.fechaStr)}: ${turnosDelDia.length} turnos`}
                    className={`${styles.celda} ${clase}`}
                  >
                    <span className={styles.celdaNumero}>{celda.diaNum}</span>
                    {tieneTurnos && <span className={styles.celdaCupos}>{turnosDelDia.length} turnos</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <aside className={styles.tarjeta} aria-live="polite">
            <div className={styles.tarjetaEncabezado}>
              <div>
                <span className={styles.eyebrow}>Detalle del día</span>
                <h3 className={styles.tarjetaTitulo}>
                  {diaSeleccionado ? fechaLarga(diaSeleccionado) : 'Elegí un día'}
                </h3>
              </div>
              {diaSeleccionado && <span className={styles.etiqueta}>{turnosDiaActivo.length} turnos</span>}
            </div>

            {!diaSeleccionado ? (
              <p className={styles.nota}>Tocá un día del calendario para ver sus horarios.</p>
            ) : turnosDiaActivo.length === 0 ? (
              <p className={styles.nota}>No hay turnos para esta fecha.</p>
            ) : (
              <ul className={styles.listaTurnos}>
                {turnosDiaActivo.map((t) => {
                  const estado = ESTADOS_TURNO[t.estado]
                  const puedeMarcarAusente =
                    t.estado === 'CONFIRMADO' && onMarkAbsent && new Date(t.fecha_hora) < new Date()
                  return (
                    <li key={t.id} className={styles.turno}>
                      <span>
                        <span className={styles.turnoHora}>{horaDe(t.fecha_hora)} hs</span>
                        <span className={styles.turnoDuracion}>{t.duracion_minutos} min</span>
                      </span>
                      <span className={styles.turnoAcciones}>
                        <span className={`${styles.estadoTurno} ${estado.clase}`}>{estado.texto}</span>
                        {puedeMarcarAusente && (
                          <button type="button" onClick={() => onMarkAbsent?.(t.id)} className={styles.botonAusente}>
                            Marcar ausente
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      ) : (
        <div className={styles.semanalContenedor}>
          <div className={styles.semanal}>
            {(semanasDelMes[semanaOffset] || []).map((fechaStr) => {
              const turnosDelDia = turnosPorFecha[fechaStr] || []
              const dateObj = new Date(`${fechaStr}T00:00:00`)
              return (
                <div key={fechaStr} className={styles.columnaDia}>
                  <div className={styles.columnaDiaCabecera}>
                    <span className={styles.columnaDiaNombre}>
                      {dateObj.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}
                    </span>
                    <span className={styles.columnaDiaNumero}>{dateObj.getDate()}</span>
                    <span className={styles.nota}>{turnosDelDia.length} cupos</span>
                  </div>
                  {turnosDelDia.length === 0 ? (
                    <span className={styles.nota} style={{ textAlign: 'center', marginTop: 16 }}>Sin atención</span>
                  ) : (
                    turnosDelDia.map((t) => (
                      <span key={t.id} className={styles.chipTurno} title={ESTADOS_TURNO[t.estado].texto}>
                        {horaDe(t.fecha_hora)}
                        <span
                          className={`${styles.puntoEstado} ${t.estado === 'DISPONIBLE' ? styles.puntoLibre : styles.puntoReservado}`}
                          aria-label={ESTADOS_TURNO[t.estado].texto}
                        />
                      </span>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
