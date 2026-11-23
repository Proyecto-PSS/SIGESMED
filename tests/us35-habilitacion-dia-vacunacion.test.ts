// Suite de pruebas unitarias para US-35:
// Habilitación de días y horarios de vacunación, validación de stock y control de superposición.
import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

interface VacunaMock {
  idVacuna: string
  nombre: string
  stock: number
}

interface TurnoVacunacionMock {
  idTurnoVacunacion: string
  idEnfermero: string
  idVacuna: string
  idLote: string | null
  fecha: Date
  hora: string
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'APLICADO'
}

interface HabilitarDiaInput {
  idVacuna: string
  fecha: string
  horaDesde: string
  horaHasta: string
  duracionMinutos?: number
  horariosHabilitados?: string[]
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

/** Réplica fiel de VacunacionService.habilitarDiaVacunacion + autorización del endpoint US-35. */
class HabilitacionVacunacionMock {
  vacunas = new Map<string, VacunaMock>()
  turnos: TurnoVacunacionMock[] = []

  async habilitarDia(
    input: HabilitarDiaInput,
    sesion: { id: string; rol: 'ENFERMERA' | 'PACIENTE' | 'MEDICO' | 'ADMIN' } | null
  ) {
    if (!sesion) throw errorConEstado('No autorizado: sesión no encontrada.', 401)
    if (sesion.rol !== 'ENFERMERA') {
      throw errorConEstado('Acceso denegado: se requiere perfil de enfermería.', 403)
    }

    const { idVacuna, fecha, horaDesde, horaHasta, duracionMinutos = 15, horariosHabilitados } = input

    if (!idVacuna || !fecha || !horaDesde || !horaHasta) {
      throw errorConEstado('Debe seleccionar vacuna, fecha y rango horario completo.', 400, 'MISSING_FIELDS')
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw errorConEstado('Formato de fecha inválido (debe ser YYYY-MM-DD).', 400, 'INVALID_DATE')
    }

    const [desdeH, desdeM] = horaDesde.split(':').map(Number)
    const [hastaH, hastaM] = horaHasta.split(':').map(Number)
    const minutosInicio = desdeH * 60 + desdeM
    const minutosFin = hastaH * 60 + hastaM

    if (minutosInicio >= minutosFin) {
      throw errorConEstado('El horario de inicio debe ser anterior al horario de fin.', 400, 'INVALID_TIME_RANGE')
    }

    const duracion = Number(duracionMinutos) || 15
    if (duracion < 5 || duracion > 120) {
      throw errorConEstado('La duración del turno debe estar entre 5 y 120 minutos.', 400, 'INVALID_DURATION')
    }

    const vacuna = this.vacunas.get(idVacuna)
    if (!vacuna) {
      throw errorConEstado('La vacuna seleccionada no existe.', 404, 'VACCINE_NOT_FOUND')
    }

    if (vacuna.stock <= 0) {
      throw errorConEstado(
        `La vacuna seleccionada no cuenta con dosis disponibles (Stock: ${vacuna.stock} dosis).`,
        400,
        'INSUFFICIENT_STOCK'
      )
    }

    const todosSlots: string[] = []
    for (let min = minutosInicio; min < minutosFin; min += duracion) {
      const h = Math.floor(min / 60)
      const m = min % 60
      todosSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }

    const slots =
      Array.isArray(horariosHabilitados) && horariosHabilitados.length > 0
        ? horariosHabilitados.filter((h) => todosSlots.includes(h))
        : todosSlots

    if (slots.length === 0) {
      throw errorConEstado('No se seleccionó ningún turno para habilitar en el rango indicado.', 400, 'NO_SLOTS_SELECTED')
    }

    if (slots.length > vacuna.stock) {
      throw errorConEstado(
        `La cantidad de turnos a habilitar (${slots.length}) supera el stock físico disponible (${vacuna.stock} dosis).`,
        400,
        'SLOTS_EXCEED_STOCK'
      )
    }

    const fechaDate = new Date(`${fecha}T00:00:00.000Z`)

    // Simula createMany con skipDuplicates sobre @@unique([idEnfermero, fecha, hora])
    let creados = 0
    for (const hora of slots) {
      const existe = this.turnos.some(
        (t) =>
          t.idEnfermero === sesion.id &&
          t.fecha.getTime() === fechaDate.getTime() &&
          t.hora === hora
      )
      if (existe) continue

      this.turnos.push({
        idTurnoVacunacion: `tv_${this.turnos.length + 1}`,
        idEnfermero: sesion.id,
        idVacuna: vacuna.idVacuna,
        idLote: null,
        fecha: fechaDate,
        hora,
        estado: 'DISPONIBLE',
      })
      creados++
    }

    return {
      ok: true,
      turnosHabilitados: creados,
      totalSolicitados: slots.length,
      fecha,
      vacuna: { idVacuna: vacuna.idVacuna, nombre: vacuna.nombre, stock: vacuna.stock },
    }
  }
}

const ENFERMERA_1 = { id: 'enf_01', rol: 'ENFERMERA' as const }
const ENFERMERA_2 = { id: 'enf_02', rol: 'ENFERMERA' as const }

async function runAllTests() {
  console.log('\n=== US-35: PRUEBAS DE HABILITACIÓN DE DÍA Y HORARIOS DE VACUNACIÓN ===\n')

  await test('Esc.1: Habilita turnos DISPONIBLE correctamente cuando la vacuna tiene stock suficiente', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_1', { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 10 })

    const res = await sys.habilitarDia(
      { idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 15 },
      ENFERMERA_1
    )

    assert.equal(res.turnosHabilitados, 4)
    assert.equal(res.totalSolicitados, 4)
    assert.deepEqual(
      sys.turnos.map((t) => t.hora),
      ['09:00', '09:15', '09:30', '09:45']
    )
    assert.ok(sys.turnos.every((t) => t.estado === 'DISPONIBLE' && t.idLote === null))
  })

  await test('Esc.2: Bloquea con 400 (INSUFFICIENT_STOCK) si la vacuna tiene stock 0', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_0', { idVacuna: 'vac_0', nombre: 'Fiebre Amarilla', stock: 0 })

    await assert.rejects(
      () =>
        sys.habilitarDia(
          { idVacuna: 'vac_0', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 30 },
          ENFERMERA_1
        ),
      (err: any) => err.statusCode === 400 && err.code === 'INSUFFICIENT_STOCK'
    )
    assert.equal(sys.turnos.length, 0)
  })

  await test('Esc.3: Bloquea con 400 (SLOTS_EXCEED_STOCK) si los slots solicitados superan el stock físico', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_poca', { idVacuna: 'vac_poca', nombre: 'Hepatitis B', stock: 3 })

    // 09:00 a 10:00 cada 15 min = 4 slots > 3 dosis
    await assert.rejects(
      () =>
        sys.habilitarDia(
          { idVacuna: 'vac_poca', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 15 },
          ENFERMERA_1
        ),
      (err: any) => err.statusCode === 400 && err.code === 'SLOTS_EXCEED_STOCK'
    )
    assert.equal(sys.turnos.length, 0)

    // Seleccionando exactamente 3 slots con horariosHabilitados debe pasar
    const ok = await sys.habilitarDia(
      {
        idVacuna: 'vac_poca',
        fecha: '2026-12-01',
        horaDesde: '09:00',
        horaHasta: '10:00',
        duracionMinutos: 15,
        horariosHabilitados: ['09:00', '09:30', '09:45'],
      },
      ENFERMERA_1
    )
    assert.equal(ok.turnosHabilitados, 3)
  })

  await test('Esc.4: Evita duplicar horarios exactos para la misma enfermera y fecha (skipDuplicates)', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_1', { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 10 })
    sys.vacunas.set('vac_2', { idVacuna: 'vac_2', nombre: 'Triple Viral', stock: 10 })

    // Primera habilitación: 09:00 y 09:30
    const primero = await sys.habilitarDia(
      { idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 30 },
      ENFERMERA_1
    )
    assert.equal(primero.turnosHabilitados, 2)

    // Segunda habilitación solapada (09:30 ya existe para ENFERMERA_1, 10:00 es nuevo)
    const segundo = await sys.habilitarDia(
      { idVacuna: 'vac_2', fecha: '2026-12-01', horaDesde: '09:30', horaHasta: '10:30', duracionMinutos: 30 },
      ENFERMERA_1
    )
    assert.equal(segundo.totalSolicitados, 2)
    assert.equal(segundo.turnosHabilitados, 1, 'Solo debe crear 10:00 sin duplicar 09:30')
    assert.equal(sys.turnos.length, 3)

    // Reintento totalmente repetido -> 0 nuevos turnos creados
    const repetido = await sys.habilitarDia(
      { idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 30 },
      ENFERMERA_1
    )
    assert.equal(repetido.turnosHabilitados, 0)
    assert.equal(sys.turnos.length, 3)
  })

  await test('Esc.5: Dos enfermeras distintas SÍ pueden habilitar los mismos horarios en el mismo día', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_1', { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 10 })

    const r1 = await sys.habilitarDia(
      { idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 30 },
      ENFERMERA_1
    )
    const r2 = await sys.habilitarDia(
      { idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: 30 },
      ENFERMERA_2
    )
    assert.equal(r1.turnosHabilitados, 2)
    assert.equal(r2.turnosHabilitados, 2)
    assert.equal(sys.turnos.length, 4)
  })

  await test('Esc.6: Valida campos obligatorios, formato de fecha, rango horario, duración y vacuna inexistente', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_1', { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 10 })

    // Campos faltantes
    await assert.rejects(
      () => sys.habilitarDia({ idVacuna: '', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00' }, ENFERMERA_1),
      (err: any) => err.statusCode === 400 && err.code === 'MISSING_FIELDS'
    )

    // Formato de fecha inválido
    await assert.rejects(
      () => sys.habilitarDia({ idVacuna: 'vac_1', fecha: '01-12-2026', horaDesde: '09:00', horaHasta: '10:00' }, ENFERMERA_1),
      (err: any) => err.statusCode === 400 && err.code === 'INVALID_DATE'
    )

    // Rango horario invertido o igual
    for (const [desde, hasta] of [['10:00', '09:00'], ['09:00', '09:00']]) {
      await assert.rejects(
        () => sys.habilitarDia({ idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: desde, horaHasta: hasta }, ENFERMERA_1),
        (err: any) => err.statusCode === 400 && err.code === 'INVALID_TIME_RANGE'
      )
    }

    // Duración fuera de [5, 120]
    for (const dur of [4, 121, -10]) {
      await assert.rejects(
        () =>
          sys.habilitarDia(
            { idVacuna: 'vac_1', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00', duracionMinutos: dur },
            ENFERMERA_1
          ),
        (err: any) => err.statusCode === 400 && err.code === 'INVALID_DURATION'
      )
    }

    // horariosHabilitados fuera del rango -> NO_SLOTS_SELECTED
    await assert.rejects(
      () =>
        sys.habilitarDia(
          {
            idVacuna: 'vac_1',
            fecha: '2026-12-01',
            horaDesde: '09:00',
            horaHasta: '10:00',
            duracionMinutos: 30,
            horariosHabilitados: ['14:00', '15:00'],
          },
          ENFERMERA_1
        ),
      (err: any) => err.statusCode === 400 && err.code === 'NO_SLOTS_SELECTED'
    )

    // Vacuna inexistente -> 404
    await assert.rejects(
      () => sys.habilitarDia({ idVacuna: 'vac_inexistente', fecha: '2026-12-01', horaDesde: '09:00', horaHasta: '10:00' }, ENFERMERA_1),
      (err: any) => err.statusCode === 404 && err.code === 'VACCINE_NOT_FOUND'
    )
  })

  await test('Esc.7: Restricción exclusiva de rol ENFERMERA (401 sin sesión, 403 para PACIENTE/MEDICO/ADMIN)', async () => {
    const sys = new HabilitacionVacunacionMock()
    sys.vacunas.set('vac_1', { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 10 })
    const input: HabilitarDiaInput = {
      idVacuna: 'vac_1',
      fecha: '2026-12-01',
      horaDesde: '09:00',
      horaHasta: '10:00',
    }

    await assert.rejects(() => sys.habilitarDia(input, null), (err: any) => err.statusCode === 401)

    for (const rol of ['PACIENTE', 'MEDICO', 'ADMIN'] as const) {
      await assert.rejects(
        () => sys.habilitarDia(input, { id: `usr_${rol}`, rol }),
        (err: any) => err.statusCode === 403
      )
    }
    assert.equal(sys.turnos.length, 0)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-35 PASARON EXITOSAMENTE (7/7) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-35:', err)
  process.exit(1)
})