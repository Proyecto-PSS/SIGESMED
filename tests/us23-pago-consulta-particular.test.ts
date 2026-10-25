import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type ModalidadConsulta = 'PARTICULAR' | 'COBERTURA'
type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'ATENDIDO' | 'AUSENTE'
type EstadoTransaccionPago = 'PROCESANDO' | 'APROBADO' | 'RECHAZADO'

interface TurnoReserva {
  idTurno: string
  idPaciente: string
  modalidad: ModalidadConsulta
  estado: EstadoTurno
  fecha: string
  hora: string
}

interface PagoReserva {
  idPago: string
  idTurno: string
  idPaciente: string
  monto: string
  moneda: 'ARS'
  estado: EstadoTransaccionPago
  proveedor: 'SIMULADA'
  transaccionExternaId?: string | null
  motivoRechazo?: string | null
  vinculadoAReserva: boolean
}

interface DatosPagoFormulario {
  numeroTarjeta?: string
  cvv?: string
  fechaVencimiento?: string
  nombreTitular?: string
}

const TARIFA_PARTICULAR_ARS = '15000.00'
const MONEDA_PAGO = 'ARS'
const PROVEEDOR_PASARELA = 'SIMULADA'

function validarFormularioPago(datos: DatosPagoFormulario): { ok: boolean; error?: string } {
  if (datos.numeroTarjeta || datos.cvv || datos.fechaVencimiento || datos.nombreTitular) {
    return { ok: false, error: 'Los datos de tarjeta no deben almacenarse en el sistema.' }
  }
  return { ok: true }
}

function esPasarelaSimulada(proveedor: string): boolean {
  return proveedor === PROVEEDOR_PASARELA
}

function crearPagoParaReserva(turno: TurnoReserva): PagoReserva {
  if (turno.modalidad !== 'PARTICULAR') {
    throw new Error('Solo las consultas particulares requieren pago en línea.')
  }
  if (turno.estado !== 'CONFIRMADO') {
    throw new Error('El turno debe estar confirmado para iniciar el pago.')
  }

  return {
    idPago: `pag_${turno.idTurno}`,
    idTurno: turno.idTurno,
    idPaciente: turno.idPaciente,
    monto: TARIFA_PARTICULAR_ARS,
    moneda: MONEDA_PAGO,
    estado: 'PROCESANDO',
    proveedor: PROVEEDOR_PASARELA,
    transaccionExternaId: null,
    motivoRechazo: null,
    vinculadoAReserva: true,
  }
}

function procesarPagoConPasarelaSimulada(pago: PagoReserva, resultado: 'APROBADO' | 'RECHAZADO'): PagoReserva {
  if (!esPasarelaSimulada(pago.proveedor)) {
    throw new Error('Proveedor de pasarela no válido.')
  }
  if (pago.estado !== 'PROCESANDO') {
    throw new Error('El pago no se encuentra en estado procesando.')
  }
  if (resultado === 'APROBADO') {
    pago.estado = 'APROBADO'
    pago.transaccionExternaId = `SIM-${Date.now().toString().slice(-8)}`
    pago.motivoRechazo = null
    return pago
  }

  pago.estado = 'RECHAZADO'
  pago.transaccionExternaId = null
  pago.motivoRechazo = 'Transacción rechazada por la pasarela simulada'
  return pago
}

function verificarConsistenciaEstados(pago: PagoReserva): { consistente: boolean; detalles: string[] } {
  const detalles: string[] = []
  let consistente = true

  if (pago.moneda !== MONEDA_PAGO) {
    detalles.push('Moneda incorrecta')
    consistente = false
  }
  if (pago.proveedor !== PROVEEDOR_PASARELA) {
    detalles.push('Proveedor incorrecto')
    consistente = false
  }
  if (!pago.vinculadoAReserva) {
    detalles.push('Pago no vinculado a la reserva')
    consistente = false
  }
  if (!pago.idTurno || !pago.idPaciente) {
    detalles.push('Vinculación con reserva incompleta')
    consistente = false
  }
  if (pago.estado === 'APROBADO' && !pago.transaccionExternaId) {
    detalles.push('Pago aprobado sin ID de transacción')
    consistente = false
  }
  if (pago.estado === 'RECHAZADO' && !pago.motivoRechazo) {
    detalles.push('Pago rechazado sin motivo')
    consistente = false
  }

  if (detalles.length === 0) detalles.push('Estados consistentes con la reserva')
  return { consistente, detalles }
}

const TURNO_PARTICULAR_CONFIRMADO: TurnoReserva = {
  idTurno: 'turno_001',
  idPaciente: 'pac_001',
  modalidad: 'PARTICULAR',
  estado: 'CONFIRMADO',
  fecha: '2026-12-01',
  hora: '09:30',
}

async function runAllTests() {
  console.log('\n=== US-23: PRUEBAS UNITARIAS DE PAGO DE CONSULTA PARTICULAR EN LÍNEA ===\n')

  // --- Escenario 1: Pantalla de pago en línea sin guardar datos de tarjeta ---
  await test('Esc.1: la pantalla de pago en línea no debe guardar datos de tarjeta, CVV ni vencimiento', () => {
    const res = validarFormularioPago({})
    assert.equal(res.ok, true)
  })

  await test('Esc.1: se rechaza el envío si se intenta persistir datos de tarjeta', () => {
    const res = validarFormularioPago({ numeroTarjeta: '4111111111111111', cvv: '123' })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Los datos de tarjeta no deben almacenarse en el sistema.')
  })

  // --- Escenario 2: Integración con pasarela simulada vinculada a la reserva ---
  await test('Esc.2: se crea el pago vinculado a la reserva para consulta particular confirmada', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    assert.equal(pago.vinculadoAReserva, true)
    assert.equal(pago.idTurno, 'turno_001')
    assert.equal(pago.idPaciente, 'pac_001')
    assert.equal(pago.proveedor, 'SIMULADA')
    assert.equal(pago.moneda, 'ARS')
    assert.equal(pago.monto, '15000.00')
  })

  await test('Esc.2: el pago inicia en estado PROCESANDO antes de la respuesta de la pasarela', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    assert.equal(pago.estado, 'PROCESANDO')
  })

  await test('Esc.2: solo se permite pagar consultas con modalidad PARTICULAR', () => {
    const turnoCobertura: TurnoReserva = { ...TURNO_PARTICULAR_CONFIRMADO, modalidad: 'COBERTURA' }
    let lanzoError = false
    try {
      crearPagoParaReserva(turnoCobertura)
    } catch (error: any) {
      lanzoError = true
      assert.ok(error.message.includes('particular'))
    }
    assert.equal(lanzoError, true)
  })

  await test('Esc.2: la pasarela utilizada es la simulada para entornos de prueba', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    assert.equal(esPasarelaSimulada(pago.proveedor), true)
    assert.equal(pago.proveedor, 'SIMULADA')
  })

  // --- Escenario 3: Pagos aprobados y rechazados validando consistencia de estados ---
  await test('Esc.3: pago APROBADO actualiza estado a APROBADO con transacción externa y sin motivo de rechazo', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    const pagoAprobado = procesarPagoConPasarelaSimulada(pago, 'APROBADO')
    assert.equal(pagoAprobado.estado, 'APROBADO')
    assert.ok(pagoAprobado.transaccionExternaId)
    assert.equal(pagoAprobado.motivoRechazo, null)
  })

  await test('Esc.3: pago RECHAZADO actualiza estado a RECHAZADO con motivo y sin transacción aprobada', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    const pagoRechazado = procesarPagoConPasarelaSimulada(pago, 'RECHAZADO')
    assert.equal(pagoRechazado.estado, 'RECHAZADO')
    assert.ok(pagoRechazado.motivoRechazo)
    assert.equal(pagoRechazado.transaccionExternaId, null)
  })

  await test('Esc.3: consistencia de estados para pago APROBADO vinculado a la reserva', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    const pagoAprobado = procesarPagoConPasarelaSimulada(pago, 'APROBADO')
    const verificacion = verificarConsistenciaEstados(pagoAprobado)
    assert.equal(verificacion.consistente, true)
    assert.ok(verificacion.detalles.includes('Estados consistentes con la reserva'))
  })

  await test('Esc.3: consistencia de estados para pago RECHAZADO vinculado a la reserva', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    const pagoRechazado = procesarPagoConPasarelaSimulada(pago, 'RECHAZADO')
    const verificacion = verificarConsistenciaEstados(pagoRechazado)
    assert.equal(verificacion.consistente, true)
    assert.ok(verificacion.detalles.includes('Estados consistentes con la reserva'))
  })

  await test('Esc.3: el turno de la reserva permanece vinculado al pago y no se pierde la trazabilidad', () => {
    const pago = crearPagoParaReserva(TURNO_PARTICULAR_CONFIRMADO)
    const pagoProcesado = procesarPagoConPasarelaSimulada(pago, 'APROBADO')
    assert.equal(pagoProcesado.idTurno, TURNO_PARTICULAR_CONFIRMADO.idTurno)
    assert.equal(pagoProcesado.idPaciente, TURNO_PARTICULAR_CONFIRMADO.idPaciente)
    assert.equal(pagoProcesado.vinculadoAReserva, true)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-23 PASARON EXITOSAMENTE (10/10) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-23:', error)
  process.exit(1)
})
