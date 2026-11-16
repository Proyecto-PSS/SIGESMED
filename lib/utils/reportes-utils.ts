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

// ---------- US-40: Reporte de cantidad de turnos por especialidad ----------

export const ESPECIALIDADES_MEDICAS_REPORTE = [
  'CLINICA_MEDICA',
  'PEDIATRIA',
  'TRAUMATOLOGIA_ORTOPEDIA',
] as const

export type EspecialidadMedicaReporte = (typeof ESPECIALIDADES_MEDICAS_REPORTE)[number]

export const ETIQUETAS_ESPECIALIDAD_REPORTE: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

export const TEXTO_RANGO_FECHAS_INVERTIDO =
  'La fecha desde no puede ser posterior a la fecha hasta'

export const TEXTO_SIN_TURNOS_PERIODO =
  'No se encontraron turnos para el período seleccionado'

export class ReporteTurnosEspecialidadError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.name = 'ReporteTurnosEspecialidadError'
    this.statusCode = statusCode
  }
}

export interface RangoFechasValidadoUS40 {
  fechaDesde: string
  fechaHasta: string
  desdeDate: Date
  hastaDate: Date
}

/**
 * Valida las fechas `fechaDesde` y `fechaHasta` para el reporte US-40 (RF-40.1 & RF-40.2).
 * Ambas son obligatorias, en formato estricto YYYY-MM-DD, normalizadas a medianoche UTC
 * para aislar de desplazamientos por huso horario UTC-3, y verificando fechaDesde <= fechaHasta.
 */
export function validarRangoFechasTurnosEspecialidad(
  fechaDesdeInput: unknown,
  fechaHastaInput: unknown
): RangoFechasValidadoUS40 {
  const desdeStr = typeof fechaDesdeInput === 'string' ? fechaDesdeInput.trim() : ''
  const hastaStr = typeof fechaHastaInput === 'string' ? fechaHastaInput.trim() : ''

  if (!desdeStr || !hastaStr) {
    throw new ReporteTurnosEspecialidadError(
      'Las fechas desde y hasta son obligatorias para generar el reporte.',
      400
    )
  }

  const desdeDate = parseFechaFiltro(desdeStr)
  const hastaDate = parseFechaFiltro(hastaStr)

  if (!desdeDate || !hastaDate) {
    throw new ReporteTurnosEspecialidadError(
      'El formato de fecha es inválido. Debe utilizarse el formato YYYY-MM-DD.',
      400
    )
  }

  if (desdeDate.getTime() > hastaDate.getTime()) {
    throw new ReporteTurnosEspecialidadError(TEXTO_RANGO_FECHAS_INVERTIDO, 400)
  }

  return {
    fechaDesde: desdeStr,
    fechaHasta: hastaStr,
    desdeDate,
    hastaDate,
  }
}

/**
 * Calcula el porcentaje de participación redondeado a 2 decimales (RF-40.2).
 * Retorna 0 cuando el total general es 0.
 */
export function calcularPorcentajeEspecialidad(cantidad: number, totalGeneral: number): number {
  if (totalGeneral <= 0 || cantidad <= 0) return 0
  return Math.round((cantidad / totalGeneral) * 10000) / 100
}

export interface ItemTurnoPorEspecialidadDTO {
  especialidad: string
  nombre: string
  cantidad: number
  total: number
  porcentaje: number
  porEstado: Record<EstadoTurnoReporte, number>
}

export interface ReporteTurnosPorEspecialidadDTO {
  rango: {
    fechaDesde: string
    fechaHasta: string
  }
  fechaDesde: string
  fechaHasta: string
  totalGeneral: number
  sinResultados: boolean
  mensaje: string | null
  especialidades: ItemTurnoPorEspecialidadDTO[]
  resultados: ItemTurnoPorEspecialidadDTO[]
}

/**
 * Construye el reporte de cantidad de turnos por especialidad (US-40, RF-40.2).
 * - Contabiliza exclusivamente turnos efectivos/reservados: CONFIRMADO, ATENDIDO, AUSENTE, CANCELADO.
 * - Excluye explícitamente cupos vacíos en estado DISPONIBLE.
 * - Incluye todas las especialidades del catálogo (mostrando 0 si alguna no tuvo turnos).
 * - Calcula totalGeneral exacto y porcentaje de participación redondeado a 2 decimales.
 */
export function construirReporteTurnosPorEspecialidad(params: {
  fechaDesde: string
  fechaHasta: string
  conteos: ConteoTurnos[]
  especialidades?: readonly string[]
}): ReporteTurnosPorEspecialidadDTO {
  const catalogoEspecialidades = params.especialidades ?? ESPECIALIDADES_MEDICAS_REPORTE
  const agrupados = agruparTurnosPorEspecialidad(params.conteos, catalogoEspecialidades)

  const totalGeneral = agrupados.reduce((acc, item) => acc + item.total, 0)

  const items: ItemTurnoPorEspecialidadDTO[] = agrupados.map((item) => ({
    especialidad: item.especialidad,
    nombre: ETIQUETAS_ESPECIALIDAD_REPORTE[item.especialidad] ?? item.especialidad,
    cantidad: item.total,
    total: item.total,
    porcentaje: calcularPorcentajeEspecialidad(item.total, totalGeneral),
    porEstado: { ...item.porEstado },
  }))

  const sinResultados = totalGeneral === 0

  return {
    rango: {
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
    },
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    totalGeneral,
    sinResultados,
    mensaje: sinResultados ? TEXTO_SIN_TURNOS_PERIODO : null,
    especialidades: items,
    resultados: items,
  }
}
