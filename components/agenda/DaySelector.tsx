'use client'

import { DiaSemana } from '@/lib/types/agenda'
import { DIAS_ABREVIADOS, NOMBRES_DIAS } from '@/lib/utils/agenda-utils'
import styles from './agenda.module.css'

interface DaySelectorProps {
  selectedDays: DiaSemana[]
  onToggleDay: (dia: DiaSemana) => void
  disabled?: boolean
}

function IconoCandado() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

const DIAS_DISPONIBLES: DiaSemana[] = [1, 2, 3, 4, 5, 6]
const MAXIMO_DIAS = 2

// US-03: hasta 2 días fijos por semana. Al llegar al máximo, los demás quedan bloqueados.
export default function DaySelector({ selectedDays, onToggleDay, disabled = false }: DaySelectorProps) {
  const count = selectedDays.length
  const maxReached = count >= MAXIMO_DIAS
  const nombresActivos = selectedDays.map((d) => NOMBRES_DIAS[d]).join(' o ')

  return (
    <section className={styles.tarjeta} aria-labelledby="titulo-dias">
      <div className={styles.tarjetaEncabezado}>
        <div>
          <h2 id="titulo-dias" className={styles.tarjetaTitulo}>Días de atención</h2>
          <p className={styles.tarjetaDetalle}>Elegí hasta 2 días fijos por semana para este mes.</p>
        </div>
        <span className={`${styles.contadorDias} ${maxReached ? styles.contadorCompleto : ''}`}>
          {count} / {MAXIMO_DIAS} activos
        </span>
      </div>

      <div className={styles.dias}>
        {DIAS_DISPONIBLES.map((dia) => {
          const isSelected = selectedDays.includes(dia)
          const isLocked = maxReached && !isSelected
          const clase = isSelected ? styles.diaSeleccionado : isLocked ? styles.diaBloqueado : ''

          return (
            <button
              key={dia}
              type="button"
              disabled={disabled || isLocked}
              onClick={() => onToggleDay(dia)}
              aria-pressed={isSelected}
              className={`${styles.dia} ${clase}`}
            >
              <span className={styles.diaCabecera}>
                <span className={styles.diaAbreviado}>{DIAS_ABREVIADOS[dia]}</span>
                <span className={styles.diaMarca} aria-hidden="true">
                  {isSelected ? '✓' : isLocked ? <IconoCandado /> : ''}
                </span>
              </span>
              <span>
                <span className={styles.diaEstado}>
                  {NOMBRES_DIAS[dia]} · {isSelected ? 'Seleccionado' : isLocked ? 'Bloqueado' : 'Disponible'}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className={styles.nota}>
        {maxReached
          ? `Para cambiar un día, primero desmarcá ${nombresActivos}.`
          : `Podés elegir ${MAXIMO_DIAS - count} día${MAXIMO_DIAS - count > 1 ? 's' : ''} más.`}
      </p>
    </section>
  )
}
