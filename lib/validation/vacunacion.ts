// Validaciones de dominio para el módulo de enfermería, stock de vacunas y turnos de vacunación (US-20).

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
