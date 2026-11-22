// US-43: Reporte de asistencia de pacientes.
// Lógica pura compartida por el endpoint, el servicio y la interfaz: clasificación de estados,
// cálculo de porcentajes con un único denominador, orquestación del endpoint y consulta del cliente.
// No accede a la base de datos, así se puede testear de forma aislada.
import { validarRangoFechasPagos } from './reportes-pagos-utils.ts'

export const ENDPOINT_REPORTE_ASISTENCIA = '/api/admin/reportes/asistencia'

/**
 * Clasificación explícita de los estados del enum `EstadoTurno` (prisma/schema.prisma):
 * - Estados finales que forman las métricas históricas: ATENDIDO, AUSENTE y CANCELADO.
 * - Estados no definitivos que se excluyen del cálculo y del denominador: CONFIRMADO
 *   (reservado, todavía sin resolver) y DISPONIBLE (cupo libre, sin paciente).
 * El enum no tiene un estado PENDIENTE; el equivalente "todavía no resuelto" es CONFIRMADO.
 */
export const CATEGORIA_POR_ESTADO_FINAL = {
  ATENDIDO: 'atendidos',
  AUSENTE: 'ausentes',
  CANCELADO: 'cancelados',
} as const

export type EstadoFinalAsistencia = keyof typeof CATEGORIA_POR_ESTADO_FINAL
export type CategoriaAsistencia = (typeof CATEGORIA_POR_ESTADO_FINAL)[EstadoFinalAsistencia]

export const ESTADOS_FINALES_ASISTENCIA = Object.keys(
  CATEGORIA_POR_ESTADO_FINAL
) as EstadoFinalAsistencia[]

/** Estados reservados que todavía no alcanzaron un estado final: se informan pero no se contabilizan. */
export const ESTADOS_NO_FINALIZADOS_ASISTENCIA = ['CONFIRMADO'] as const

/** Estados que consulta el servicio: los finales más los reservados aún no resueltos. */
export const ESTADOS_CONSULTADOS_ASISTENCIA = [
  ...ESTADOS_FINALES_ASISTENCIA,
  ...ESTADOS_NO_FINALIZADOS_ASISTENCIA,
] as const

export const TEXTO_SIN_TURNOS_FINALIZADOS =
  'No hay turnos con estado final (atendido, ausente o cancelado) en el período seleccionado.'
export const TEXTO_ERROR_REPORTE_ASISTENCIA =
  'No fue posible obtener el reporte de asistencia. Intentá nuevamente en unos minutos.'

// ---------- Validación del rango ----------

/**
 * Mismo criterio de validación que el resto de los reportes administrativos (US-42): fechas
 * obligatorias, formato estricto YYYY-MM-DD (rechaza fechas inexistentes) y Desde <= Hasta.
 */
export const validarRangoFechasAsistencia = validarRangoFechasPagos

// ---------- Cálculo de métricas ----------

export interface ConteoEstadoTurno {
  estado: string
  cantidad: number
}

export interface MetricaAsistencia {
  cantidad: number
  /** Porcentaje sin redondear (0 a 100). Se redondea solo al presentarlo. */
  porcentaje: number
}

export interface MetricasAsistencia {
  totalTurnosFinalizados: number
  atendidos: MetricaAsistencia
  ausentes: MetricaAsistencia
  cancelados: MetricaAsistencia
  /** Turnos reservados del período que todavía no tienen estado final (excluidos del cálculo). */
  turnosNoFinalizados: number
}

function esEstadoFinal(estado: string): estado is EstadoFinalAsistencia {
  return Object.prototype.hasOwnProperty.call(CATEGORIA_POR_ESTADO_FINAL, estado)
}

function esEstadoNoFinalizado(estado: string): boolean {
  return (ESTADOS_NO_FINALIZADOS_ASISTENCIA as readonly string[]).includes(estado)
}

/** (parte / total) × 100 sin redondear; 0 cuando no hay denominador (sin división por cero). */
export function calcularPorcentajeAsistencia(parte: number, total: number): number {
  if (total <= 0 || parte <= 0) return 0
  return (parte / total) * 100
}

/**
 * RF-43.3: clasifica los conteos por estado y calcula cantidades y porcentajes.
 * Denominador único: totalTurnosFinalizados = atendidos + ausentes + cancelados.
 * Los estados no definitivos (CONFIRMADO) y los desconocidos no suman a ninguna categoría
 * ni al denominador.
 */
export function calcularMetricasAsistencia(conteos: readonly ConteoEstadoTurno[]): MetricasAsistencia {
  const cantidades: Record<CategoriaAsistencia, number> = { atendidos: 0, ausentes: 0, cancelados: 0 }
  let turnosNoFinalizados = 0

  for (const { estado, cantidad } of conteos) {
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue
    if (esEstadoFinal(estado)) {
      cantidades[CATEGORIA_POR_ESTADO_FINAL[estado]] += cantidad
    } else if (esEstadoNoFinalizado(estado)) {
      turnosNoFinalizados += cantidad
    }
  }

  const totalTurnosFinalizados = cantidades.atendidos + cantidades.ausentes + cantidades.cancelados
  const metrica = (cantidad: number): MetricaAsistencia => ({
    cantidad,
    porcentaje: calcularPorcentajeAsistencia(cantidad, totalTurnosFinalizados),
  })

  return {
    totalTurnosFinalizados,
    atendidos: metrica(cantidades.atendidos),
    ausentes: metrica(cantidades.ausentes),
    cancelados: metrica(cantidades.cancelados),
    turnosNoFinalizados,
  }
}

export interface ReporteAsistenciaDTO extends MetricasAsistencia {
  fechaDesde: string
  fechaHasta: string
  sinResultados: boolean
  mensaje: string | null
}

export function construirReporteAsistencia(params: {
  fechaDesde: string
  fechaHasta: string
  conteos: readonly ConteoEstadoTurno[]
}): ReporteAsistenciaDTO {
  const metricas = calcularMetricasAsistencia(params.conteos)
  const sinResultados = metricas.totalTurnosFinalizados === 0
  return {
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    ...metricas,
    sinResultados,
    mensaje: sinResultados ? TEXTO_SIN_TURNOS_FINALIZADOS : null,
  }
}

// ---------- Presentación ----------

const formatoPorcentaje = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/** Redondeo visual a 1 decimal: 33.3333 → "33,3 %". */
export function formatearPorcentajeAsistencia(porcentaje: number): string {
  return `${formatoPorcentaje.format(Number.isFinite(porcentaje) ? porcentaje : 0)} %`
}

// ---------- Orquestación del endpoint (testeable sin Next/Clerk/Prisma) ----------

export interface RespuestaReporteAsistencia {
  status: number
  body: Record<string, unknown>
}

/**
 * Resuelve la petición GET del reporte. Primero autoriza (401/403 sin datos de asistencia),
 * luego valida el rango (400) y recién después consulta la base de datos.
 */
export async function ejecutarReporteAsistencia(deps: {
  autorizar: () => Promise<unknown>
  obtenerReporte: (fechaDesde: string, fechaHasta: string) => Promise<ReporteAsistenciaDTO>
  fechaDesde: string | null
  fechaHasta: string | null
  registrarError?: (error: unknown) => void
}): Promise<RespuestaReporteAsistencia> {
  try {
    await deps.autorizar()
  } catch (error: any) {
    const status = error?.statusCode === 403 ? 403 : error?.statusCode === 401 ? 401 : 500
    if (status === 500) {
      deps.registrarError?.(error)
      return { status, body: { ok: false, success: false, error: TEXTO_ERROR_REPORTE_ASISTENCIA } }
    }
    return {
      status,
      body: {
        ok: false,
        success: false,
        error:
          status === 403
            ? 'Acceso denegado: se requieren permisos de administrador.'
            : 'No autorizado: sesión no encontrada o perfil inexistente.',
      },
    }
  }

  const rango = validarRangoFechasAsistencia(deps.fechaDesde, deps.fechaHasta)
  if (!rango.ok) {
    return { status: 400, body: { ok: false, success: false, error: rango.error, code: rango.code } }
  }

  try {
    const reporte = await deps.obtenerReporte(rango.fechaDesde, rango.fechaHasta)
    return { status: 200, body: { ok: true, success: true, ...reporte } }
  } catch (error) {
    deps.registrarError?.(error)
    return { status: 500, body: { ok: false, success: false, error: TEXTO_ERROR_REPORTE_ASISTENCIA } }
  }
}

// ---------- Consulta desde el cliente ----------

export interface RespuestaHttpAsistencia {
  ok: boolean
  json: () => Promise<unknown>
}

export type ResultadoSolicitudReporteAsistencia =
  | { estado: 'rango_invalido'; error: string }
  | { estado: 'exito'; reporte: ReporteAsistenciaDTO }
  | { estado: 'error'; error: string }

function esMetricaValida(valor: unknown): valor is MetricaAsistencia {
  if (!valor || typeof valor !== 'object') return false
  const posible = valor as Partial<MetricaAsistencia>
  return (
    typeof posible.cantidad === 'number' &&
    Number.isFinite(posible.cantidad) &&
    typeof posible.porcentaje === 'number' &&
    Number.isFinite(posible.porcentaje)
  )
}

function esReporteAsistenciaValido(data: unknown): data is ReporteAsistenciaDTO {
  if (!data || typeof data !== 'object') return false
  const posible = data as Partial<ReporteAsistenciaDTO>
  return (
    typeof posible.totalTurnosFinalizados === 'number' &&
    typeof posible.fechaDesde === 'string' &&
    typeof posible.fechaHasta === 'string' &&
    esMetricaValida(posible.atendidos) &&
    esMetricaValida(posible.ausentes) &&
    esMetricaValida(posible.cancelados)
  )
}

/**
 * Valida el rango ANTES de consultar: si es inválido no se invoca `fetcher`.
 * Si la respuesta no es exitosa o está mal formada, devuelve un error sin datos parciales.
 */
export async function solicitarReporteAsistencia(
  fechaDesde: string,
  fechaHasta: string,
  fetcher: (url: string) => Promise<RespuestaHttpAsistencia>
): Promise<ResultadoSolicitudReporteAsistencia> {
  const rango = validarRangoFechasAsistencia(fechaDesde, fechaHasta)
  if (!rango.ok) return { estado: 'rango_invalido', error: rango.error }

  const params = new URLSearchParams({ fechaDesde: rango.fechaDesde, fechaHasta: rango.fechaHasta })

  try {
    const respuesta = await fetcher(`${ENDPOINT_REPORTE_ASISTENCIA}?${params.toString()}`)
    const data = (await respuesta.json().catch(() => null)) as Record<string, unknown> | null

    if (!respuesta.ok) {
      const mensaje = typeof data?.error === 'string' ? data.error : TEXTO_ERROR_REPORTE_ASISTENCIA
      return { estado: 'error', error: mensaje }
    }
    if (!esReporteAsistenciaValido(data)) return { estado: 'error', error: TEXTO_ERROR_REPORTE_ASISTENCIA }

    return { estado: 'exito', reporte: data }
  } catch {
    return { estado: 'error', error: TEXTO_ERROR_REPORTE_ASISTENCIA }
  }
}
