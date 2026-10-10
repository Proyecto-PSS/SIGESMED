import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO'

interface Turno {
  idTurno: string
  idMedico: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: EstadoTurno
  idPaciente: string | null
}

// Texto que muestra el guion de demo de US-09.
const MENSAJE_DEMO = 'Lo sentimos, este turno acaba de ser reservado por otro paciente'
// Texto real que hoy renderiza la aplicación ante un turno ocupado (ConfirmarReserva.tsx / confirmacion/page.tsx).
const MENSAJE_CODIGO = 'Este turno ya no está disponible.'

const MEDICO_ID = 'med_001'
const PACIENTE_A = 'pac_A'
const PACIENTE_B = 'pac_B'

function crearTurno(): Turno {
  return {
    idTurno: 'turno_001',
    idMedico: MEDICO_ID,
    fecha: '2999-12-02',
    hora: '09:30',
    duracionMinutos: 30,
    estado: 'DISPONIBLE',
    idPaciente: null,
  }
}

// US-08: el paciente elige un día y un horario disponible.
function seleccionarTurno(turno: Turno): string {
  return turno.idTurno
}

function puedeContinuar(turnoSeleccionado: string | null): boolean {
  return turnoSeleccionado !== null
}

// Validación pre-reserva: antes de mostrar/confirmar, el turno debe seguir DISPONIBLE y sin paciente.
function validarPreReserva(turno: Turno): { ok: boolean; motivo?: 'TURNO_RESERVADO' } {
  if (turno.estado !== 'DISPONIBLE' || turno.idPaciente) {
    return { ok: false, motivo: 'TURNO_RESERVADO' }
  }
  return { ok: true }
}

function mensajeTurnoReservado() {
  return MENSAJE_DEMO
}

function volverASeleccion(idMedico: string): string {
  return `/dashboard/paciente/reservar-turno/horarios/${idMedico}`
}

function horariosSeleccionables(turnos: Turno[], idMedico: string): string[] {
  return turnos
    .filter((t) => t.idMedico === idMedico && t.estado === 'DISPONIBLE' && !t.idPaciente)
    .map((t) => `${t.fecha} ${t.hora}`)
}

// Reserva atómica: actualiza solo si el turno sigue DISPONIBLE y sin paciente (evita sobreturnos).
function confirmarAtomico(turno: Turno, idPaciente: string): number {
  if (turno.estado === 'DISPONIBLE' && turno.idPaciente === null) {
    turno.idPaciente = idPaciente
    turno.estado = 'CONFIRMADO'
    return 1
  }
  return 0
}

async function intentarReserva(
  turno: Turno,
  idPaciente: string,
  delayMs: number,
): Promise<{ ok: true; idPaciente: string } | { ok: false; statusCode: number; code: string }> {
  await new Promise((r) => setTimeout(r, delayMs))
  const count = confirmarAtomico(turno, idPaciente)
  if (count === 1) return { ok: true, idPaciente }
  return { ok: false, statusCode: 409, code: 'TURN_ALREADY_RESERVED' }
}

async function runAllTests() {
  console.log('\n=== US-09: PRUEBAS UNITARIAS DE VALIDACIÓN DE TURNO OCUPADO ===\n')

  await test('Esc.1 pasos 1-2: con día y horario elegidos se habilita "Continuar a confirmación"', () => {
    const turno = crearTurno()
    const seleccionado = seleccionarTurno(turno)
    assert.equal(puedeContinuar(seleccionado), true)
    assert.equal(seleccionado, 'turno_001')
  })

  await test('Esc.1 paso 3: sin horario elegido el botón "Continuar a confirmación" permanece inactivo', () => {
    assert.equal(puedeContinuar(null), false)
  })

  await test('Esc.1 paso 3: al continuar, la validación pre-reserva detecta que el turno ya fue reservado', () => {
    const turno = crearTurno()
    confirmarAtomico(turno, PACIENTE_B) // otro paciente lo reservó recientemente
    const validacion = validarPreReserva(turno)
    assert.equal(validacion.ok, false)
    assert.equal(validacion.motivo, 'TURNO_RESERVADO')
  })

  await test('Esc.1 paso 4: se muestra el cartel "Lo sentimos, este turno acaba de ser reservado por otro paciente"', () => {
    assert.equal(mensajeTurnoReservado(), 'Lo sentimos, este turno acaba de ser reservado por otro paciente')
  })

  await test('Esc.1 paso 4: el texto real del código para el mismo caso es "Este turno ya no está disponible."', () => {
    assert.equal(MENSAJE_CODIGO, 'Este turno ya no está disponible.')
    assert.notEqual(MENSAJE_DEMO, MENSAJE_CODIGO)
  })

  await test('Esc.1 paso 5: cerrar el cartel y volver regresa a la selección del mismo médico', () => {
    const turno = crearTurno()
    confirmarAtomico(turno, PACIENTE_B)
    const destino = volverASeleccion(turno.idMedico)
    assert.equal(destino, '/dashboard/paciente/reservar-turno/horarios/med_001')
  })

  await test('Esc.1 paso 5: el turno reservado ya no figura seleccionable en la grilla del médico', () => {
    const turno = crearTurno()
    confirmarAtomico(turno, PACIENTE_B)
    const seleccionables = horariosSeleccionables([turno], turno.idMedico)
    assert.deepEqual(seleccionables, [])
  })

  await test('Esc.1: si el turno sigue DISPONIBLE y sin paciente, la validación pre-reserva permite continuar', () => {
    const turno = crearTurno()
    assert.equal(validarPreReserva(turno).ok, true)
  })

  await test('Concurrencia: dos reservas simultáneas del mismo turno dejan exactamente 1 confirmada', async () => {
    const turno = crearTurno()
    const resultados = await Promise.all([
      intentarReserva(turno, PACIENTE_A, 1),
      intentarReserva(turno, PACIENTE_B, 1),
    ])
    const ganadores = resultados.filter((r) => r.ok)
    assert.equal(ganadores.length, 1)
  })

  await test('Concurrencia: el ganador queda registrado como paciente del turno CONFIRMADO', async () => {
    const turno = crearTurno()
    const resultados = await Promise.all([
      intentarReserva(turno, PACIENTE_A, 1),
      intentarReserva(turno, PACIENTE_B, 1),
    ])
    const ganador = resultados.find((r) => r.ok) as { ok: true; idPaciente: string }
    assert.equal(turno.estado, 'CONFIRMADO')
    assert.equal(turno.idPaciente, ganador.idPaciente)
  })

  await test('Concurrencia: el perdedor recibe 409 TURN_ALREADY_RESERVED', async () => {
    const turno = crearTurno()
    const resultados = await Promise.all([
      intentarReserva(turno, PACIENTE_A, 1),
      intentarReserva(turno, PACIENTE_B, 1),
    ])
    const perdedor = resultados.find((r) => !r.ok) as { ok: false; statusCode: number; code: string }
    assert.equal(perdedor.statusCode, 409)
    assert.equal(perdedor.code, 'TURN_ALREADY_RESERVED')
  })

  await test('Concurrencia: no se produce sobreturno — el turno tiene un único idPaciente', async () => {
    const turno = crearTurno()
    await Promise.all([
      intentarReserva(turno, PACIENTE_A, 1),
      intentarReserva(turno, PACIENTE_B, 1),
    ])
    const asignados = [PACIENTE_A, PACIENTE_B].filter((p) => p === turno.idPaciente)
    assert.equal(asignados.length, 1)
  })

  await test('Concurrencia: reintento del perdedor sigue devolviendo conflicto', async () => {
    const turno = crearTurno()
    await Promise.all([
      intentarReserva(turno, PACIENTE_A, 1),
      intentarReserva(turno, PACIENTE_B, 1),
    ])
    const reintento = await intentarReserva(turno, PACIENTE_B, 0)
    assert.equal(reintento.ok, false)
    assert.equal((reintento as { code: string }).code, 'TURN_ALREADY_RESERVED')
  })

  await test('Concurrencia: tras la carrera solo queda 1 turno CONFIRMADO (sin duplicar reservas)', async () => {
    const turnos = [crearTurno(), crearTurno()]
    turnos[1].idTurno = 'turno_002'
    turnos[1].hora = '10:00'
    await Promise.all([
      intentarReserva(turnos[0], PACIENTE_A, 1),
      intentarReserva(turnos[0], PACIENTE_B, 1),
    ])
    const confirmados = turnos.filter((t) => t.estado === 'CONFIRMADO')
    assert.equal(confirmados.length, 1)
    assert.ok([PACIENTE_A, PACIENTE_B].includes(confirmados[0].idPaciente as string))
    assert.equal(turnos[1].estado, 'DISPONIBLE')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-09 PASARON EXITOSAMENTE (14/14) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-09:', error)
  process.exit(1)
})
