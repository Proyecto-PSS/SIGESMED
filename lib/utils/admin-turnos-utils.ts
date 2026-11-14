// Utilidades para filtrado y formateo de fechas en gestión administrativa de turnos (US-21 y US-22).

/**
 * Valida y parsea una fecha en formato estricto YYYY-MM-DD sin desplazamiento de zona horaria.
 */
export function parseFechaFiltro(fechaStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return null
  const [year, month, day] = fechaStr.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Formatea una fecha de base de datos a texto legible en Argentina sin desplazamiento horario.
 */
export function formatearFechaArgentina(fecha: Date | string): string {
  const iso = typeof fecha === 'string' ? fecha.slice(0, 10) : fecha.toISOString().slice(0, 10)
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Motivos que el administrador puede elegir al cancelar un turno (US-21).
 * Es la única fuente de verdad: la usan el modal, la API y el servicio.
 */
export const MOTIVOS_CANCELACION_ADMINISTRATIVA = [
  'Cambio en la agenda del médico',
  'Ausencia imprevista del profesional',
  'Solicitud del paciente',
  'Turno duplicado o cargado por error',
] as const

export type MotivoCancelacionAdministrativa = (typeof MOTIVOS_CANCELACION_ADMINISTRATIVA)[number]

/** Indica si el valor recibido es uno de los motivos de cancelación permitidos. */
export function esMotivoCancelacionValido(motivo: unknown): motivo is MotivoCancelacionAdministrativa {
  return (
    typeof motivo === 'string' &&
    (MOTIVOS_CANCELACION_ADMINISTRATIVA as readonly string[]).includes(motivo)
  )
}

/** Normaliza el identificador de médico recibido como filtro: vacío o solo espacios equivale a "sin filtro". */
export function normalizarFiltroMedico(idMedico: string | null | undefined): string | undefined {
  const valor = idMedico?.trim()
  return valor ? valor : undefined
}
