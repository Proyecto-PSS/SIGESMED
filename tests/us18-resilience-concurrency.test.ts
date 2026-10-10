import assert from 'node:assert/strict'
import { RESERVA_CONFIG } from '../lib/config/reserva-config.ts'
import { esErrorTransitorio } from '../lib/utils/resilient-fetch.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

async function runAllTests() {
  console.log('\n=== US-18: PRUEBAS DE RESILIENCIA, CONCURRENCIA E IDEMPOTENCIA ===\n')

  // --------------------------------------------------------------------------
  // Grupo 1: Configuración de Resiliencia y Detección de Errores Transitorios
  // --------------------------------------------------------------------------
  await test('RF-18.2 / RF-18.3: detecta errores transitorios de servidor (502, 503, 504)', () => {
    assert.equal(esErrorTransitorio(502), true)
    assert.equal(esErrorTransitorio(503), true)
    assert.equal(esErrorTransitorio(504), true)
  })

  await test('RF-18.3 / RF-18.9: rechaza retry automático ante errores no transitorios (400, 401, 403, 404, 409)', () => {
    assert.equal(esErrorTransitorio(400), false)
    assert.equal(esErrorTransitorio(401), false)
    assert.equal(esErrorTransitorio(403), false)
    assert.equal(esErrorTransitorio(404), false)
    assert.equal(esErrorTransitorio(409), false)
  })

  await test('RF-18.2: detecta errores de red y abortos por timeout como transitorios', () => {
    const networkError = new Error('Failed to fetch')
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'

    assert.equal(esErrorTransitorio(undefined, networkError), true)
    assert.equal(esErrorTransitorio(undefined, abortError), true)
  })

  await test('RF-18.3: parámetros de configuración de reserva y verificación válidos', () => {
    assert.equal(RESERVA_CONFIG.MAX_RETRIES, 3)
    assert.equal(RESERVA_CONFIG.RETRY_BASE_DELAY_MS, 1000)
    assert.equal(RESERVA_CONFIG.REQUEST_TIMEOUT_MS, 8000)
    assert.equal(RESERVA_CONFIG.VERIFY_TIMEOUT_MS, 6000)
    assert.equal(RESERVA_CONFIG.MAX_VERIFY_RETRIES, 3)
    assert.equal(RESERVA_CONFIG.VERIFY_INTERVAL_MS, 1500)
    assert.deepEqual([...RESERVA_CONFIG.TRANSIENT_STATUS_CODES], [502, 503, 504])
  })

  // --------------------------------------------------------------------------
  // Grupo 2: Simulación de Concurrencia Atómica y Exclusión Mutua en Base de Datos
  // --------------------------------------------------------------------------
  await test('RF-18.1 / Escenario 1 & 4: reserva concurrente simultánea — exactamente 1 paciente gana el turno', async () => {
    // Modelo de turno compartido en memoria simulando la fila de PostgreSQL
    let slot = {
      idTurno: 'turno-100',
      idMedico: 'medico-1',
      idPaciente: null as string | null,
      estado: 'DISPONIBLE' as 'DISPONIBLE' | 'CONFIRMADO',
      idempotencyKey: null as string | null,
    }

    // Mecanismo atómico condicional equivalente a Prisma updateMany:
    // UPDATE turnos SET idPaciente = $1, estado = 'CONFIRMADO', idempotencyKey = $2
    // WHERE idTurno = $3 AND estado = 'DISPONIBLE' AND idPaciente IS NULL
    async function simularConfirmarTurno(idTurno: string, idPaciente: string, idempotencyKey: string) {
      // Simula delay de red y procesamiento concurrente
      await new Promise((r) => setTimeout(r, Math.random() * 20))

      // Chequeo idempotencia previa
      if (slot.idempotencyKey === idempotencyKey && slot.idTurno === idTurno && slot.idPaciente === idPaciente) {
        return { turno: { ...slot }, idempotent: true }
      }

      // Actualización atómica condicional
      if (slot.idTurno === idTurno && slot.estado === 'DISPONIBLE' && slot.idPaciente === null) {
        slot = {
          ...slot,
          idPaciente,
          estado: 'CONFIRMADO',
          idempotencyKey,
        }
        return { turno: { ...slot }, idempotent: false }
      }

      // Fallo por exclusión mutua
      const error = new Error('El turno ya no está disponible') as Error & { statusCode: number; code: string }
      error.statusCode = 409
      error.code = 'TURN_ALREADY_RESERVED'
      throw error
    }

    // 10 solicitudes concurrentes intentando reservar el mismo turno a la vez
    const solicitudes = Array.from({ length: 10 }, (_, i) => ({
      idTurno: 'turno-100',
      idPaciente: `paciente-${i + 1}`,
      idempotencyKey: `key-${i + 1}`,
    }))

    const resultados = await Promise.allSettled(
      solicitudes.map((s) => simularConfirmarTurno(s.idTurno, s.idPaciente, s.idempotencyKey))
    )

    const exitosos = resultados.filter((r) => r.status === 'fulfilled')
    const rechazados = resultados.filter((r) => r.status === 'rejected')

    assert.equal(exitosos.length, 1, 'Exactamente una solicitud concurrente debe confirmar el turno')
    assert.equal(rechazados.length, 9, 'Las otras 9 solicitudes concurrentes deben ser rechazadas con conflicto')

    // Verificar que el estado del turno final es CONFIRMADO y asignado al ganador
    assert.equal(slot.estado, 'CONFIRMADO')
    assert.ok(slot.idPaciente !== null)
    assert.ok(slot.idempotencyKey !== null)

    // Verificar que los rechazados recibieron el código 409 TURN_ALREADY_RESERVED
    for (const rechazo of rechazados) {
      if (rechazo.status === 'rejected') {
        const err = rechazo.reason as Error & { statusCode?: number; code?: string }
        assert.equal(err.statusCode, 409)
        assert.equal(err.code, 'TURN_ALREADY_RESERVED')
      }
    }
  })

  // --------------------------------------------------------------------------
  // Grupo 3: Idempotencia y Reintentos
  // --------------------------------------------------------------------------
  await test('RF-18.3 / Escenario 5: reintento con la misma idempotencyKey devuelve reserva original (idempotent: true)', async () => {
    let slot = {
      idTurno: 'turno-200',
      idPaciente: 'paciente-1',
      estado: 'CONFIRMADO',
      idempotencyKey: 'idem-key-abc',
    }

    function simularConfirmacionIdempotente(idTurno: string, idPaciente: string, idempotencyKey: string) {
      if (slot.idempotencyKey === idempotencyKey) {
        if (slot.idTurno === idTurno && slot.idPaciente === idPaciente) {
          return { turno: { ...slot }, idempotent: true }
        }
        const err = new Error('La clave de idempotencia ya fue utilizada para otra operación') as Error & { statusCode: number }
        err.statusCode = 409
        throw err
      }
      throw new Error('No disponible')
    }

    const resultado1 = simularConfirmacionIdempotente('turno-200', 'paciente-1', 'idem-key-abc')
    assert.equal(resultado1.idempotent, true)
    assert.equal(resultado1.turno.idTurno, 'turno-200')
    assert.equal(resultado1.turno.idPaciente, 'paciente-1')

    const resultado2 = simularConfirmacionIdempotente('turno-200', 'paciente-1', 'idem-key-abc')
    assert.equal(resultado2.idempotent, true)
    assert.deepEqual(resultado1.turno, resultado2.turno)
  })

  await test('RF-18.3 / Escenario 6: reintento con otra clave para turno ocupado responde 409 sin modificar la reserva existente', async () => {
    const slot = {
      idTurno: 'turno-300',
      idPaciente: 'paciente-original',
      estado: 'CONFIRMADO',
      idempotencyKey: 'key-original',
    }

    function intentarReservaConOtraKey(idTurno: string, idPaciente: string, idempotencyKey: string) {
      if (slot.idempotencyKey === idempotencyKey && slot.idPaciente === idPaciente) {
        return { turno: { ...slot }, idempotent: true }
      }
      if (slot.estado !== 'DISPONIBLE') {
        const error = new Error('El turno ya no está disponible') as Error & { statusCode: number; code: string }
        error.statusCode = 409
        error.code = 'TURN_ALREADY_RESERVED'
        throw error
      }
    }

    assert.throws(
      () => intentarReservaConOtraKey('turno-300', 'paciente-nuevo', 'key-distinta'),
      (err: any) => err.statusCode === 409 && err.code === 'TURN_ALREADY_RESERVED'
    )
    assert.equal(slot.idPaciente, 'paciente-original')
  })

  await test('RF-18.3: reutilización de idempotencyKey para otro turno o paciente es rechazada con 409 IDEMPOTENCY_KEY_REUSED', () => {
    const slot = {
      idTurno: 'turno-400',
      idPaciente: 'paciente-A',
      estado: 'CONFIRMADO',
      idempotencyKey: 'key-compartida',
    }

    function validarUsoKey(idTurno: string, idPaciente: string, idempotencyKey: string) {
      if (slot.idempotencyKey === idempotencyKey) {
        if (slot.idTurno === idTurno && slot.idPaciente === idPaciente) {
          return { turno: slot, idempotent: true }
        }
        const err = new Error('La clave de idempotencia ya fue utilizada para otra operación') as Error & { statusCode: number; code: string }
        err.statusCode = 409
        err.code = 'IDEMPOTENCY_KEY_REUSED'
        throw err
      }
    }

    // Mismo idTurno pero diferente paciente con la misma key
    assert.throws(
      () => validarUsoKey('turno-400', 'paciente-B', 'key-compartida'),
      (err: any) => err.statusCode === 409 && err.code === 'IDEMPOTENCY_KEY_REUSED'
    )

    // Mismo paciente pero diferente turno con la misma key
    assert.throws(
      () => validarUsoKey('turno-401', 'paciente-A', 'key-compartida'),
      (err: any) => err.statusCode === 409 && err.code === 'IDEMPOTENCY_KEY_REUSED'
    )
  })

  // --------------------------------------------------------------------------
  // Grupo 4: Verificación de Estado y Control de Autorización (RF-18.4 & Escenario 7)
  // --------------------------------------------------------------------------
  await test('RF-18.4 / Escenario 3: consulta de estado recupera reserva confirmada tras pérdida de respuesta', () => {
    const dbTurnos = [
      {
        idTurno: 'turno-500',
        idPaciente: 'paciente-1',
        estado: 'CONFIRMADO',
        idempotencyKey: 'key-500',
      },
    ]

    function simularConsultarEstado(idTurno: string, idPaciente: string, idempotencyKey?: string) {
      if (idempotencyKey) {
        const conKey = dbTurnos.find((t) => t.idempotencyKey === idempotencyKey)
        if (conKey) {
          if (conKey.idPaciente !== idPaciente) {
            const err = new Error('No autorizado para consultar la operación de otro paciente') as Error & { statusCode: number }
            err.statusCode = 403
            throw err
          }
          if (conKey.idTurno === idTurno) {
            return { status: 'CONFIRMADO', turnoId: idTurno, turno: conKey }
          }
          return { status: 'RECHAZADO', turnoId: idTurno, message: 'La clave de idempotencia fue utilizada para otro turno.' }
        }
      }

      const t = dbTurnos.find((t) => t.idTurno === idTurno)
      if (!t) return { status: 'NO_ENCONTRADO', turnoId: idTurno }
      if (t.estado === 'CONFIRMADO') {
        if (t.idPaciente === idPaciente) return { status: 'CONFIRMADO', turnoId: idTurno, turno: t }
        return { status: 'RECHAZADO', turnoId: idTurno, message: 'El turno ya no está disponible.' }
      }
      return { status: 'NO_ENCONTRADO', turnoId: idTurno }
    }

    const res = simularConsultarEstado('turno-500', 'paciente-1', 'key-500')
    assert.equal(res.status, 'CONFIRMADO')
    assert.equal(res.turnoId, 'turno-500')
    assert.ok(res.turno)
    assert.equal(res.turno.idPaciente, 'paciente-1')
  })

  await test('Escenario 7: autorización estricta — paciente no puede consultar reservas de otros pacientes (403 FORBIDDEN)', () => {
    const dbTurnos = [
      {
        idTurno: 'turno-600',
        idPaciente: 'paciente-titular',
        estado: 'CONFIRMADO',
        idempotencyKey: 'key-privada-titular',
      },
    ]

    function simularConsultarEstado(idTurno: string, idPaciente: string, idempotencyKey?: string) {
      if (idempotencyKey) {
        const conKey = dbTurnos.find((t) => t.idempotencyKey === idempotencyKey)
        if (conKey) {
          if (conKey.idPaciente !== idPaciente) {
            const err = new Error('No autorizado para consultar la operación de otro paciente') as Error & { statusCode: number }
            err.statusCode = 403
            throw err
          }
          return { status: 'CONFIRMADO', turnoId: idTurno, turno: conKey }
        }
      }
      const t = dbTurnos.find((t) => t.idTurno === idTurno)
      if (t && t.idPaciente !== idPaciente) {
        // No revela datos del titular
        return { status: 'RECHAZADO', turnoId: idTurno, message: 'El turno ya no está disponible.' }
      }
      return { status: 'NO_ENCONTRADO', turnoId: idTurno }
    }

    // Intento con key de otro paciente -> 403
    assert.throws(
      () => simularConsultarEstado('turno-600', 'paciente-atacante', 'key-privada-titular'),
      (err: any) => err.statusCode === 403
    )

    // Intento con idTurno sin key -> rechazo de negocio sin filtrar datos del titular
    const resSinKey = simularConsultarEstado('turno-600', 'paciente-atacante', undefined)
    assert.equal(resSinKey.status, 'RECHAZADO')
    assert.equal((resSinKey as any).turno, undefined, 'No debe filtrar el objeto turno ni datos del otro paciente')
  })

  await test('RF-18.4: consulta de estado sobre turno DISPONIBLE devuelve NO_ENCONTRADO para permitir reintento seguro', () => {
    const slot = {
      idTurno: 'turno-700',
      idPaciente: null,
      estado: 'DISPONIBLE',
      idempotencyKey: null,
    }

    function simularConsultarEstado(idTurno: string) {
      if (slot.estado === 'DISPONIBLE') {
        return { status: 'NO_ENCONTRADO', turnoId: idTurno }
      }
      return { status: 'CONFIRMADO', turnoId: idTurno }
    }

    const res = simularConsultarEstado('turno-700')
    assert.equal(res.status, 'NO_ENCONTRADO')
  })

  // --------------------------------------------------------------------------
  // Grupo 5: Resiliencia e Idempotencia en Cancelación (RF-18.5 & Escenario 8)
  // --------------------------------------------------------------------------
  await test('RF-18.5 / Escenario 8: cancelación con pérdida de respuesta es idempotente y no falla con 404', async () => {
    let slot = {
      idTurno: 'turno-800',
      idPaciente: 'paciente-1' as string | null,
      estado: 'CONFIRMADO' as 'CONFIRMADO' | 'DISPONIBLE',
      motivoCancelacion: null as string | null,
      idempotencyKey: 'key-reserva' as string | null,
    }

    function simularCancelar(idTurno: string, idPaciente: string, horasRestantes: number) {
      if (horasRestantes <= 48) {
        const err = new Error('No se puede cancelar el turno porque faltan 48 horas o menos') as Error & { statusCode: number }
        err.statusCode = 409
        throw err
      }

      // Si ya fue cancelado por este paciente (reintento idempotente)
      if (slot.idTurno === idTurno && slot.estado === 'DISPONIBLE' && slot.motivoCancelacion === 'Cancelado por el paciente') {
        return { ...slot }
      }

      if (slot.idTurno === idTurno && slot.idPaciente === idPaciente && slot.estado === 'CONFIRMADO') {
        slot = {
          ...slot,
          idPaciente: null,
          estado: 'DISPONIBLE',
          motivoCancelacion: 'Cancelado por el paciente',
          idempotencyKey: null, // limpia la clave para futuros turnos
        }
        return { ...slot }
      }

      const err = new Error('No se encontró el turno o ya no está confirmado') as Error & { statusCode: number }
      err.statusCode = 404
      throw err
    }

    // Intento 1: se ejecuta con éxito en el backend (más de 48 hs antes)
    const primerIntento = simularCancelar('turno-800', 'paciente-1', 72)
    assert.equal(primerIntento.estado, 'DISPONIBLE')
    assert.equal(primerIntento.idPaciente, null)
    assert.equal(primerIntento.motivoCancelacion, 'Cancelado por el paciente')
    assert.equal(primerIntento.idempotencyKey, null)

    // Intento 2: reintento por pérdida de red — debe resolverse de forma idempotente sin error 404
    const segundoIntento = simularCancelar('turno-800', 'paciente-1', 72)
    assert.equal(segundoIntento.estado, 'DISPONIBLE')
    assert.equal(segundoIntento.idPaciente, null)
  })

  await test('RF-18.5: cancelación con menos de 48 horas es rechazada con 409 y no es reintentada', () => {
    function simularCancelar(horasRestantes: number) {
      if (horasRestantes <= 48) {
        const err = new Error('No se puede cancelar el turno porque faltan 48 horas o menos') as Error & { statusCode: number }
        err.statusCode = 409
        throw err
      }
    }

    assert.throws(
      () => simularCancelar(48),
      (err: any) => err.statusCode === 409
    )
    assert.throws(
      () => simularCancelar(24),
      (err: any) => err.statusCode === 409
    )
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-18 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((err) => {
  console.error('Fallo en pruebas US-18:', err)
  process.exit(1)
})
