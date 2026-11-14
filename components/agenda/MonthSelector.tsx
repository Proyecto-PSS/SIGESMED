'use client'

import styles from './agenda.module.css'

interface MonthSelectorProps {
  currentMonth: string // YYYY-MM
  onChangeMonth: (newMonth: string) => void
  disabled?: boolean
  minMonth?: string // YYYY-MM
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export default function MonthSelector({
  currentMonth,
  onChangeMonth,
  disabled = false,
  minMonth,
}: MonthSelectorProps) {
  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const isPrevDisabled = disabled || (Boolean(minMonth) && currentMonth <= (minMonth as string))

  const handlePrev = () => {
    if (isPrevDisabled) return
    let nextMonth = month - 1
    let nextYear = year
    if (nextMonth < 1) {
      nextMonth = 12
      nextYear -= 1
    }
    const newMonthStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`
    if (minMonth && newMonthStr < minMonth) return
    onChangeMonth(newMonthStr)
  }

  const handleNext = () => {
    let nextMonth = month + 1
    let nextYear = year
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    onChangeMonth(`${nextYear}-${nextMonth.toString().padStart(2, '0')}`)
  }

  const nombreMes = MESES[month - 1] || 'Mes'

  return (
    <div className={styles.mes} role="group" aria-label="Mes de planificación">
      <button
        type="button"
        onClick={handlePrev}
        disabled={isPrevDisabled}
        title={isPrevDisabled ? 'No se puede planificar un mes anterior al actual' : 'Mes anterior'}
        aria-label="Mes anterior"
        className={styles.mesFlecha}
      >
        ‹
      </button>
      <span className={styles.mesNombre} aria-live="polite">
        {nombreMes} {year}
      </span>
      <button
        type="button"
        onClick={handleNext}
        disabled={disabled}
        title="Mes siguiente"
        aria-label="Mes siguiente"
        className={styles.mesFlecha}
      >
        ›
      </button>
    </div>
  )
}
