// Suite de pruebas unitarias para US-37:
// Cancelación de turno de vacunación por el paciente: incremento atómico de stock (+1),
// liberación de horario futuro vs vencido, validación de motivo y reintento de cancelación.
import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

function turnoVacunacionSigueVigente(fecha: Date, hora: string, ahoraMs: number = Date.now()): boolean {
  const [anio, mes, dia] = fecha.toISOString().slice(0, 10).split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  // Horario de agenda en Argentina (UTC-3)
  return Date.UTC(anio, mes - 1, dia, horas + 3, minutos) > ahoraMs
}

function validarMotivoCancelacion(body: any): string {
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 3 || motivo.length > 120) {
    throw Object.assign(new Error('Seleccioná un motivo válido para cancelar el turno.'), { statusCode: 400 })
  }
  return motivo
}

interface TurnoCancelable {
  idTurnoVacunacion: string
  idPaciente: string | null
  idEnfermero: string
  idVacuna: string
  idLote: string | null
  fecha: Date
  hora: string
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'APLICADO'
  idempotencyKey: string | null
}

class CancelacionVacunacionSimulador {
  vacunas = new Map<string, { idVacuna: string; nombre: string; stock: number }>()
  lotes = new Map<string, { idLote: string; stock: number }>()
  turnos = new Map<string, TurnoCancelable>()
  cancelaciones: Array<{ idTurnoVacunacion: string; idPaciente: string; motivo: string; nombreVacuna: string }> = []
  movimientos: Array<{ idVacuna: string; idLote: string | null; tipoMovimiento: string; cantidad: number; stockAnterior: number; stockNuevo: number }> = []

  async cancelarTurnoPaciente(
    idTurnoVacunacion: string,
    idPaciente: string,
    body: unknown,
    ahoraMs: number = Date.parse('2026-11-22T15:00:00.000Z')
  ) {
    const motivo = validarMotivoCancelacion(body)

    const turno = this.turnos.get(idTurnoVacunacion)
    if (!turno || turno.idPaciente !== idPaciente || turno.estado !== 'CONFIRMADO') {
      throw Object.assign(new Error('No se encontró un turno confirmado asociado a este paciente.'), {
        statusCode: 404,
      })
    }

    const horarioLiberado = turnoVacunacionSigueVigente(turno.fecha, turno.hora, ahoraMs)

    // Yield asíncrono para simular dos clics concurrentes leyendo el mismo estado CONFIRMADO
    await Promise.resolve()

    // Actualización condicional atómica (updateMany where estado = CONFIRMADO & idPaciente)
    const actual = this.turnos.get(idTurnoVacunacion)!
    if (actual.estado !== 'CONFIRMADO' || actual.idPaciente !== idPaciente) {
      throw Object.assign(new Error('El turno cambió de estado y no se pudo cancelar.'), { statusCode: 409 })
    }

    actual.estado = horarioLiberado ? 'DISPONIBLE' : 'CANCELADO'
    actual.idPaciente = horarioLiberado ? null : idPaciente
    actual.idempotencyKey = null

    const vacuna = this.vacunas.get(actual.idVacuna)!
    this.cancelaciones.push({
      idTurnoVacunacion,
      idPaciente,
      motivo,
      nombreVacuna: vacuna.nombre,
    })

    const stockAnterior = vacuna.stock
    vacuna.stock += 1

    if (actual.idLote) {
      const lote = this.lotes.get(actual.idLote)
      if (lote) lote.stock += 1
    }

    this.movimientos.push({
      idVacuna: actual.idVacuna,
      idLote: actual.idLote,
      tipoMovimiento: 'LIBERACION',
      cantidad: 1,
      stockAnterior,
      stockNuevo: vacuna.stock,
    })

    return { turno: { ...actual }, horarioLiberado }
  }
}

function crearSimuladorCancelacion() {
  const sim = new CancelacionVacunacionSimulador()
  sim.vacunas.set('vac_1', { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 4 })
  sim.lotes.set('lote_1', { idLote: 'lote_1', stock: 2 })
  sim.turnos.set('t_futuro', {
    idTurnoVacunacion: 't_futuro',
    idPaciente: 'pac_1',
    idEnfermero: 'enf_1',
    idVacuna: 'vac_1',
    idLote: 'lote_1',
    fecha: new Date('2026-12-01T00:00:00.000Z'),
    hora: '10:00',
    estado: 'CONFIRMADO',
    idempotencyKey: 'idem_1',
  })
  sim.turnos.set('t_vencido', {
    idTurnoVacunacion: 't_vencido',
    idPaciente: 'pac_1',
    idEnfermero: 'enf_1',
    idVacuna: 'vac_1',
    idLote: 'lote_1',
    fecha: new Date('2026-11-20T00:00:00.000Z'),
    hora: '09:00',
    estado: 'CONFIRMADO',
    idempotencyKey: 'idem_2',
  })
  return sim
}

async function runAllTests() {
  console.log('\n=== US-37: PRUEBAS DE CANCELACIÓN DE TURNO DE VACUNACIÓN ===\n')

  await test('Esc.1: Valida motivo obligatorio entre 3 y 120 caracteres (400 si es inválido)', async () => {
    const sim = crearSimuladorCancelacion()

    for (const bodyInvalido of [null, {}, { motivo: '  ' }, { motivo: 'ab' }, { motivo: 'x'.repeat(121) }]) {
      await assert.rejects(
        () => sim.cancelarTurnoPaciente('t_futuro', 'pac_1', bodyInvalido),
        (err: any) => err.statusCode === 400
      )
    }
    assert.equal(sim.vacunas.get('vac_1')?.stock, 4)
  })

  await test('Esc.2: Cancelar turno futuro libera horario a DISPONIBLE, suma +1 a vacuna y lote y audita LIBERACION', async () => {
    const sim = crearSimuladorCancelacion()

    const res = await sim.cancelarTurnoPaciente('t_futuro', 'pac_1', { motivo: '  No puedo asistir  ' })

    assert.equal(res.horarioLiberado, true)
    assert.equal(res.turno.estado, 'DISPONIBLE')
    assert.equal(res.turno.idPaciente, null)
    assert.equal(res.turno.idempotencyKey, null)
    assert.equal(sim.vacunas.get('vac_1')?.stock, 5)
    assert.equal(sim.lotes.get('lote_1')?.stock, 3)
    assert.equal(sim.cancelaciones.length, 1)
    assert.equal(sim.cancelaciones[0].motivo, 'No puedo asistir')
    assert.equal(sim.movimientos.length, 1)
    assert.equal(sim.movimientos[0].tipoMovimiento, 'LIBERACION')
    assert.equal(sim.movimientos[0].cantidad, 1)
  })

  await test('Esc.3: Cancelar turno cuya fecha/hora ya pasó (UTC-3) lo marca CANCELADO sin reabrir horario', async () => {
    const sim = crearSimuladorCancelacion()

    const res = await sim.cancelarTurnoPaciente('t_vencido', 'pac_1', { motivo: 'Tuve un imprevisto' })

    assert.equal(res.horarioLiberado, false)
    assert.equal(res.turno.estado, 'CANCELADO')
    assert.equal(res.turno.idPaciente, 'pac_1')
    assert.equal(sim.vacunas.get('vac_1')?.stock, 5)
    assert.equal(sim.lotes.get('lote_1')?.stock, 3)
  })

  await test('Esc.4: Reintento secuencial de cancelación devuelve 404 y NO vuelve a sumar stock (+1 una sola vez)', async () => {
    const sim = crearSimuladorCancelacion()

    await sim.cancelarTurnoPaciente('t_futuro', 'pac_1', { motivo: 'Cambio de planes' })
    assert.equal(sim.vacunas.get('vac_1')?.stock, 5)

    await assert.rejects(
      () => sim.cancelarTurnoPaciente('t_futuro', 'pac_1', { motivo: 'Cambio de planes' }),
      (err: any) => err.statusCode === 404
    )
    assert.equal(sim.vacunas.get('vac_1')?.stock, 5, 'El reintento no debe incrementar stock nuevamente')
    assert.equal(sim.lotes.get('lote_1')?.stock, 3)
    assert.equal(sim.movimientos.length, 1)
  })

  await test('Esc.5: Reintento CONCURRENTE (doble clic simultáneo): 1 cancela y el segundo recibe 409 sin duplicar +1', async () => {
    const sim = crearSimuladorCancelacion()

    const resultados = await Promise.allSettled([
      sim.cancelarTurnoPaciente('t_futuro', 'pac_1', { motivo: 'Motivo válido' }),
      sim.cancelarTurnoPaciente('t_futuro', 'pac_1', { motivo: 'Motivo válido' }),
    ])

    const exitos = resultados.filter((r) => r.status === 'fulfilled')
    const rechazos = resultados.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]

    assert.equal(exitos.length, 1)
    assert.equal(rechazos.length, 1)
    assert.equal(rechazos[0].reason.statusCode, 409)
    assert.equal(sim.vacunas.get('vac_1')?.stock, 5, 'Stock debe incrementar exactamente +1')
    assert.equal(sim.lotes.get('lote_1')?.stock, 3)
    assert.equal(sim.cancelaciones.length, 1)
    assert.equal(sim.movimientos.length, 1)
  })

  await test('Esc.6: Seguridad de titularidad impide cancelar turnos de otro paciente (404 sin tocar stock)', async () => {
    const sim = crearSimuladorCancelacion()

    await assert.rejects(
      () => sim.cancelarTurnoPaciente('t_futuro', 'pac_intruso', { motivo: 'Intento ajeno' }),
      (err: any) => err.statusCode === 404
    )
    assert.equal(sim.turnos.get('t_futuro')?.estado, 'CONFIRMADO')
    assert.equal(sim.vacunas.get('vac_1')?.stock, 4)
  })

  await test('Esc.7: No permite cancelar un turno que ya fue APLICADO', async () => {
    const sim = crearSimuladorCancelacion()
    sim.turnos.get('t_futuro')!.estado = 'APLICADO'

    await assert.rejects(
      () => sim.cancelarTurnoPaciente('t_futuro', 'pac_1', { motivo: 'Ya aplicada' }),
      (err: any) => err.statusCode === 404
    )
    assert.equal(sim.vacunas.get('vac_1')?.stock, 4)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-37 PASARON EXITOSAMENTE (7/7) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-37:', err)
  process.exit(1)
})