export type TipoDiagnosticoValor = 'PRESUNTIVO' | 'DEFINITIVO' | 'EN_ESTUDIO'

export const TIPOS_DIAGNOSTICO_VALIDOS: readonly TipoDiagnosticoValor[] = [
  'PRESUNTIVO',
  'DEFINITIVO',
  'EN_ESTUDIO',
] as const

export const ETIQUETAS_TIPO_DIAGNOSTICO: Record<TipoDiagnosticoValor, string> = {
  PRESUNTIVO: 'Presuntivo',
  DEFINITIVO: 'Definitivo',
  EN_ESTUDIO: 'En estudio',
}

export const OPCIONES_TIPO_DIAGNOSTICO: ReadonlyArray<{
  value: TipoDiagnosticoValor
  label: string
}> = [
  { value: 'PRESUNTIVO', label: 'Presuntivo' },
  { value: 'DEFINITIVO', label: 'Definitivo' },
  { value: 'EN_ESTUDIO', label: 'En estudio' },
]

export interface CargaAtencionMedicaValidada {
  diagnosticoPrincipal: string
  tipoDiagnostico: TipoDiagnosticoValor
  observacionesClinicas: string | null
  detalleTratamiento: string | null
  indicacionesFarmacologicas: string | null
}

const MAX_LONGITUD_DIAGNOSTICO = 2000
const MAX_LONGITUD_TEXTO_CLINICO = 5000

export class HistoriaClinicaError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.name = 'HistoriaClinicaError'
    this.statusCode = statusCode
  }
}

export function esTipoDiagnosticoValido(valor: unknown): valor is TipoDiagnosticoValor {
  return (
    typeof valor === 'string' &&
    (TIPOS_DIAGNOSTICO_VALIDOS as readonly string[]).includes(valor)
  )
}

function normalizarCampoOpcional(
  valor: unknown,
  etiquetaCampo: string,
  maxLongitud: number = MAX_LONGITUD_TEXTO_CLINICO
): string | null {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string') {
    throw new HistoriaClinicaError(
      `El campo "${etiquetaCampo}" debe ser una cadena de texto válida.`,
      400
    )
  }
  const limpio = valor.trim()
  if (!limpio) return null
  if (limpio.length > maxLongitud) {
    throw new HistoriaClinicaError(
      `El campo "${etiquetaCampo}" no puede superar los ${maxLongitud} caracteres.`,
      400
    )
  }
  return limpio
}

/**
 * Valida y normaliza los datos de entrada para el registro de una atención médica (US-38).
 * Ignora explícitamente cualquier identificador de médico, paciente o fecha enviado por el cliente.
 */
export function validarCargaAtencionMedica(payload: unknown): CargaAtencionMedicaValidada {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HistoriaClinicaError('Los datos enviados para la atención médica no son válidos.', 400)
  }

  const raw = payload as Record<string, unknown>

  if (typeof raw.diagnosticoPrincipal !== 'string') {
    throw new HistoriaClinicaError('El diagnóstico principal es obligatorio.', 400)
  }

  const diagnosticoPrincipal = raw.diagnosticoPrincipal.trim()
  if (!diagnosticoPrincipal) {
    throw new HistoriaClinicaError('El diagnóstico principal es obligatorio y no puede estar vacío.', 400)
  }

  if (diagnosticoPrincipal.length > MAX_LONGITUD_DIAGNOSTICO) {
    throw new HistoriaClinicaError(
      `El diagnóstico principal no puede superar los ${MAX_LONGITUD_DIAGNOSTICO} caracteres.`,
      400
    )
  }

  if (!esTipoDiagnosticoValido(raw.tipoDiagnostico)) {
    throw new HistoriaClinicaError(
      'El tipo de diagnóstico es obligatorio y debe ser PRESUNTIVO, DEFINITIVO o EN_ESTUDIO.',
      400
    )
  }

  const observacionesClinicas = normalizarCampoOpcional(
    raw.observacionesClinicas,
    'Observaciones clínicas'
  )
  const detalleTratamiento = normalizarCampoOpcional(
    raw.detalleTratamiento,
    'Detalle del tratamiento'
  )
  const indicacionesFarmacologicas = normalizarCampoOpcional(
    raw.indicacionesFarmacologicas,
    'Indicaciones farmacológicas'
  )

  return {
    diagnosticoPrincipal,
    tipoDiagnostico: raw.tipoDiagnostico,
    observacionesClinicas,
    detalleTratamiento,
    indicacionesFarmacologicas,
  }
}

export function construirMensajeExitoAtencion(datos: {
  detalleTratamiento: string | null
  indicacionesFarmacologicas: string | null
}): string {
  const tieneTratamiento = Boolean(
    datos.detalleTratamiento || datos.indicacionesFarmacologicas
  )
  return tieneTratamiento
    ? 'Diagnóstico y tratamiento guardados exitosamente en la historia clínica del paciente'
    : 'Registro clínico guardado exitosamente.'
}

export const TEXTO_HISTORIAL_VACIO_TITULO =
  'Todavía no tenés registros en tu historial clínico.'

export const TEXTO_HISTORIAL_VACIO_DESCRIPCION =
  'Cuando realices una atención médica y el profesional registre información en tu ficha, podrás consultarla desde esta sección.'

export const TEXTO_SIN_OBSERVACIONES = 'No se registraron observaciones'
export const TEXTO_SIN_TRATAMIENTO = 'No se indicó tratamiento'
export const TEXTO_SIN_INDICACIONES_FARMACOLOGICAS =
  'No se registraron indicaciones farmacológicas'

export const TEXTO_DNI_NO_ENCONTRADO =
  'No se encontraron pacientes con el DNI ingresado'

export const TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS =
  'Este paciente aún no posee registros clínicos cargados'

const REGEX_DNI_VALIDO = /^\d{7,8}$/

/**
 * Sanea el valor de DNI eliminando espacios en blanco y puntos separadores de miles.
 */
export function sanearDniBusqueda(valor: unknown): string {
  if (typeof valor !== 'string') {
    throw new HistoriaClinicaError(
      'El DNI es obligatorio y debe contener entre 7 y 8 dígitos numéricos.',
      400
    )
  }
  return valor.trim().replace(/[\s.]/g, '')
}

/**
 * Verifica si un DNI ya saneado cumple el formato numérico de 7 a 8 dígitos.
 */
export function esDniValido(dniSaneado: string): boolean {
  return REGEX_DNI_VALIDO.test(dniSaneado)
}

/**
 * Sanea y valida el DNI ingresado para búsqueda de pacientes (US-17).
 * Si el formato es inválido, lanza HistoriaClinicaError (400 Bad Request) antes de consultar la BD.
 */
export function validarDniBusqueda(valor: unknown): string {
  const dniLimpio = sanearDniBusqueda(valor)
  if (!dniLimpio) {
    throw new HistoriaClinicaError(
      'El DNI es obligatorio para realizar la búsqueda.',
      400
    )
  }
  if (!esDniValido(dniLimpio)) {
    throw new HistoriaClinicaError(
      'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.',
      400
    )
  }
  return dniLimpio
}

const MESES_ARGENTINA = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/**
 * Formatea un timestamp de atención médica en la zona horaria de Argentina (UTC-3)
 * de manera 100% determinista entre servidor (Node.js) y navegador (evitando hydration mismatch).
 */
export function formatearFechaHoraAtencionArgentina(valor: Date | string): string {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(fecha.getTime())) {
    return typeof valor === 'string' ? valor : ''
  }

  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'numeric',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha)

  const mapa: Record<string, string> = {}
  for (const p of partes) {
    mapa[p.type] = p.value
  }

  const dia = mapa.day ?? '01'
  const mesIdx = Number(mapa.month ?? 1) - 1
  const nombreMes = MESES_ARGENTINA[mesIdx] ?? ''
  const anio = mapa.year ?? ''
  const horaRaw = mapa.hour === '24' ? '00' : (mapa.hour ?? '00')
  const minuto = mapa.minute ?? '00'

  return `${dia} de ${nombreMes} de ${anio} · ${horaRaw}:${minuto} hs`
}

function normalizarTextoBusqueda(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Filtra pacientes en tiempo real por DNI, nombre completo (en cualquier orden, sin importar tildes),
 * correo electrónico u obra social.
 */
export function filtrarPacientesPorTermino<
  T extends {
    nombre: string
    apellido: string
    dni: string
    email: string
    obraSocial?: string | null
  },
>(pacientes: readonly T[], busqueda?: string): T[] {
  const terminoNormalizado = normalizarTextoBusqueda(busqueda ?? '')
  if (!terminoNormalizado) return [...pacientes]

  const palabras = terminoNormalizado.split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return [...pacientes]

  return pacientes.filter((p) => {
    const textoIndexado = normalizarTextoBusqueda(
      `${p.nombre} ${p.apellido} ${p.dni} ${p.email} ${p.obraSocial ?? ''}`
    )
    return palabras.every((palabra) => textoIndexado.includes(palabra))
  })
}

