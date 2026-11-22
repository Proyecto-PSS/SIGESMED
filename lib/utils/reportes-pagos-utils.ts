// US-42: Reporte de pagos realizados.
// Lógica pura compartida por el endpoint, el servicio y la interfaz: validación del rango de fechas,
// criterio de inclusión de pagos, aritmética monetaria exacta (en centavos) y armado del DTO.
// No accede a la base de datos, así se puede testear de forma aislada.
import { limitesInstantesArgentina } from './reportes-utils.ts'

/** Estado que representa un pago exitoso en el modelo `PagoTurno` (enum `EstadoPago`). */
export const ESTADO_PAGO_EXITOSO = 'APROBADO' as const

export const ENDPOINT_REPORTE_PAGOS_REALIZADOS = '/api/admin/reportes/pagos-realizados'

export const TEXTO_RANGO_FECHAS_PAGOS_INVALIDO =
  'El rango de fechas ingresado es inválido. La Fecha Desde no puede ser posterior a la Fecha Hasta.'
export const TEXTO_FECHAS_PAGOS_OBLIGATORIAS =
  'Las fechas Desde y Hasta son obligatorias para generar el reporte.'
export const TEXTO_FORMATO_FECHA_PAGOS_INVALIDO =
  'El formato de fecha es inválido. Debe utilizarse el formato YYYY-MM-DD.'
export const TEXTO_SIN_PAGOS_PERIODO = 'No se registraron pagos realizados en el período seleccionado.'
export const TEXTO_ERROR_REPORTE_PAGOS =
  'No fue posible obtener el reporte de pagos realizados. Intentá nuevamente en unos minutos.'

export type CodigoErrorReportePagos =
  | 'FECHAS_REQUERIDAS'
  | 'FORMATO_FECHA_INVALIDO'
  | 'RANGO_FECHAS_INVALIDO'
  | 'TOTAL_INCONSISTENTE'
  | 'MONTO_INVALIDO'

export class ReportePagosRealizadosError extends Error {
  readonly statusCode: number
  readonly code: CodigoErrorReportePagos

  constructor(message: string, statusCode: number, code: CodigoErrorReportePagos) {
    super(message)
    this.name = 'ReportePagosRealizadosError'
    this.statusCode = statusCode
    this.code = code
  }
}

// ---------- Fechas ----------

/** Parsea YYYY-MM-DD rechazando fechas inexistentes (por ejemplo 2026-02-31). */
function parseFechaEstricta(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null
  }
  return fecha
}

export type ResultadoValidacionRangoPagos =
  | { ok: true; fechaDesde: string; fechaHasta: string }
  | { ok: false; error: string; code: CodigoErrorReportePagos }

/**
 * Valida el rango del reporte (RF-42.2 / RF-42.5). La usan tanto el frontend (antes de iniciar
 * cualquier petición o estado de carga) como el backend (validación autoritativa).
 */
export function validarRangoFechasPagos(
  fechaDesdeInput: unknown,
  fechaHastaInput: unknown
): ResultadoValidacionRangoPagos {
  const fechaDesde = typeof fechaDesdeInput === 'string' ? fechaDesdeInput.trim() : ''
  const fechaHasta = typeof fechaHastaInput === 'string' ? fechaHastaInput.trim() : ''

  if (!fechaDesde || !fechaHasta) {
    return { ok: false, error: TEXTO_FECHAS_PAGOS_OBLIGATORIAS, code: 'FECHAS_REQUERIDAS' }
  }

  const desde = parseFechaEstricta(fechaDesde)
  const hasta = parseFechaEstricta(fechaHasta)
  if (!desde || !hasta) {
    return { ok: false, error: TEXTO_FORMATO_FECHA_PAGOS_INVALIDO, code: 'FORMATO_FECHA_INVALIDO' }
  }

  if (desde.getTime() > hasta.getTime()) {
    return { ok: false, error: TEXTO_RANGO_FECHAS_PAGOS_INVALIDO, code: 'RANGO_FECHAS_INVALIDO' }
  }

  return { ok: true, fechaDesde, fechaHasta }
}

/**
 * Criterio de inclusión (RF-42.3): solo pagos APROBADOS cuya fecha de aprobación (`aprobadoAt`)
 * cae dentro de los días completos [fechaDesde, fechaHasta] en hora argentina (UTC-3).
 * El mismo filtro se usa para el detalle y para la agregación, así ambos son consistentes.
 */
export function construirFiltroPagosRealizados(fechaDesde: string, fechaHasta: string) {
  const { inicio, fin } = limitesInstantesArgentina({ desde: fechaDesde, hasta: fechaHasta })
  return {
    estado: ESTADO_PAGO_EXITOSO,
    aprobadoAt: { gte: inicio, lt: fin },
  }
}

// ---------- Aritmética monetaria exacta ----------

const PATRON_MONTO = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

/** Convierte un importe decimal en texto ("15000.5", "15000.50") a centavos enteros. */
export function montoACentavos(monto: string): bigint {
  const coincidencia = PATRON_MONTO.exec(monto.trim())
  if (!coincidencia) {
    throw new ReportePagosRealizadosError(`Importe inválido: ${monto}`, 500, 'MONTO_INVALIDO')
  }
  const [, signo, enteros, decimales = ''] = coincidencia
  const centavos = BigInt(enteros) * BigInt(100) + BigInt(decimales.padEnd(2, '0'))
  return signo ? -centavos : centavos
}

/** Convierte centavos enteros a texto decimal con exactamente 2 decimales ("1234.50"). */
export function centavosAMonto(centavos: bigint): string {
  const negativo = centavos < BigInt(0)
  const absoluto = negativo ? -centavos : centavos
  const enteros = absoluto / BigInt(100)
  const resto = (absoluto % BigInt(100)).toString().padStart(2, '0')
  return `${negativo ? '-' : ''}${enteros.toString()}.${resto}`
}

/** Normaliza un importe a 2 decimales sin pasar por punto flotante. */
export function normalizarMonto(monto: string): string {
  return centavosAMonto(montoACentavos(monto))
}

/** Suma exacta de importes decimales (sin redondeos individuales ni punto flotante). */
export function sumarMontos(montos: readonly string[]): string {
  const total = montos.reduce((acumulado, monto) => acumulado + montoACentavos(monto), BigInt(0))
  return centavosAMonto(total)
}

/**
 * Formato monetario argentino para presentación: "$ 125.450,00".
 * Trabaja sobre el texto decimal para no introducir errores de punto flotante.
 */
export function formatearMontoARS(monto: string): string {
  const normalizado = normalizarMonto(monto)
  const negativo = normalizado.startsWith('-')
  const [enteros, decimales] = (negativo ? normalizado.slice(1) : normalizado).split('.')
  const enterosConMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativo ? '-' : ''}$ ${enterosConMiles},${decimales}`
}

// ---------- DTO del reporte ----------

export const ETIQUETAS_ESPECIALIDAD_PAGOS: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

export const ETIQUETAS_PROVEEDOR_PAGO: Record<string, string> = {
  SIMULADA: 'Pasarela simulada',
  MERCADOPAGO: 'Mercado Pago',
}

/** Fila del reporte: solo datos administrativos, sin identificadores de transacción ni datos de contacto. */
export interface PagoRealizadoDTO {
  idPago: string
  fechaPago: string
  paciente: string
  profesional: string
  especialidad: string
  fechaTurno: string
  horaTurno: string
  numeroComprobante: string | null
  medioPago: string
  moneda: string
  monto: string
}

export interface ReportePagosRealizadosDTO {
  fechaDesde: string
  fechaHasta: string
  pagos: PagoRealizadoDTO[]
  cantidadPagos: number
  totalIngresos: string
  moneda: string
  sinResultados: boolean
  mensaje: string | null
}

/** Registro tal como lo devuelve la consulta del servicio (montos ya serializados a texto). */
export interface RegistroPagoRealizado {
  idPago: string
  monto: string
  moneda: string
  proveedor: string
  aprobadoAt: Date
  paciente: { nombre: string; apellido: string }
  turno: {
    fecha: Date
    hora: string
    medico: { nombre: string; apellido: string; especialidad: string }
  }
  comprobante: { numeroComprobante: string } | null
}

function nombreCompleto(persona: { nombre: string; apellido: string }): string {
  return [persona.apellido, persona.nombre].filter(Boolean).join(', ')
}

/**
 * Arma el reporte (RF-42.3 / RF-42.4). El total proviene de la agregación de la base de datos
 * y se verifica contra la suma exacta de los importes del detalle: si no coinciden, el reporte
 * no se entrega para no mostrar un total incorrecto.
 */
export function construirReportePagosRealizados(params: {
  fechaDesde: string
  fechaHasta: string
  registros: readonly RegistroPagoRealizado[]
  totalAgregado: string | null
  cantidadAgregada: number
}): ReportePagosRealizadosDTO {
  const pagos: PagoRealizadoDTO[] = params.registros.map((registro) => ({
    idPago: registro.idPago,
    fechaPago: registro.aprobadoAt.toISOString(),
    paciente: nombreCompleto(registro.paciente),
    profesional: nombreCompleto(registro.turno.medico),
    especialidad:
      ETIQUETAS_ESPECIALIDAD_PAGOS[registro.turno.medico.especialidad] ??
      registro.turno.medico.especialidad,
    fechaTurno: registro.turno.fecha.toISOString().slice(0, 10),
    horaTurno: registro.turno.hora,
    numeroComprobante: registro.comprobante?.numeroComprobante ?? null,
    medioPago: ETIQUETAS_PROVEEDOR_PAGO[registro.proveedor] ?? registro.proveedor,
    moneda: registro.moneda,
    monto: normalizarMonto(registro.monto),
  }))

  const totalIngresos = normalizarMonto(params.totalAgregado ?? '0')
  const sumaDetalle = sumarMontos(pagos.map((pago) => pago.monto))

  if (pagos.length !== params.cantidadAgregada || sumaDetalle !== totalIngresos) {
    throw new ReportePagosRealizadosError(
      'Inconsistencia entre el detalle de pagos y el total calculado.',
      500,
      'TOTAL_INCONSISTENTE'
    )
  }

  const sinResultados = pagos.length === 0

  return {
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    pagos,
    cantidadPagos: pagos.length,
    totalIngresos,
    moneda: pagos[0]?.moneda ?? 'ARS',
    sinResultados,
    mensaje: sinResultados ? TEXTO_SIN_PAGOS_PERIODO : null,
  }
}

// ---------- Orquestación del endpoint (testeable sin Next/Clerk/Prisma) ----------

export interface RespuestaReportePagos {
  status: number
  body: Record<string, unknown>
}

/**
 * Resuelve la petición GET del reporte. Primero autoriza (401/403 sin datos financieros),
 * luego valida el rango (400) y recién después consulta la base de datos.
 */
export async function ejecutarReportePagosRealizados(deps: {
  autorizar: () => Promise<unknown>
  obtenerReporte: (fechaDesde: string, fechaHasta: string) => Promise<ReportePagosRealizadosDTO>
  fechaDesde: string | null
  fechaHasta: string | null
  registrarError?: (error: unknown) => void
}): Promise<RespuestaReportePagos> {
  try {
    await deps.autorizar()
  } catch (error: any) {
    const status = error?.statusCode === 403 ? 403 : error?.statusCode === 401 ? 401 : 500
    if (status === 500) {
      deps.registrarError?.(error)
      return { status, body: { ok: false, success: false, error: TEXTO_ERROR_REPORTE_PAGOS } }
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

  const rango = validarRangoFechasPagos(deps.fechaDesde, deps.fechaHasta)
  if (!rango.ok) {
    return {
      status: 400,
      body: { ok: false, success: false, error: rango.error, code: rango.code },
    }
  }

  try {
    const reporte = await deps.obtenerReporte(rango.fechaDesde, rango.fechaHasta)
    return { status: 200, body: { ok: true, success: true, ...reporte } }
  } catch (error) {
    deps.registrarError?.(error)
    return {
      status: 500,
      body: { ok: false, success: false, error: TEXTO_ERROR_REPORTE_PAGOS },
    }
  }
}

// ---------- Consulta desde el cliente ----------

export interface RespuestaHttpMinima {
  ok: boolean
  json: () => Promise<unknown>
}

export type ResultadoSolicitudReportePagos =
  | { estado: 'rango_invalido'; error: string }
  | { estado: 'exito'; reporte: ReportePagosRealizadosDTO }
  | { estado: 'error'; error: string }

function esReporteValido(data: unknown): data is ReportePagosRealizadosDTO {
  if (!data || typeof data !== 'object') return false
  const posible = data as Partial<ReportePagosRealizadosDTO>
  return (
    Array.isArray(posible.pagos) &&
    typeof posible.totalIngresos === 'string' &&
    PATRON_MONTO.test(posible.totalIngresos) &&
    typeof posible.cantidadPagos === 'number'
  )
}

/**
 * Valida el rango ANTES de consultar (RF-42.5): si es inválido no se invoca `fetcher`.
 * Si la respuesta no es exitosa o está mal formada, devuelve un error sin datos parciales.
 */
export async function solicitarReportePagosRealizados(
  fechaDesde: string,
  fechaHasta: string,
  fetcher: (url: string) => Promise<RespuestaHttpMinima>
): Promise<ResultadoSolicitudReportePagos> {
  const rango = validarRangoFechasPagos(fechaDesde, fechaHasta)
  if (!rango.ok) return { estado: 'rango_invalido', error: rango.error }

  const params = new URLSearchParams({ fechaDesde: rango.fechaDesde, fechaHasta: rango.fechaHasta })

  try {
    const respuesta = await fetcher(`${ENDPOINT_REPORTE_PAGOS_REALIZADOS}?${params.toString()}`)
    const data = (await respuesta.json().catch(() => null)) as Record<string, unknown> | null

    if (!respuesta.ok) {
      const mensaje = typeof data?.error === 'string' ? data.error : TEXTO_ERROR_REPORTE_PAGOS
      return { estado: 'error', error: mensaje }
    }
    if (!esReporteValido(data)) return { estado: 'error', error: TEXTO_ERROR_REPORTE_PAGOS }

    return { estado: 'exito', reporte: data }
  } catch {
    return { estado: 'error', error: TEXTO_ERROR_REPORTE_PAGOS }
  }
}
