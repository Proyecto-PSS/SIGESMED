// Validaciones de dominio para el módulo de enfermería, stock de vacunas y turnos de vacunación (US-20, US-31, US-32).
import {
  esCategoriaVacuna,
  UMBRAL_ALERTA_PREDETERMINADO,
  type CategoriaVacuna,
} from '../utils/inventario-vacunas.ts'

export interface ValidacionResultado<T> {
  ok: boolean
  datos?: T
  error?: string
}

export interface DatosMovimientoStockInput {
  idVacuna: string
  tipoMovimiento: 'INGRESO' | 'AJUSTE'
  cantidad: number
  numeroLote?: string
  vencimiento?: string
  motivo?: string
  idempotencyKey?: string
}

export interface DatosAsignarTurnoInput {
  idPaciente: string
  idVacuna?: string
  idLote?: string
  idempotencyKey?: string
}

export function validarMovimientoStock(input: any): ValidacionResultado<DatosMovimientoStockInput> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Los datos del movimiento son requeridos.' }
  }

  const { idVacuna, tipoMovimiento, cantidad, numeroLote, vencimiento, motivo, idempotencyKey } = input

  if (!idVacuna || typeof idVacuna !== 'string' || !idVacuna.trim()) {
    return { ok: false, error: 'Debe seleccionar una vacuna válida.' }
  }

  if (tipoMovimiento !== 'INGRESO' && tipoMovimiento !== 'AJUSTE') {
    return { ok: false, error: 'El tipo de movimiento debe ser INGRESO o AJUSTE.' }
  }

  const cantNum = Number(cantidad)
  if (isNaN(cantNum) || !Number.isInteger(cantNum) || cantNum === 0) {
    return { ok: false, error: 'La cantidad debe ser un número entero distinto de cero.' }
  }

  if (tipoMovimiento === 'INGRESO' && cantNum <= 0) {
    return { ok: false, error: 'Un ingreso de stock debe tener una cantidad estrictamente positiva.' }
  }

  let parsedVencimiento: string | undefined = undefined
  if (vencimiento) {
    if (typeof vencimiento !== 'string' || isNaN(Date.parse(vencimiento))) {
      return { ok: false, error: 'La fecha de vencimiento ingresada no es válida.' }
    }
    parsedVencimiento = vencimiento.slice(0, 10)
  }

  return {
    ok: true,
    datos: {
      idVacuna: idVacuna.trim(),
      tipoMovimiento,
      cantidad: cantNum,
      numeroLote: numeroLote ? String(numeroLote).trim() : undefined,
      vencimiento: parsedVencimiento,
      motivo: motivo ? String(motivo).trim() : undefined,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
    },
  }
}

export function validarAsignarTurno(input: any): ValidacionResultado<DatosAsignarTurnoInput> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Los datos de asignación son requeridos.' }
  }

  const { idPaciente, idVacuna, idLote, idempotencyKey } = input

  if (!idPaciente || typeof idPaciente !== 'string' || !idPaciente.trim()) {
    return { ok: false, error: 'Debe seleccionar un paciente válido.' }
  }

  return {
    ok: true,
    datos: {
      idPaciente: idPaciente.trim(),
      idVacuna: idVacuna ? String(idVacuna).trim() : undefined,
      idLote: idLote ? String(idLote).trim() : undefined,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
    },
  }
}

// ---------- US-31: alta de vacuna ----------

export interface DatosAltaVacunaInput {
  nombre: string
  categoria: CategoriaVacuna
  stockInicial: number
  umbralAlerta: number
  laboratorio?: string
  presentacion?: string
  numeroLote?: string
  vencimiento?: string
}

const CATEGORIA_PREDETERMINADA: CategoriaVacuna = 'CALENDARIO_NACIONAL'
const LARGO_MAXIMO_NOMBRE = 80
const UMBRAL_MAXIMO = 1000

function textoOpcional(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const limpio = valor.trim()
  return limpio || undefined
}

function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0
}

/** Convierte a número lo que llega del formulario; vacío o inválido queda como NaN. */
function aNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor
  if (typeof valor === 'string' && valor.trim() !== '') return Number(valor)
  return NaN
}

function esFechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !isNaN(Date.parse(`${fecha}T00:00:00.000Z`))
}

export function validarAltaVacuna(input: any): ValidacionResultado<DatosAltaVacunaInput> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Los datos de la vacuna son requeridos.' }
  }

  const nombre = textoOpcional(input.nombre)
  if (!nombre) {
    return { ok: false, error: 'Ingresá el nombre de la vacuna.' }
  }
  if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    return { ok: false, error: `El nombre no puede superar los ${LARGO_MAXIMO_NOMBRE} caracteres.` }
  }

  // La categoría es opcional: si no se indica, la vacuna queda en el calendario nacional.
  const categoria = input.categoria === undefined || input.categoria === '' ? CATEGORIA_PREDETERMINADA : input.categoria
  if (!esCategoriaVacuna(categoria)) {
    return { ok: false, error: 'Elegí una categoría válida.' }
  }

  const stockInicial = aNumero(input.stockInicial)
  if (!Number.isInteger(stockInicial)) {
    return { ok: false, error: 'La cantidad inicial debe ser un número entero.' }
  }
  if (stockInicial < 0) {
    return { ok: false, error: 'La cantidad inicial no puede ser negativa.' }
  }

  const umbralIngresado = input.umbralAlerta === undefined || input.umbralAlerta === ''
    ? UMBRAL_ALERTA_PREDETERMINADO
    : aNumero(input.umbralAlerta)
  if (!esEnteroNoNegativo(umbralIngresado) || umbralIngresado < 1 || umbralIngresado > UMBRAL_MAXIMO) {
    return { ok: false, error: `El umbral de alerta debe ser un número entero entre 1 y ${UMBRAL_MAXIMO}.` }
  }

  const numeroLote = textoOpcional(input.numeroLote)
  const vencimiento = textoOpcional(input.vencimiento)
  if (vencimiento && !esFechaValida(vencimiento)) {
    return { ok: false, error: 'La fecha de vencimiento no es válida.' }
  }
  if (vencimiento && !numeroLote) {
    return { ok: false, error: 'Para indicar un vencimiento, ingresá también el número de lote.' }
  }

  return {
    ok: true,
    datos: {
      nombre,
      categoria,
      stockInicial,
      umbralAlerta: umbralIngresado,
      laboratorio: textoOpcional(input.laboratorio),
      presentacion: textoOpcional(input.presentacion),
      numeroLote,
      vencimiento,
    },
  }
}

// ---------- US-32: actualización de stock ----------

export interface DatosActualizacionStockInput {
  stockNuevo: number
  motivo?: string
}

export function validarActualizacionStock(input: any): ValidacionResultado<DatosActualizacionStockInput> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Los datos de la actualización son requeridos.' }
  }

  const stockNuevo = aNumero(input.stockNuevo)
  if (!Number.isInteger(stockNuevo)) {
    return { ok: false, error: 'La cantidad debe ser un número entero.' }
  }
  if (stockNuevo < 0) {
    return { ok: false, error: 'La cantidad no puede ser negativa.' }
  }

  return { ok: true, datos: { stockNuevo, motivo: textoOpcional(input.motivo) } }
}
