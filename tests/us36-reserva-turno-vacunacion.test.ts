// Suite de pruebas unitarias para US-36:
// Disponibilidad de vacunas/horarios, decremento atómico de stock y lote FEFO,
// idempotencia y reservas concurrentes (Promise.all).
import assert from 'node:assert/strict'
import { validarAsignarTurno } from '../lib/validation/vacunacion.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

interface VacunaRow {
  idVacuna: string
  nombre: string
  stock: number
}

interface LoteRow {
  idLote: string
  idVacuna: string
  numeroLote: string
  stock: number
  vencimiento: Date | null
  createdAt: Date
}

interface TurnoRow {
  idTurnoVacunacion: string
  idEnfermero: string
  idVacuna: string
  idPaciente: string | null
  idLote: string | null
  fecha: Date
  hora: string
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'APLICADO'
  idempotencyKey: string | null
}

interface MovimientoRow {
  idVacuna: string
  idLote: string | null
  tipoMovimiento: 'CONSUMO' | 'LIBERACION'
  cantidad: number
  stockAnterior: number
  stockNuevo: number
  idempotencyKey: string | null
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

/**
 * Simulador fiel de US-36 (obtenerVacunasConTurnosDisponibles + reservarTurnoVacunacionPaciente)
 * con yields asíncronos entre lectura y actualización condicional para probar carreras reales,
 * y rollback transaccional ante fallo intermedio.
 */
class ReservaVacunacionSimulador {
  vacunas = new Map<string, VacunaRow>()
  lotes = new Map<string, LoteRow>()
  turnos = new Map<string, TurnoRow>()
  pacientes = new Set<string>(['pac_1', 'pac_2', 'pac_3'])
  movimientos: MovimientoRow[] = []

  obtenerVacunasConTurnosDisponibles(hoyRef: Date = new Date('2026-11-22T12:00:00.000Z')) {
    const hoy = new Date(hoyRef)
    hoy.setUTCHours(0, 0, 0, 0)

    return Array.from(this.vacunas.values())
      .filter((v) => v.stock > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((v) => {
        const lotesConStock = Array.from(this.lotes.values()).filter(
          (l) => l.idVacuna === v.idVacuna && l.stock > 0
        )
        const turnosDisponibles = Array.from(this.turnos.values())
          .filter((t) => t.idVacuna === v.idVacuna && t.estado === 'DISPONIBLE' && t.fecha >= hoy)
          .sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.hora.localeCompare(b.hora))

        const diasMap = new Map<string, { fecha: string; slots: { idTurnoVacunacion: string; hora: string }[] }>()
        for (const t of turnosDisponibles) {
          const tieneLoteVigente = lotesConStock.some(
            (lote) => lote.vencimiento === null || lote.vencimiento >= t.fecha
          )
          if (!tieneLoteVigente) continue

          const fechaStr = t.fecha.toISOString().slice(0, 10)
          if (!diasMap.has(fechaStr)) diasMap.set(fechaStr, { fecha: fechaStr, slots: [] })
          diasMap.get(fechaStr)!.slots.push({ idTurnoVacunacion: t.idTurnoVacunacion, hora: t.hora })
        }

        return { idVacuna: v.idVacuna, nombre: v.nombre, stock: v.stock, dias: Array.from(diasMap.values()) }
      })
      .filter((v) => v.dias.length > 0)
  }

  async reservarTurnoPaciente(
    idTurnoVacunacion: string,
    idPaciente: string,
    idempotencyKey?: string
  ) {
    // Validación real de producción
    const validacion = validarAsignarTurno({ idPaciente, idempotencyKey })
    if (!validacion.ok || !validacion.datos) {
      throw errorConEstado(validacion.error || 'Datos inválidos', 400)
    }

    const clave = validacion.datos.idempotencyKey

    // 1. Idempotencia
    if (clave) {
      const yaAsignado = this.turnos.get(idTurnoVacunacion)
      if (
        yaAsignado &&
        yaAsignado.idPaciente === validacion.datos.idPaciente &&
        yaAsignado.idempotencyKey === clave &&
        yaAsignado.estado === 'CONFIRMADO'
      ) {
        return { turno: { ...yaAsignado }, idempotent: true }
      }
    }

    // 2. Lectura previa (yield asíncrono para simular concurrencia real entre peticiones)
    const turnoLeido = this.turnos.get(idTurnoVacunacion)
    if (!turnoLeido) throw errorConEstado('El turno de vacunación solicitado no existe.', 404)
    if (turnoLeido.estado !== 'DISPONIBLE') {
      throw errorConEstado('El turno ya no está disponible para asignación.', 409, 'TURN_NOT_AVAILABLE')
    }
    if (!this.pacientes.has(validacion.datos.idPaciente)) {
      throw errorConEstado('El paciente especificado no existe.', 404)
    }

    // Punto de intercalado concurrente (simula latencia de red/DB antes del UPDATE condicional)
    await Promise.resolve()

    // 3. Sección atómica con rollback ante cualquier error intermedio
    const vacuna = this.vacunas.get(turnoLeido.idVacuna)
    if (!vacuna || vacuna.stock < 1) {
      throw errorConEstado('Stock insuficiente para la vacuna seleccionada.', 409, 'INSUFFICIENT_STOCK')
    }

    // Decremento condicional de vacuna
    vacuna.stock -= 1
    let loteDescontado: LoteRow | null = null

    try {
      // Selección automática FEFO (lote que vence primero; vencimiento null al final)
      const lotesElegibles = Array.from(this.lotes.values())
        .filter(
          (l) =>
            l.idVacuna === vacuna.idVacuna &&
            l.stock > 0 &&
            (l.vencimiento === null || l.vencimiento >= turnoLeido.fecha)
        )
        .sort((a, b) => {
          if (a.vencimiento && b.vencimiento) {
            return a.vencimiento.getTime() - b.vencimiento.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
          }
          if (a.vencimiento) return -1
          if (b.vencimiento) return 1
          return a.createdAt.getTime() - b.createdAt.getTime()
        })

      for (const lote of lotesElegibles) {
        if (lote.stock >= 1) {
          lote.stock -= 1
          loteDescontado = lote
          break
        }
      }

      if (!loteDescontado) {
        throw errorConEstado(
          'No hay dosis disponibles en lotes vigentes para la fecha seleccionada.',
          409,
          'NO_ELIGIBLE_BATCH'
        )
      }

      // Actualización condicional atómica del turno
      const turnoActual = this.turnos.get(idTurnoVacunacion)!
      if (turnoActual.estado !== 'DISPONIBLE' || turnoActual.idPaciente !== null) {
        throw errorConEstado(
          'El turno de vacunación fue tomado concurrentemente por otra solicitud.',
          409,
          'TURN_CONCURRENTLY_RESERVED'
        )
      }

      turnoActual.idPaciente = validacion.datos.idPaciente
      turnoActual.idLote = loteDescontado.idLote
      turnoActual.estado = 'CONFIRMADO'
      if (clave) turnoActual.idempotencyKey = clave

      this.movimientos.push({
        idVacuna: vacuna.idVacuna,
        idLote: loteDescontado.idLote,
        tipoMovimiento: 'CONSUMO',
        cantidad: -1,
        stockAnterior: vacuna.stock + 1,
        stockNuevo: vacuna.stock,
        idempotencyKey: clave ? `asig_${clave}` : null,
      })

      return { turno: { ...turnoActual }, stockRestante: vacuna.stock, idempotent: false }
    } catch (error) {
      // Rollback atómico (simula la transacción de PostgreSQL)
      vacuna.stock += 1
      if (loteDescontado) loteDescontado.stock += 1
      throw error
    }
  }
}

function crearEscenarioBase() {
  const sim = new ReservaVacunacionSimulador()
  sim.vacunas.set('vac_gripe', { idVacuna: 'vac_gripe', nombre: 'Antigripal', stock: 3 })
  sim.lotes.set('lote_tardio', {
    idLote: 'lote_tardio',
    idVacuna: 'vac_gripe',
    numeroLote: 'L-2027',
    stock: 2,
    vencimiento: new Date('2027-06-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  })
  sim.lotes.set('lote_proximo', {
    idLote: 'lote_proximo',
    idVacuna: 'vac_gripe',
    numeroLote: 'L-2026-DEC',
    stock: 1,
    vencimiento: new Date('2026-12-31T00:00:00.000Z'),
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
  })
  sim.turnos.set('t_1', {
    idTurnoVacunacion: 't_1',
    idEnfermero: 'enf_1',
    idVacuna: 'vac_gripe',
    idPaciente: null,
    idLote: null,
    fecha: new Date('2026-12-10T00:00:00.000Z'),
    hora: '09:00',
    estado: 'DISPONIBLE',
    idempotencyKey: null,
  })
  sim.turnos.set('t_2', {
    idTurnoVacunacion: 't_2',
    idEnfermero: 'enf_1',
    idVacuna: 'vac_gripe',
    idPaciente: null,
    idLote: null,
    fecha: new Date('2026-12-10T00:00:00.000Z'),
    hora: '09:15',
    estado: 'DISPONIBLE',
    idempotencyKey: null,
  })
  return sim
}

async function runAllTests() {
  console.log('\n=== US-36: PRUEBAS DE RESERVA DE TURNO DE VACUNACIÓN ===\n')

  await test('Esc.1: Validación real (validarAsignarTurno) exige idPaciente válido y recorta espacios', () => {
    assert.equal(validarAsignarTurno(null).ok, false)
    assert.equal(validarAsignarTurno({ idPaciente: '   ' }).ok, false)
    const ok = validarAsignarTurno({ idPaciente: '  pac_1  ', idempotencyKey: ' key-123 ' })
    assert.equal(ok.ok, true)
    assert.equal(ok.datos?.idPaciente, 'pac_1')
    assert.equal(ok.datos?.idempotencyKey, 'key-123')
  })

  await test('Esc.2: Disponibilidad muestra solo vacunas con stock > 0, turnos futuros DISPONIBLE y lote vigente', () => {
    const sim = crearEscenarioBase()
    // Vacuna con stock 0 no debe aparecer
    sim.vacunas.set('vac_sin_stock', { idVacuna: 'vac_sin_stock', nombre: 'Sin Stock', stock: 0 })
    sim.turnos.set('t_sin_stock', {
      idTurnoVacunacion: 't_sin_stock',
      idEnfermero: 'enf_1',
      idVacuna: 'vac_sin_stock',
      idPaciente: null,
      idLote: null,
      fecha: new Date('2026-12-10T00:00:00.000Z'),
      hora: '10:00',
      estado: 'DISPONIBLE',
      idempotencyKey: null,
    })
    // Turno con fecha posterior al vencimiento de todos los lotes de una vacuna -> excluido
    sim.vacunas.set('vac_vencida', { idVacuna: 'vac_vencida', nombre: 'Vencida', stock: 5 })
    sim.lotes.set('lote_vencido', {
      idLote: 'lote_vencido',
      idVacuna: 'vac_vencida',
      numeroLote: 'OLD-1',
      stock: 5,
      vencimiento: new Date('2026-12-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    sim.turnos.set('t_post_venc', {
      idTurnoVacunacion: 't_post_venc',
      idEnfermero: 'enf_1',
      idVacuna: 'vac_vencida',
      idPaciente: null,
      idLote: null,
      fecha: new Date('2026-12-15T00:00:00.000Z'),
      hora: '10:00',
      estado: 'DISPONIBLE',
      idempotencyKey: null,
    })

    const disponibles = sim.obtenerVacunasConTurnosDisponibles()
    assert.equal(disponibles.length, 1)
    assert.equal(disponibles[0].idVacuna, 'vac_gripe')
    assert.equal(disponibles[0].dias[0].slots.length, 2)
  })

  await test('Esc.3: Reserva exitosa descuenta stock de vacuna, consume lote que vence primero (FEFO) y audita CONSUMO', async () => {
    const sim = crearEscenarioBase()

    const r1 = await sim.reservarTurnoPaciente('t_1', 'pac_1', 'key_1')
    assert.equal(r1.idempotent, false)
    assert.equal(r1.turno.estado, 'CONFIRMADO')
    assert.equal(r1.turno.idPaciente, 'pac_1')
    assert.equal(r1.turno.idLote, 'lote_proximo', 'Debe consumir primero el lote más próximo a vencer')
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 2)
    assert.equal(sim.lotes.get('lote_proximo')?.stock, 0)
    assert.equal(sim.lotes.get('lote_tardio')?.stock, 2)
    assert.equal(sim.movimientos.length, 1)
    assert.equal(sim.movimientos[0].tipoMovimiento, 'CONSUMO')
    assert.equal(sim.movimientos[0].cantidad, -1)

    // Al agotarse lote_proximo, el segundo turno toma lote_tardio
    const r2 = await sim.reservarTurnoPaciente('t_2', 'pac_2', 'key_2')
    assert.equal(r2.turno.idLote, 'lote_tardio')
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 1)
    assert.equal(sim.lotes.get('lote_tardio')?.stock, 1)
  })

  await test('Esc.4: Rechaza con 409 (INSUFFICIENT_STOCK) si stock es 0 y deja el turno DISPONIBLE', async () => {
    const sim = crearEscenarioBase()
    sim.vacunas.get('vac_gripe')!.stock = 0

    await assert.rejects(
      () => sim.reservarTurnoPaciente('t_1', 'pac_1'),
      (err: any) => err.statusCode === 409 && err.code === 'INSUFFICIENT_STOCK'
    )
    assert.equal(sim.turnos.get('t_1')?.estado, 'DISPONIBLE')
    assert.equal(sim.movimientos.length, 0)
  })

  await test('Esc.5: Rechaza con 409 (TURN_NOT_AVAILABLE) si el turno ya está ocupado', async () => {
    const sim = crearEscenarioBase()
    await sim.reservarTurnoPaciente('t_1', 'pac_1')

    await assert.rejects(
      () => sim.reservarTurnoPaciente('t_1', 'pac_2'),
      (err: any) => err.statusCode === 409 && err.code === 'TURN_NOT_AVAILABLE'
    )
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 2, 'No debe descontar stock ante turno ocupado')
  })

  await test('Esc.6: Concurrencia por el MISMO turno: exactamente 1 gana y el otro recibe 409 con rollback limpio', async () => {
    const sim = crearEscenarioBase()

    const resultados = await Promise.allSettled([
      sim.reservarTurnoPaciente('t_1', 'pac_1'),
      sim.reservarTurnoPaciente('t_1', 'pac_2'),
    ])

    const exitos = resultados.filter((r) => r.status === 'fulfilled')
    const rechazos = resultados.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]

    assert.equal(exitos.length, 1, 'Solo 1 paciente puede quedarse con el turno')
    assert.equal(rechazos.length, 1)
    assert.equal(rechazos[0].reason.statusCode, 409)
    assert.equal(rechazos[0].reason.code, 'TURN_CONCURRENTLY_RESERVED')
    // El perdedor devolvió el stock en el rollback: stock pasó de 3 a 2 (no a 1)
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 2)
    assert.equal(sim.lotes.get('lote_proximo')?.stock, 0)
    assert.equal(sim.lotes.get('lote_tardio')?.stock, 2)
    assert.equal(sim.movimientos.length, 1)
  })

  await test('Esc.7: Concurrencia por la ÚLTIMA dosis (stock = 1) en 2 turnos distintos: 1 gana, 1 recibe 409, nunca stock negativo', async () => {
    const sim = crearEscenarioBase()
    sim.vacunas.get('vac_gripe')!.stock = 1
    sim.lotes.get('lote_tardio')!.stock = 0
    sim.lotes.get('lote_proximo')!.stock = 1

    const resultados = await Promise.allSettled([
      sim.reservarTurnoPaciente('t_1', 'pac_1'),
      sim.reservarTurnoPaciente('t_2', 'pac_2'),
    ])

    const exitos = resultados.filter((r) => r.status === 'fulfilled')
    const rechazos = resultados.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]

    assert.equal(exitos.length, 1)
    assert.equal(rechazos.length, 1)
    assert.equal(rechazos[0].reason.statusCode, 409)
    assert.equal(rechazos[0].reason.code, 'INSUFFICIENT_STOCK')
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 0, 'Stock nunca debe quedar negativo')
    assert.equal(sim.lotes.get('lote_proximo')?.stock, 0)
    assert.equal(sim.movimientos.length, 1)
  })

  await test('Esc.8: Rollback atómico si la vacuna tiene stock pero no hay lotes vigentes (NO_ELIGIBLE_BATCH)', async () => {
    const sim = crearEscenarioBase()
    sim.lotes.clear() // Simula vacuna sin lotes o con todos vencidos

    await assert.rejects(
      () => sim.reservarTurnoPaciente('t_1', 'pac_1'),
      (err: any) => err.statusCode === 409 && err.code === 'NO_ELIGIBLE_BATCH'
    )
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 3, 'El rollback debe restaurar el stock de vacuna')
    assert.equal(sim.turnos.get('t_1')?.estado, 'DISPONIBLE')
  })

  await test('Esc.9: Idempotencia con misma idempotencyKey no descuenta stock dos veces', async () => {
    const sim = crearEscenarioBase()

    const primero = await sim.reservarTurnoPaciente('t_1', 'pac_1', 'idem_abc')
    const segundo = await sim.reservarTurnoPaciente('t_1', 'pac_1', 'idem_abc')

    assert.equal(primero.idempotent, false)
    assert.equal(segundo.idempotent, true)
    assert.equal(sim.vacunas.get('vac_gripe')?.stock, 2)
    assert.equal(sim.movimientos.length, 1)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-36 PASARON EXITOSAMENTE (9/9) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-36:', err)
  process.exit(1)
})