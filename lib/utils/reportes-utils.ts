// Lógica pura de los reportes administrativos (RF-15): rangos de fechas y cálculo de métricas.
// No accede a la base de datos, así se puede testear de forma aislada.
import { parseFechaFiltro } from './admin-turnos-utils.ts'

export const DIAS_RANGO_PREDETERMINADO = 30

/** Argentina no tiene horario de verano: siempre UTC-3. */
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000

export const ESTADOS_TURNO_REPORTE = ['CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO'] as const
export type EstadoTurnoReporte = (typeof ESTADOS_TURNO_REPORTE)[number]

export interface RangoReporte {
  desde: string
  hasta: string
}

export type ResultadoRango =
  | { ok: true; rango: RangoReporte }
  | { ok: false; error: string }

// ---------- Fechas ----------

/** Fecha de hoy en Argentina, en formato YYYY-MM-DD. */
export function fechaHoyArgentina(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - DESFASE_ARGENTINA_MS).toISOString().slice(0, 10)
}

/** Convierte una fecha YYYY-MM-DD ya validada a Date (medianoche UTC). */
export function parseFechaRango(fecha: string): Date {
  const valor = parseFechaFiltro(fecha)
  if (!valor) throw new Error(`Fecha inválida: ${fecha}`)
  return valor
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(parseFechaRango(fecha).getTime() + dias * MS_POR_DIA).toISOString().slice(0, 10)
}

/** Rango de los últimos N días, incluyendo hoy. */
export function rangoUltimosDias(dias: number, ahora: Date = new Date()): RangoReporte {
  const hasta = fechaHoyArgentina(ahora)
  return { desde: sumarDias(hasta, -(dias - 1)), hasta }
}

/** Valida el rango recibido; si no viene ninguna fecha, usa los últimos 30 días. */
export function resolverRangoReporte(
  desde: string | null | undefined,
  hasta: string | null | undefined,
  ahora: Date = new Date()
): ResultadoRango {
  if (!desde && !hasta) {
    return { ok: true, rango: rangoUltimosDias(DIAS_RANGO_PREDETERMINADO, ahora) }
  }
  if (!desde || !hasta) {
    return { ok: false, error: 'Indicá las dos fechas del período (desde y hasta).' }
  }
  if (!parseFechaFiltro(desde) || !parseFechaFiltro(hasta)) {
    return { ok: false, error: 'El formato de fecha es inválido. Debe ser YYYY-MM-DD.' }
  }
  if (desde > hasta) {
    return { ok: false, error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".' }
  }
  return { ok: true, rango: { desde, hasta } }
}

/** Instantes UTC que cubren el rango completo en hora argentina: [inicio, fin). */
export function limitesInstantesArgentina(rango: RangoReporte): { inicio: Date; fin: Date } {
  return {
    inicio: new Date(parseFechaRango(rango.desde).getTime() + DESFASE_ARGENTINA_MS),
    fin: new Date(parseFechaRango(rango.hasta).getTime() + MS_POR_DIA + DESFASE_ARGENTINA_MS),
  }
}

// ---------- Métricas ----------

/** Porcentaje entero de parte sobre total; null cuando no hay datos. */
export function porcentaje(parte: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((parte / total) * 100)
}

export interface ConteoTurnos {
  especialidad: string
  estado: string
  cantidad: number
}

export interface TurnosEspecialidad {
  especialidad: string
  total: number
  porEstado: Record<EstadoTurnoReporte, number>
}

function esEstadoReporte(estado: string): estado is EstadoTurnoReporte {
  return (ESTADOS_TURNO_REPORTE as readonly string[]).includes(estado)
}

function estadosEnCero(): Record<EstadoTurnoReporte, number> {
  return { CONFIRMADO: 0, ATENDIDO: 0, AUSENTE: 0, CANCELADO: 0 }
}

/**
 * Agrupa los turnos reservados por especialidad. Incluye todas las especialidades conocidas
 * (aunque tengan 0 turnos) y las ordena de mayor a menor cantidad.
 */
export function agruparTurnosPorEspecialidad(
  conteos: ConteoTurnos[],
  especialidades: readonly string[]
): TurnosEspecialidad[] {
  const grupos = new Map<string, TurnosEspecialidad>(
    especialidades.map((especialidad) => [especialidad, { especialidad, total: 0, porEstado: estadosEnCero() }])
  )

  for (const { especialidad, estado, cantidad } of conteos) {
    if (!esEstadoReporte(estado)) continue
    const grupo = grupos.get(especialidad) ?? { especialidad, total: 0, porEstado: estadosEnCero() }
    grupo.porEstado[estado] += cantidad
    grupo.total += cantidad
    grupos.set(especialidad, grupo)
  }

  return [...grupos.values()].sort((a, b) => b.total - a.total)
}

export interface Asistencia {
  asistieron: number
  ausentes: number
  total: number
  porcentajeAsistencia: number | null
}

/** Asistencia = turnos ya resueltos: atendidos (asistió) o ausentes (no asistió). */
export function calcularAsistencia(turnos: TurnosEspecialidad[]): Asistencia {
  const asistieron = turnos.reduce((suma, t) => suma + t.porEstado.ATENDIDO, 0)
  const ausentes = turnos.reduce((suma, t) => suma + t.porEstado.AUSENTE, 0)
  const total = asistieron + ausentes
  return { asistieron, ausentes, total, porcentajeAsistencia: porcentaje(asistieron, total) }
}

export interface GrupoPagos {
  estado: string
  cantidad: number
  monto: number
}

export interface ResumenPagos {
  montoAprobado: number
  aprobados: number
  rechazados: number
  pendientes: number
  ticketPromedio: number | null
}

/** Resume los pagos: solo los aprobados suman al monto recaudado. */
export function resumirPagos(grupos: GrupoPagos[]): ResumenPagos {
  const contar = (estados: string[]) =>
    grupos.filter((g) => estados.includes(g.estado)).reduce((suma, g) => suma + g.cantidad, 0)

  const montoAprobado = grupos
    .filter((g) => g.estado === 'APROBADO')
    .reduce((suma, g) => suma + g.monto, 0)
  const aprobados = contar(['APROBADO'])

  return {
    montoAprobado,
    aprobados,
    rechazados: contar(['RECHAZADO', 'ERROR']),
    pendientes: contar(['PENDIENTE', 'PROCESANDO']),
    ticketPromedio: aprobados > 0 ? Math.round(montoAprobado / aprobados) : null,
  }
}

export interface StockVacuna {
  idVacuna: string
  nombre: string
  stock: number
  umbralAlerta: number
  stockBajo: boolean
}

/**
 * Marca las vacunas por debajo de su propio umbral de alerta (mismo criterio que el inventario
 * de enfermería) y las ordena para que las más urgentes queden primero.
 */
export function clasificarStockVacunas(
  vacunas: { idVacuna: string; nombre: string; stock: number; umbralAlerta: number }[]
): StockVacuna[] {
  return vacunas
    .map((v) => ({ ...v, stockBajo: v.stock < v.umbralAlerta }))
    .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, 'es'))
}
