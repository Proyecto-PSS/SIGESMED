// Funciones utilitarias para cálculo de anticipación, momentos de turno y backoff de recordatorios (US-15).
import { RECORDATORIOS_CONFIG } from '../config/recordatorios-config.ts'

/**
 * Convierte la fecha y hora de un turno (en horario local de Argentina UTC-3) a un objeto Date absoluto (UTC).
 */
export function obtenerInstanteTurno(fecha: Date | string, hora: string): Date {
  const fechaStr = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : fecha.slice(0, 10)
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)

  // En Argentina (UTC-3), la hora local H se corresponde con H + 3 en UTC
  const offsetMs = Math.abs(RECORDATORIOS_CONFIG.TIMEZONE_OFFSET_HOURS) * 60 * 60 * 1000
  return new Date(Date.UTC(anio, mes - 1, dia, horas, minutos) + offsetMs)
}

/**
 * Calcula la fecha y hora programada para el envío del recordatorio según la política de anticipación.
 * Si faltan menos horas que la anticipación pero aún hay margen razonable (> 30 min), programa para ahora.
 * Si el turno ya pasó o está a menos de 30 minutos, retorna null para no enviar recordatorios intempestivos.
 */
export function calcularMomentoProgramado(
  fechaTurno: Date | string,
  horaTurno: string,
  horasAnticipacion: number = RECORDATORIOS_CONFIG.HORAS_ANTICIPACION_DEFECTO,
  ahora: Date = new Date()
): Date | null {
  const instanteTurno = obtenerInstanteTurno(fechaTurno, horaTurno)
  const diferenciaMs = instanteTurno.getTime() - ahora.getTime()
  const ventanaMinimaMs = RECORDATORIOS_CONFIG.VENTANA_MINIMA_ENVIO_MINUTOS * 60 * 1000

  // Si el turno ya ocurrió o está por comenzar en menos del umbral mínimo, no programar
  if (diferenciaMs <= ventanaMinimaMs) {
    return null
  }

  const anticipacionMs = horasAnticipacion * 60 * 60 * 1000
  const momentoIdeal = new Date(instanteTurno.getTime() - anticipacionMs)

  // Si el momento ideal ya quedó en el pasado pero el turno todavía tiene margen, programar para ahora mismo
  if (momentoIdeal.getTime() <= ahora.getTime()) {
    return ahora
  }

  return momentoIdeal
}

/**
 * Calcula la fecha y hora del próximo reintento aplicando backoff exponencial según el número de intentos.
 */
export function calcularFechaProximoReintento(intento: number, baseDate: Date = new Date()): Date {
  const idx = Math.min(Math.max(0, intento - 1), RECORDATORIOS_CONFIG.INTERVALOS_BACKOFF_MINUTOS.length - 1)
  const minutosEspera = RECORDATORIOS_CONFIG.INTERVALOS_BACKOFF_MINUTOS[idx] ?? RECORDATORIOS_CONFIG.INTERVALO_MAX_BACKOFF_MINUTOS
  return new Date(baseDate.getTime() + minutosEspera * 60 * 1000)
}

/**
 * Formatea una fecha ISO o Date al formato legible DD/MM/AAAA.
 */
export function formatearFechaLegible(fecha: Date | string): string {
  const str = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : fecha.slice(0, 10)
  const [anio, mes, dia] = str.split('-')
  return `${dia}/${mes}/${anio}`
}
