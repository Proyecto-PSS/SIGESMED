// Formatos de fecha legibles para las pantallas del paciente.
// Las fechas de turno se guardan como DATE (medianoche UTC), así que se formatean en UTC
// para que no se corra el día por la zona horaria.

function aFecha(fecha: string | Date) {
  return typeof fecha === 'string' ? new Date(`${fecha.slice(0, 10)}T00:00:00Z`) : fecha
}

/** "jueves 12 de noviembre" */
export function fechaLarga(fecha: string | Date) {
  return aFecha(fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).replace(',', '')
}

/** "12/11/2026" */
export function fechaNumerica(fecha: string | Date) {
  return aFecha(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Primera letra en mayúscula. */
export function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
