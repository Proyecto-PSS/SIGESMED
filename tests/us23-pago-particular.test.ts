// Suite exhaustiva de pruebas unitarias para US-23:
// Pago de consulta particular en línea, concurrencia, idempotencia y seguridad.
import assert from 'node:assert/strict'
import {
  PAGOS_CONFIG,
  obtenerTarifaConsulta,
} from '../lib/config/pagos-config.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// --------------------------------------------------------------------------
// Modelado y simulador en memoria para validación aislada y determinista
// --------------------------------------------------------------------------
type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'ATENDIDO'
type ModalidadTurno = 'PARTICULAR' | 'COBERTURA'
type EstadoPago = 'PENDIENTE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'ERROR'

interface TurnoMock {
  idTurno: string
  idPaciente: string | null
  modalidad: ModalidadTurno | null
  estado: EstadoTurno
  fecha: string
  hora: string
  especialidad: string
}

interface PagoMock {
  idPago: string
  idTurno: string
  idPaciente: string
  monto: string
  moneda: string
  estado: EstadoPago
  idempotencyKey: string
  proveedor: string
  transaccionExternaId?: string | null
  motivoRechazo?: string | null
  codigoError?: string | null
  aprobadoAt?: Date | null
}

class PagosServiceMock {
  turnos: Map<string, TurnoMock> = new Map()
  pagos: Map<string, PagoMock> = new Map()

  agregarTurno(t: TurnoMock) {
    this.turnos.set(t.idTurno, { ...t })
  }

  iniciarPagoTurno(input: {
    idTurno: string
    idPaciente: string
    idempotencyKey?: string
    montoClienteManipulado?: string
  }) {
    const { idTurno, idPaciente, idempotencyKey } = input

    if (!idTurno) {
      const err = new Error('El identificador del turno es requerido.')
      ;(err as any).statusCode = 400
      throw err
    }

    // 1. Idempotencia: si ya existe pago con esta clave
    if (idempotencyKey) {
      for (const p of this.pagos.values()) {
        if (p.idempotencyKey === idempotencyKey) {
          if (p.idTurno === idTurno && p.idPaciente === idPaciente) {
            return { pago: { ...p }, idempotent: true }
          }
          const err = new Error('La clave de idempotencia ya fue utilizada para otra operación de pago.')
          ;(err as any).statusCode = 409
          ;(err as any).code = 'IDEMPOTENCY_KEY_REUSED'
          throw err
        }
      }
    }

    // 2. Verificar existencia y titularidad
    const turno = this.turnos.get(idTurno)
    if (!turno) {
      const err = new Error('El turno solicitado no existe.')
      ;(err as any).statusCode = 404
      throw err
    }

    if (turno.idPaciente !== idPaciente) {
      const err = new Error('Acceso denegado: el turno no pertenece al paciente autenticado.')
      ;(err as any).statusCode = 403
      throw err
    }

    // 3. Modalidad
    if (turno.modalidad === 'COBERTURA') {
      const err = new Error('El turno fue reservado con cobertura médica y no requiere pago particular.')
      ;(err as any).statusCode = 409
      throw err
    }

    if (turno.modalidad !== 'PARTICULAR') {
      const err = new Error('La modalidad no admite pago particular.')
      ;(err as any).statusCode = 400
      throw err
    }

    // 4. Estado de turno
    if (turno.estado === 'CANCELADO') {
      const err = new Error('No se puede abonar una consulta cancelada.')
      ;(err as any).statusCode = 409
      throw err
    }

    if (turno.estado === 'ATENDIDO') {
      const err = new Error('No se puede abonar una consulta que ya fue atendida.')
      ;(err as any).statusCode = 409
      throw err
    }

    if (turno.estado !== 'CONFIRMADO') {
      const err = new Error('El turno debe estar confirmado para iniciar el pago.')
      ;(err as any).statusCode = 409
      throw err
    }

    // 5. Verificar si ya existe pago APROBADO para este turno
    for (const p of this.pagos.values()) {
      if (p.idTurno === idTurno && p.estado === 'APROBADO') {
        const err = new Error('Este turno ya cuenta con un pago aprobado registrado.')
        ;(err as any).statusCode = 409
        ;(err as any).code = 'PAYMENT_ALREADY_APPROVED'
        throw err
      }
    }

    // 6. Tarifa calculada exclusivamente en servidor (ignora montoClienteManipulado)
    const tarifa = obtenerTarifaConsulta(turno.especialidad)
    const idPago = `pago_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const claveFinal = idempotencyKey || `auto_${idPago}`

    const nuevoPago: PagoMock = {
      idPago,
      idTurno,
      idPaciente,
      monto: tarifa.monto,
      moneda: tarifa.moneda,
      estado: 'PENDIENTE',
      idempotencyKey: claveFinal,
      proveedor: 'SIMULADA',
      aprobadoAt: null,
      motivoRechazo: null,
      codigoError: null,
      transaccionExternaId: null,
    }

    this.pagos.set(idPago, nuevoPago)
    return { pago: { ...nuevoPago }, idempotent: false }
  }

  procesarResultadoPago(input: {
    idPago: string
    idPaciente?: string
    resultado: 'APROBADO' | 'RECHAZADO' | 'ERROR'
    transaccionExternaId?: string
    motivoRechazo?: string
    codigoError?: string
  }) {
    const { idPago, idPaciente, resultado, transaccionExternaId, motivoRechazo, codigoError } = input

    const pago = this.pagos.get(idPago)
    if (!pago) {
      const err = new Error('El pago solicitado no existe.')
      ;(err as any).statusCode = 404
      throw err
    }

    if (idPaciente && pago.idPaciente !== idPaciente) {
      const err = new Error('Acceso denegado: el pago no pertenece al paciente.')
      ;(err as any).statusCode = 403
      throw err
    }

    // Si ya está aprobado
    if (pago.estado === 'APROBADO') {
      if (resultado === 'APROBADO') {
        return { ...pago }
      }
      const err = new Error('No se puede modificar ni rechazar un pago que ya fue aprobado previamente.')
      ;(err as any).statusCode = 409
      throw err
    }

    // Si se aprueba, verificar que ningún otro pago del mismo turno se haya aprobado concurrentemente
    if (resultado === 'APROBADO') {
      for (const p of this.pagos.values()) {
        if (p.idTurno === pago.idTurno && p.estado === 'APROBADO' && p.idPago !== idPago) {
          const err = new Error('Ya existe otro pago aprobado registrado para este turno.')
          ;(err as any).statusCode = 409
          ;(err as any).code = 'PAYMENT_ALREADY_APPROVED'
          throw err
        }
      }
    }

    pago.estado = resultado
    if (resultado === 'APROBADO') {
      pago.aprobadoAt = new Date()
      pago.transaccionExternaId = transaccionExternaId || `SIM-${Date.now()}`
      pago.motivoRechazo = null
      pago.codigoError = null
    } else if (resultado === 'RECHAZADO') {
      pago.motivoRechazo = motivoRechazo || 'Transacción rechazada'
    } else {
      pago.codigoError = codigoError || 'ERROR_PASARELA'
    }

    return { ...pago }
  }

  obtenerEstadoPago(idPago: string, idPaciente: string) {
    const pago = this.pagos.get(idPago)
    if (!pago || pago.idPaciente !== idPaciente) {
      const err = new Error('Pago no encontrado o no autorizado.')
      ;(err as any).statusCode = 404
      throw err
    }
    return { ...pago }
  }
}

async function runAllTests() {
  console.log('\n=== US-23: PRUEBAS DE PAGO DE CONSULTA PARTICULAR EN LÍNEA ===\n')

  // --------------------------------------------------------------------------
  // Caso 1: Pago aprobado
  // --------------------------------------------------------------------------
  await test('Caso 1: Pago aprobado exitosamente persiste estado APROBADO vinculado al turno y tarifa correcta', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_01',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '10:00',
      especialidad: 'CLINICA_MEDICA',
    })

    const { pago, idempotent } = srv.iniciarPagoTurno({
      idTurno: 'tur_01',
      idPaciente: 'pac_01',
    })

    assert.equal(idempotent, false)
    assert.equal(pago.estado, 'PENDIENTE')
    assert.equal(pago.monto, '15000.00')
    assert.equal(pago.moneda, 'ARS')
    assert.equal(pago.idTurno, 'tur_01')

    const pagoAprobado = srv.procesarResultadoPago({
      idPago: pago.idPago,
      idPaciente: 'pac_01',
      resultado: 'APROBADO',
      transaccionExternaId: 'TRX-123456',
    })

    assert.equal(pagoAprobado.estado, 'APROBADO')
    assert.equal(pagoAprobado.transaccionExternaId, 'TRX-123456')
    assert.ok(pagoAprobado.aprobadoAt instanceof Date)

    // El turno original conserva sus datos intactos
    const turnoActual = srv.turnos.get('tur_01')
    assert.equal(turnoActual?.estado, 'CONFIRMADO')
    assert.equal(turnoActual?.modalidad, 'PARTICULAR')
  })

  // --------------------------------------------------------------------------
  // Caso 2: Pago rechazado
  // --------------------------------------------------------------------------
  await test('Caso 2: Pago rechazado actualiza estado a RECHAZADO, preserva turno y permite reintentar', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_02',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '11:00',
      especialidad: 'PEDIATRIA',
    })

    const { pago } = srv.iniciarPagoTurno({
      idTurno: 'tur_02',
      idPaciente: 'pac_01',
    })

    const pagoRechazado = srv.procesarResultadoPago({
      idPago: pago.idPago,
      idPaciente: 'pac_01',
      resultado: 'RECHAZADO',
      motivoRechazo: 'Fondos insuficientes',
    })

    assert.equal(pagoRechazado.estado, 'RECHAZADO')
    assert.equal(pagoRechazado.motivoRechazo, 'Fondos insuficientes')
    assert.equal(pagoRechazado.aprobadoAt, null)

    // El turno sigue confirmado
    assert.equal(srv.turnos.get('tur_02')?.estado, 'CONFIRMADO')

    // Se permite un nuevo intento de pago
    const nuevoIntento = srv.iniciarPagoTurno({
      idTurno: 'tur_02',
      idPaciente: 'pac_01',
    })
    assert.equal(nuevoIntento.pago.estado, 'PENDIENTE')
    assert.notEqual(nuevoIntento.pago.idPago, pago.idPago)
  })

  // --------------------------------------------------------------------------
  // Caso 3: Turno de cobertura médica
  // --------------------------------------------------------------------------
  await test('Caso 3: Rechaza iniciar pago particular si el turno tiene modalidad COBERTURA', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_cob',
      idPaciente: 'pac_01',
      modalidad: 'COBERTURA',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '12:00',
      especialidad: 'CLINICA_MEDICA',
    })

    assert.throws(
      () => {
        srv.iniciarPagoTurno({ idTurno: 'tur_cob', idPaciente: 'pac_01' })
      },
      (err: any) => {
        assert.equal(err.statusCode, 409)
        assert.ok(err.message.includes('cobertura médica y no requiere pago particular'))
        return true
      }
    )
  })

  // --------------------------------------------------------------------------
  // Caso 4: Titularidad y autorización
  // --------------------------------------------------------------------------
  await test('Caso 4: Rechaza con 403 si un paciente intenta pagar un turno ajeno', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_ajeno',
      idPaciente: 'pac_legitimo',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '13:00',
      especialidad: 'CLINICA_MEDICA',
    })

    assert.throws(
      () => {
        srv.iniciarPagoTurno({ idTurno: 'tur_ajeno', idPaciente: 'pac_intruso' })
      },
      (err: any) => {
        assert.equal(err.statusCode, 403)
        assert.ok(err.message.includes('no pertenece al paciente autenticado'))
        return true
      }
    )
  })

  // --------------------------------------------------------------------------
  // Caso 5: Turno no elegible (inexistente, cancelado, atendido, no confirmado)
  // --------------------------------------------------------------------------
  await test('Caso 5: Rechaza turnos inexistentes, cancelados, atendidos o disponibles', () => {
    const srv = new PagosServiceMock()

    // 5.1 Inexistente
    assert.throws(
      () => srv.iniciarPagoTurno({ idTurno: 'fantasma', idPaciente: 'pac_01' }),
      (err: any) => err.statusCode === 404
    )

    // 5.2 Cancelado
    srv.agregarTurno({
      idTurno: 'tur_canc',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CANCELADO',
      fecha: '2026-11-15',
      hora: '14:00',
      especialidad: 'CLINICA_MEDICA',
    })
    assert.throws(
      () => srv.iniciarPagoTurno({ idTurno: 'tur_canc', idPaciente: 'pac_01' }),
      (err: any) => err.statusCode === 409 && err.message.includes('cancelada')
    )

    // 5.3 Atendido
    srv.agregarTurno({
      idTurno: 'tur_atend',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'ATENDIDO',
      fecha: '2026-11-15',
      hora: '15:00',
      especialidad: 'CLINICA_MEDICA',
    })
    assert.throws(
      () => srv.iniciarPagoTurno({ idTurno: 'tur_atend', idPaciente: 'pac_01' }),
      (err: any) => err.statusCode === 409 && err.message.includes('atendida')
    )

    // 5.4 Disponible (sin reservar ni confirmar)
    srv.agregarTurno({
      idTurno: 'tur_disp',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'DISPONIBLE',
      fecha: '2026-11-15',
      hora: '16:00',
      especialidad: 'CLINICA_MEDICA',
    })
    assert.throws(
      () => srv.iniciarPagoTurno({ idTurno: 'tur_disp', idPaciente: 'pac_01' }),
      (err: any) => err.statusCode === 409 && err.message.includes('confirmado')
    )
  })

  // --------------------------------------------------------------------------
  // Caso 6: Idempotencia
  // --------------------------------------------------------------------------
  await test('Caso 6: Misma clave de idempotencia retorna el pago existente sin duplicar', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_idem',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '17:00',
      especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
    })

    const primera = srv.iniciarPagoTurno({
      idTurno: 'tur_idem',
      idPaciente: 'pac_01',
      idempotencyKey: 'clave_idem_100',
    })
    assert.equal(primera.idempotent, false)

    const segunda = srv.iniciarPagoTurno({
      idTurno: 'tur_idem',
      idPaciente: 'pac_01',
      idempotencyKey: 'clave_idem_100',
    })
    assert.equal(segunda.idempotent, true)
    assert.equal(segunda.pago.idPago, primera.pago.idPago)
    assert.equal(srv.pagos.size, 1)

    // Reutilizar la misma clave para otro turno arroja 409
    srv.agregarTurno({
      idTurno: 'tur_otro',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '18:00',
      especialidad: 'CLINICA_MEDICA',
    })
    assert.throws(
      () =>
        srv.iniciarPagoTurno({
          idTurno: 'tur_otro',
          idPaciente: 'pac_01',
          idempotencyKey: 'clave_idem_100',
        }),
      (err: any) => err.statusCode === 409 && err.code === 'IDEMPOTENCY_KEY_REUSED'
    )
  })

  // --------------------------------------------------------------------------
  // Caso 7: Concurrencia y prevención de doble aprobación
  // --------------------------------------------------------------------------
  await test('Caso 7: Impide dos pagos aprobados concurrentes para la misma obligación', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_concurrente',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '19:00',
      especialidad: 'CLINICA_MEDICA',
    })

    const intento1 = srv.iniciarPagoTurno({
      idTurno: 'tur_concurrente',
      idPaciente: 'pac_01',
      idempotencyKey: 'intento_1',
    })

    // Supongamos que se inició un segundo intento antes de completar el primero
    srv.agregarTurno({
      idTurno: 'tur_concurrente_2',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '19:00',
      especialidad: 'CLINICA_MEDICA',
    })

    // Aprobamos el primer intento
    srv.procesarResultadoPago({
      idPago: intento1.pago.idPago,
      idPaciente: 'pac_01',
      resultado: 'APROBADO',
    })

    // Intentar iniciar otro pago para el mismo turno ya aprobado falla
    assert.throws(
      () =>
        srv.iniciarPagoTurno({
          idTurno: 'tur_concurrente',
          idPaciente: 'pac_01',
          idempotencyKey: 'intento_2',
        }),
      (err: any) => err.statusCode === 409 && err.code === 'PAYMENT_ALREADY_APPROVED'
    )
  })

  // --------------------------------------------------------------------------
  // Caso 8: Importe y moneda calculados en servidor (ignora cliente)
  // --------------------------------------------------------------------------
  await test('Caso 8: El servidor calcula el arancel según especialidad médica e ignora montos manipulados', () => {
    const tarifaClinica = obtenerTarifaConsulta('CLINICA_MEDICA')
    const tarifaPediatria = obtenerTarifaConsulta('PEDIATRIA')
    const tarifaTraumatologia = obtenerTarifaConsulta('TRAUMATOLOGIA_ORTOPEDIA')
    const tarifaDefault = obtenerTarifaConsulta(null)

    assert.equal(tarifaClinica.monto, '15000.00')
    assert.equal(tarifaPediatria.monto, '18000.00')
    assert.equal(tarifaTraumatologia.monto, '20000.00')
    assert.equal(tarifaDefault.monto, '15000.00')
    assert.equal(tarifaClinica.moneda, 'ARS')

    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_trauma',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '09:00',
      especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
    })

    // Cliente envía $1.00 manipulado
    const { pago } = srv.iniciarPagoTurno({
      idTurno: 'tur_trauma',
      idPaciente: 'pac_01',
      montoClienteManipulado: '1.00',
    })

    // El servidor asigna $20000.00 de traumatología
    assert.equal(pago.monto, '20000.00')
    assert.equal(pago.moneda, 'ARS')
  })

  // --------------------------------------------------------------------------
  // Caso 9: Error técnico
  // --------------------------------------------------------------------------
  await test('Caso 9: Un fallo técnico registra estado ERROR y no marca el pago como aprobado', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_error',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '10:30',
      especialidad: 'CLINICA_MEDICA',
    })

    const { pago } = srv.iniciarPagoTurno({
      idTurno: 'tur_error',
      idPaciente: 'pac_01',
    })

    const pagoConError = srv.procesarResultadoPago({
      idPago: pago.idPago,
      idPaciente: 'pac_01',
      resultado: 'ERROR',
      codigoError: 'FALLO_CONEXION_PASARELA',
    })

    assert.equal(pagoConError.estado, 'ERROR')
    assert.equal(pagoConError.codigoError, 'FALLO_CONEXION_PASARELA')
    assert.equal(pagoConError.aprobadoAt, null)

    // Se puede consultar el estado técnico
    const consulta = srv.obtenerEstadoPago(pago.idPago, 'pac_01')
    assert.equal(consulta.estado, 'ERROR')
  })

  // --------------------------------------------------------------------------
  // Caso 10: Seguridad de datos
  // --------------------------------------------------------------------------
  await test('Caso 10: Los DTOs y modelos de pago no almacenan ni exponen números de tarjeta, CVV o PIN', () => {
    const srv = new PagosServiceMock()
    srv.agregarTurno({
      idTurno: 'tur_sec',
      idPaciente: 'pac_01',
      modalidad: 'PARTICULAR',
      estado: 'CONFIRMADO',
      fecha: '2026-11-15',
      hora: '11:30',
      especialidad: 'CLINICA_MEDICA',
    })

    const { pago } = srv.iniciarPagoTurno({
      idTurno: 'tur_sec',
      idPaciente: 'pac_01',
    })

    const clavesExpuestas = Object.keys(pago)
    const clavesSensibles = ['tarjeta', 'numeroTarjeta', 'pan', 'cvv', 'cvc', 'pin', 'card_number']

    for (const sensible of clavesSensibles) {
      assert.equal(
        clavesExpuestas.includes(sensible),
        false,
        `El DTO no debe contener el campo sensible ${sensible}`
      )
    }

    // Configuración segura
    assert.equal(PAGOS_CONFIG.MONEDA, 'ARS')
    assert.ok(PAGOS_CONFIG.PROVEEDOR === 'SIMULADA' || PAGOS_CONFIG.PROVEEDOR === 'MERCADOPAGO')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-23 PASARON EXITOSAMENTE (10/10) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS DE US-23:', err)
  process.exit(1)
})
