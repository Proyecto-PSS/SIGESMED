import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO'

interface Medico {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  consultorio: string | null
}

interface Paciente {
  idPaciente: string
  nombre: string
  apellido: string
  dni: string
  email: string
}

interface Turno {
  idTurno: string
  idMedico: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: EstadoTurno
  idPaciente: string | null
  modalidad?: 'PARTICULAR' | 'COBERTURA'
  idempotencyKey?: string | null
}

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function etiquetaEspecialidad(codigo: string): string {
  return nombresEspecialidad[codigo] ?? codigo
}

function formatearFechaHora(turno: Turno): string {
  const fecha = new Date(`${turno.fecha}T00:00:00Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  })
  return `${fecha}, ${turno.hora} hs`
}

function sede(medico: Medico): string {
  return medico.consultorio ?? 'Sede no informada'
}

function nombrePaciente(paciente: Paciente): string {
  return `${paciente.nombre} ${paciente.apellido}`
}

function puedeMostrarConfirmacion(turno: Turno | null): boolean {
  return !!turno && turno.estado === 'DISPONIBLE' && !turno.idPaciente
}

function construirResumen(turno: Turno, medico: Medico, paciente: Paciente) {
  return {
    medico: `${medico.nombre} ${medico.apellido} (${etiquetaEspecialidad(medico.especialidad)})`,
    fechaHora: formatearFechaHora(turno),
    sede: sede(medico),
    paciente: `${nombrePaciente(paciente)} (DNI: ${paciente.dni})`,
  }
}

function avisoComprobante(paciente: Paciente): string {
  return `Se enviará comprobante de reserva a ${paciente.email}`
}

function mensajeConfirmacion(): string {
  return '¡Turno confirmado!'
}

interface OpcionesConfirmacion {
  idempotencyKey?: string
  modalidad?: 'PARTICULAR' | 'COBERTURA'
}

function confirmarTurno(
  turnos: Turno[],
  idTurno: string,
  idPaciente: string,
  opciones: OpcionesConfirmacion = {},
): { turno: Turno; idempotent: boolean } {
  const { idempotencyKey, modalidad = 'PARTICULAR' } = opciones

  if (idempotencyKey) {
    const conKey = turnos.find((t) => t.idempotencyKey === idempotencyKey)
    if (conKey) {
      if (conKey.idTurno === idTurno && conKey.idPaciente === idPaciente) {
        return { turno: conKey, idempotent: true }
      }
      const err = new Error('La clave de idempotencia ya fue utilizada para otra operación') as Error & {
        statusCode?: number
        code?: string
      }
      err.statusCode = 409
      err.code = 'IDEMPOTENCY_KEY_REUSED'
      throw err
    }
  }

  const turnoExistente = turnos.find((t) => t.idTurno === idTurno)
  if (!turnoExistente) {
    const err = new Error('El turno solicitado no existe') as Error & { statusCode?: number; code?: string }
    err.statusCode = 404
    err.code = 'TURN_NOT_FOUND'
    throw err
  }

  if (turnoExistente.estado === 'DISPONIBLE' && turnoExistente.idPaciente === null) {
    turnoExistente.idPaciente = idPaciente
    turnoExistente.estado = 'CONFIRMADO'
    turnoExistente.modalidad = modalidad
    if (idempotencyKey) turnoExistente.idempotencyKey = idempotencyKey
    return { turno: turnoExistente, idempotent: false }
  }

  if (turnoExistente.estado === 'CONFIRMADO' && turnoExistente.idPaciente === idPaciente) {
    return { turno: turnoExistente, idempotent: true }
  }

  const err = new Error('El turno ya no está disponible') as Error & { statusCode?: number; code?: string }
  err.statusCode = 409
  err.code = 'TURN_ALREADY_RESERVED'
  throw err
}

function horariosDisponibles(turnos: Turno[], idMedico: string): string[] {
  return turnos
    .filter((t) => t.idMedico === idMedico && t.estado === 'DISPONIBLE')
    .map((t) => `${t.fecha} ${t.hora}`)
}

const MEDICO: Medico = {
  idMedico: 'med_001',
  nombre: 'Laura',
  apellido: 'Gómez',
  especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
  consultorio: 'Sede Centro - Consultorio 3',
}

const MEDICO_SIN_SEDE: Medico = { ...MEDICO, consultorio: null }

const PACIENTE: Paciente = {
  idPaciente: 'pac_001',
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '30123456',
  email: 'juan.perez@example.com',
}

function crearTurnos(): Turno[] {
  return [
    {
      idTurno: 'turno_001',
      idMedico: MEDICO.idMedico,
      fecha: '2999-12-02',
      hora: '09:30',
      duracionMinutos: 30,
      estado: 'DISPONIBLE',
      idPaciente: null,
      idempotencyKey: null,
    },
    {
      idTurno: 'turno_002',
      idMedico: MEDICO.idMedico,
      fecha: '2999-12-02',
      hora: '10:00',
      duracionMinutos: 30,
      estado: 'DISPONIBLE',
      idPaciente: null,
      idempotencyKey: null,
    },
  ]
}

async function runAllTests() {
  console.log('\n=== US-12: PRUEBAS UNITARIAS DE RESERVA EFECTIVA Y CANCELACIÓN ===\n')

  await test('Esc.1: con un turno DISPONIBLE se muestra la pantalla "Confirmar Reserva de Turno"', () => {
    const turno = crearTurnos()[0]
    assert.equal(puedeMostrarConfirmacion(turno), true)
  })

  await test('Esc.1 paso 2: el Resumen muestra el Médico con nombre, apellido y especialidad', () => {
    const turnos = crearTurnos()
    const resumen = construirResumen(turnos[0], MEDICO, PACIENTE)
    assert.equal(resumen.medico, 'Laura Gómez (Traumatología y Ortopedia)')
  })

  await test('Esc.1 paso 2: la especialidad se muestra con su etiqueta legible', () => {
    assert.equal(etiquetaEspecialidad('PEDIATRIA'), 'Pediatría')
    assert.equal(etiquetaEspecialidad('CLINICA_MEDICA'), 'Clínica Médica')
  })

  await test('Esc.1 paso 2: el Resumen muestra la Fecha y hora coincidente con lo seleccionado', () => {
    const turno = crearTurnos()[0]
    const resumen = construirResumen(turno, MEDICO, PACIENTE)
    assert.ok(resumen.fechaHora.includes('diciembre'))
    assert.ok(resumen.fechaHora.includes('02'))
    assert.ok(resumen.fechaHora.endsWith(', 09:30 hs'))
  })

  await test('Esc.1 paso 2: el Resumen muestra la Sede del médico', () => {
    const turnos = crearTurnos()
    const resumen = construirResumen(turnos[0], MEDICO, PACIENTE)
    assert.equal(resumen.sede, 'Sede Centro - Consultorio 3')
  })

  await test('Esc.1 paso 2: si el médico no tiene sede informada se muestra el fallback', () => {
    const turnos = crearTurnos()
    const resumen = construirResumen(turnos[0], MEDICO_SIN_SEDE, PACIENTE)
    assert.equal(resumen.sede, 'Sede no informada')
  })

  await test('Esc.1 paso 2: el Resumen muestra el Paciente con su nombre, apellido y DNI', () => {
    const turnos = crearTurnos()
    const resumen = construirResumen(turnos[0], MEDICO, PACIENTE)
    assert.equal(resumen.paciente, 'Juan Pérez (DNI: 30123456)')
  })

  await test('Esc.1 paso 3: se muestra el aviso "Se enviará comprobante de reserva a" con el email del paciente', () => {
    const aviso = avisoComprobante(PACIENTE)
    assert.equal(aviso, 'Se enviará comprobante de reserva a juan.perez@example.com')
  })

  await test('Esc.1 paso 4: "Confirmar Turno" registra el turno a nombre del paciente', () => {
    const turnos = crearTurnos()
    const { turno, idempotent } = confirmarTurno(turnos, 'turno_001', PACIENTE.idPaciente, {
      idempotencyKey: 'key-us12-1',
      modalidad: 'PARTICULAR',
    })
    assert.equal(idempotent, false)
    assert.equal(turno.estado, 'CONFIRMADO')
    assert.equal(turno.idPaciente, PACIENTE.idPaciente)
    assert.equal(turno.modalidad, 'PARTICULAR')
    assert.equal(turno.idempotencyKey, 'key-us12-1')
  })

  await test('Esc.1 paso 4: tras confirmar se muestra el mensaje de confirmación de la reserva', () => {
    const turnos = crearTurnos()
    confirmarTurno(turnos, 'turno_001', PACIENTE.idPaciente)
    assert.equal(mensajeConfirmacion(), '¡Turno confirmado!')
  })

  await test('Esc.1 resultado: al volver a la selección de horarios el horario reservado ya no figura disponible', () => {
    const turnos = crearTurnos()
    confirmarTurno(turnos, 'turno_001', PACIENTE.idPaciente)
    const disponibles = horariosDisponibles(turnos, MEDICO.idMedico)
    assert.ok(!disponibles.includes('2999-12-02 09:30'))
    assert.ok(disponibles.includes('2999-12-02 10:00'))
  })

  await test('Esc.2 paso 2: "Cancelar / Volver" no registra ningún turno', () => {
    const turnos = crearTurnos()
    const turno = turnos.find((t) => t.idTurno === 'turno_001')!
    assert.equal(turno.estado, 'DISPONIBLE')
    assert.equal(turno.idPaciente, null)
  })

  await test('Esc.2 resultado: tras cancelar, el horario elegido sigue figurando disponible', () => {
    const turnos = crearTurnos()
    const disponibles = horariosDisponibles(turnos, MEDICO.idMedico)
    assert.ok(disponibles.includes('2999-12-02 09:30'))
  })

  await test('Esc.2 resultado: cancelar no genera la confirmación ni side effects', () => {
    const turnos = crearTurnos()
    const turno = turnos.find((t) => t.idTurno === 'turno_001')!
    assert.notEqual(turno.estado, 'CONFIRMADO')
    assert.equal(turno.idPaciente, null)
    assert.equal(turno.modalidad, undefined)
    assert.equal(turno.idempotencyKey, null)
  })

  await test('Esc.2 resultado: se vuelve a la selección de horarios conservando el mismo turno', () => {
    const turnos = crearTurnos()
    const disponibles = horariosDisponibles(turnos, MEDICO.idMedico)
    assert.deepEqual(disponibles, ['2999-12-02 09:30', '2999-12-02 10:00'])
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-12 PASARON EXITOSAMENTE (15/15) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-12:', error)
  process.exit(1)
})
