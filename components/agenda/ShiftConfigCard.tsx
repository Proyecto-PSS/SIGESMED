'use client'

import { useMemo } from 'react'
import { DiaSemana, DuracionTurno } from '@/lib/types/agenda'
import { NOMBRES_DIAS, calcularTurnosPosibles } from '@/lib/utils/agenda-utils'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './agenda.module.css'

interface ShiftConfigCardProps {
  dia: DiaSemana
  franjaNumero: number
  horaDesde: string
  horaHasta: string
  duracion: DuracionTurno
  onChange: (fields: {
    horaDesde?: string
    horaHasta?: string
    duracion?: DuracionTurno
  }) => void
  onRemove: () => void
  disabled?: boolean
}

const DURACIONES: DuracionTurno[] = [20, 30, 45]

// US-03: franja horaria de un día de atención, con la cantidad de turnos que genera.
export default function ShiftConfigCard({
  dia,
  franjaNumero,
  horaDesde,
  horaHasta,
  duracion,
  onChange,
  onRemove,
  disabled = false,
}: ShiftConfigCardProps) {
  const { total: totalTurnos } = useMemo(
    () => calcularTurnosPosibles(horaDesde, horaHasta, duracion),
    [horaDesde, horaHasta, duracion]
  )
  const isValidHorario = totalTurnos > 0
  const idBase = `franja-${dia}`

  return (
    <article className={styles.franja} aria-labelledby={`${idBase}-titulo`}>
      <div className={styles.franjaCabecera}>
        <h3 id={`${idBase}-titulo`} className={styles.franjaTitulo}>
          {NOMBRES_DIAS[dia]}
          <span className={styles.etiqueta}>Franja {franjaNumero}</span>
          <span className={`${styles.etiqueta} ${styles.etiquetaAviso}`}>Mín. 48 hs de anticipación</span>
        </h3>
        <button type="button" onClick={onRemove} disabled={disabled} className={styles.quitar}>
          Quitar día
        </button>
      </div>

      <div className={styles.franjaCampos}>
        <label className={ui.campo}>
          Hora desde
          <input
            type="time"
            value={horaDesde}
            onChange={(e) => onChange({ horaDesde: e.target.value })}
            disabled={disabled}
            className={ui.control}
          />
        </label>

        <label className={ui.campo}>
          Hora hasta
          <input
            type="time"
            value={horaHasta}
            onChange={(e) => onChange({ horaHasta: e.target.value })}
            disabled={disabled}
            className={ui.control}
          />
        </label>

        <div className={ui.campo}>
          <span id={`${idBase}-duracion`}>Duración del turno</span>
          <div className={styles.duraciones} role="group" aria-labelledby={`${idBase}-duracion`}>
            {DURACIONES.map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                aria-pressed={duracion === d}
                onClick={() => onChange({ duracion: d })}
                className={`${styles.duracion} ${duracion === d ? styles.duracionActiva : ''}`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className={ui.campo}>
          <span>Capacidad por día</span>
          <span className={`${styles.capacidad} ${isValidHorario ? '' : styles.capacidadInvalida}`}>
            {isValidHorario ? `${totalTurnos} turnos` : 'Horario inválido'}
          </span>
        </div>
      </div>

      {!isValidHorario && (
        <p className={styles.errorCampo}>
          La hora de fin tiene que ser posterior a la de inicio y dejar lugar para al menos un turno.
        </p>
      )}
    </article>
  )
}
