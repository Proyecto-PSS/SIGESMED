import { DiaSemana, DuracionTurno } from '../types/agenda'

export const NOMBRES_DIAS: Record<DiaSemana, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

export const DIAS_ABREVIADOS: Record<DiaSemana, string> = {
  1: 'LUN',
  2: 'MAR',
  3: 'MIÉ',
  4: 'JUE',
  5: 'VIE',
  6: 'SÁB',
}

/**
 * Convierte un string de hora "HH:mm" a minutos desde las 00:00.
 */
export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 2) return NaN
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (isNaN(hours) || isNaN(minutes)) return NaN
  return hours * 60 + minutes
}

/**
 * Convierte minutos desde las 00:00 a string "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Calcula la cantidad de turnos generables en una franja horaria.
 */
export function calcularTurnosPosibles(
  hora_desde: string,
  hora_hasta: string,
  duracion_minutos: DuracionTurno
): { total: number; slots: string[] } {
  const start = timeToMinutes(hora_desde)
  const end = timeToMinutes(hora_hasta)

  if (isNaN(start) || isNaN(end) || start >= end) {
    return { total: 0, slots: [] }
  }

  if (![20, 30, 45].includes(duracion_minutos)) {
    return { total: 0, slots: [] }
  }

  const slots: string[] = []
  let current = start
  while (current + duracion_minutos <= end) {
    slots.push(minutesToTime(current))
    current += duracion_minutos
  }

  return { total: slots.length, slots }
}

/**
 * Mapeo de getDay() de JavaScript (0: Dom, 1: Lun, 2: Mar, ..., 6: Sab) a DiaSemana (1..6)
 */
export function jsDayToDiaSemana(jsDay: number): DiaSemana | null {
  if (jsDay >= 1 && jsDay <= 6) {
    return jsDay as DiaSemana
  }
  return null
}

/**
 * Obtiene todas las fechas del mes (YYYY-MM-DD) que corresponden a un DiaSemana.
 */
export function obtenerFechasDelMesParaDia(
  mes_vigencia: string,
  dia_semana: DiaSemana
): string[] {
  const [yearStr, monthStr] = mes_vigencia.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1

  const fechas: string[] = []
  const date = new Date(year, month, 1)

  while (date.getMonth() === month) {
    const jsDay = date.getDay()
    if (jsDayToDiaSemana(jsDay) === dia_semana) {
      const y = date.getFullYear()
      const m = (date.getMonth() + 1).toString().padStart(2, '0')
      const d = date.getDate().toString().padStart(2, '0')
      fechas.push(`${y}-${m}-${d}`)
    }
    date.setDate(date.getDate() + 1)
  }

  return fechas
}

/**
 * Valida el formato de mes YYYY-MM
 */
export function validarFormatoMes(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
}
