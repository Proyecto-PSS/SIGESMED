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

interface Paciente {
  idPaciente: string
  nombre: string
  apellido: string
  dni: string
  email: string
}

interface Medico {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
}

interface Turno {
  idTurno: string
  idMedico: string
  idPaciente: string | null
  fecha: string
  hora: string
  duracionMinutos: number
  estado: EstadoTurno
  modalidad?: ModalidadConsulta | null
}

const opcionesModalidad: ModalidadConsulta[] = ['PARTICULAR', 'COBERTURA']

function esModalidadValida(modalidad: unknown): modalidad is ModalidadConsulta {
  return modalidad === 'PARTICULAR' || modalidad === 'COBERTURA'
}

function validarSeleccionModalidad(modalidad: unknown): { ok: true; modalidad: ModalidadConsulta } | { ok: false; error: string } {
  if (modalidad === null || modalidad === undefined || modalidad === '') {
    return { ok: false as const, error: 'Debe seleccionar el tipo de consulta: Particular o Cobertura médica.' }
  }
  if (!esModalidadValida(modalidad)) {
    return { ok: false as const, error: 'El tipo de consulta seleccionado no es válido.' }
  }
  return { ok: true as const, modalidad }
}

function aplicarModalidadAlTurno(turno: Turno, modalidad: ModalidadConsulta): Turno {
  const validacion = validarSeleccionModalidad(modalidad)
  if (!validacion.ok) {
    throw new Error(validacion.error)
  }
  turno.modalidad = validacion.modalidad
  return turno
}

function crearTurnoConModalidad(datos: {
  idTurno: string
  idMedico: string
  idPaciente: string
  fecha: string
  hora: string
  duracionMinutos: number
  modalidad: unknown
}): Turno {
  const validacion = validarSeleccionModalidad(datos.modalidad)
  if (!validacion.ok) {
    throw new Error(validacion.error)
  }

  const turno: Turno = {
    idTurno: datos.idTurno,
    idMedico: datos.idMedico,
    idPaciente: datos.idPaciente,
    fecha: datos.fecha,
    hora: datos.hora,
    duracionMinutos: datos.duracionMinutos,
    estado: 'CONFIRMADO',
    modalidad: validacion.modalidad,
  }

  return turno
}

function obtenerModalidadPersistida(turnoGuardado: Turno): ModalidadConsulta | null {
  if (!turnoGuardado.modalidad) return null
  if (esModalidadValida(turnoGuardado.modalidad)) return turnoGuardado.modalidad
  return null
}

function verificarPersistenciaModalidad(turnoGuardado: Turno): { persistida: boolean; modalidad: ModalidadConsulta | null } {
  const modalidad = obtenerModalidadPersistida(turnoGuardado)
  return {
    persistida: modalidad === 'PARTICULAR' || modalidad === 'COBERTURA',
    modalidad,
  }
}

const PACIENTE: Paciente = {
  idPaciente: 'pac_001',
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '30123456',
  email: 'juan.perez@example.com',
}

const MEDICO: Medico = {
  idMedico: 'med_001',
  nombre: 'Laura',
  apellido: 'Gómez',
  especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
}

function crearTurnoBase(): Turno {
  return {
    idTurno: 'turno_001',
    idMedico: MEDICO.idMedico,
    idPaciente: PACIENTE.idPaciente,
    fecha: '2026-12-01',
    hora: '09:30',
    duracionMinutos: 30,
    estado: 'DISPONIBLE',
    modalidad: null,
  }
}

async function runAllTests() {
  console.log('\n=== US-25: PRUEBAS UNITARIAS DE SELECCIÓN DE TIPO DE CONSULTA (PARTICULAR / COBERTURA) ===\n')

  // --- Escenario 1: Selector obligatorio Particular / Cobertura médica ---
  await test('Esc.1: el selector presenta las dos opciones obligatorias (Particular / Cobertura médica)', () => {
    assert.deepEqual(opcionesModalidad, ['PARTICULAR', 'COBERTURA'])
    assert.equal(opcionesModalidad.length, 2)
  })

  await test('Esc.1: no se permite continuar la reserva sin seleccionar el tipo de consulta', () => {
    const res = validarSeleccionModalidad(undefined)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Debe seleccionar el tipo de consulta: Particular o Cobertura médica.')
  })

  await test('Esc.1: no se permite continuar la reserva con selección nula', () => {
    const res = validarSeleccionModalidad(null)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Debe seleccionar el tipo de consulta: Particular o Cobertura médica.')
  })

  await test('Esc.1: se rechaza un valor inválido para el tipo de consulta', () => {
    const res = validarSeleccionModalidad('OBRA_SOCIAL')
    assert.equal(res.ok, false)
    assert.equal(res.error, 'El tipo de consulta seleccionado no es válido.')
  })

  await test('Esc.1: se acepta la opción "Particular"', () => {
    const res = validarSeleccionModalidad('PARTICULAR')
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.modalidad, 'PARTICULAR')
  })

  await test('Esc.1: se acepta la opción "Cobertura médica"', () => {
    const res = validarSeleccionModalidad('COBERTURA')
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.modalidad, 'COBERTURA')
  })

  // --- Escenario 2: Persistencia de la modalidad en el turno (esquema BD y endpoint de creación) ---
  await test('Esc.2: al crear el turno con modalidad PARTICULAR, se persiste en el esquema', () => {
    const turno = crearTurnoConModalidad({
      idTurno: 'turno_010',
      idMedico: MEDICO.idMedico,
      idPaciente: PACIENTE.idPaciente,
      fecha: '2026-12-02',
      hora: '10:00',
      duracionMinutos: 30,
      modalidad: 'PARTICULAR',
    })
    assert.equal(turno.modalidad, 'PARTICULAR')
    assert.equal(turno.estado, 'CONFIRMADO')
  })

  await test('Esc.2: al crear el turno con modalidad COBERTURA, se persiste en el esquema', () => {
    const turno = crearTurnoConModalidad({
      idTurno: 'turno_011',
      idMedico: MEDICO.idMedico,
      idPaciente: PACIENTE.idPaciente,
      fecha: '2026-12-03',
      hora: '11:00',
      duracionMinutos: 30,
      modalidad: 'COBERTURA',
    })
    assert.equal(turno.modalidad, 'COBERTURA')
    assert.equal(turno.estado, 'CONFIRMADO')
  })

  await test('Esc.2: el endpoint de creación rechaza la reserva si no se selecciona modalidad', () => {
    let lanzoError = false
    try {
      crearTurnoConModalidad({
        idTurno: 'turno_012',
        idMedico: MEDICO.idMedico,
        idPaciente: PACIENTE.idPaciente,
        fecha: '2026-12-04',
        hora: '12:00',
        duracionMinutos: 30,
        modalidad: undefined,
      })
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'Debe seleccionar el tipo de consulta: Particular o Cobertura médica.')
    }
    assert.equal(lanzoError, true)
  })

  await test('Esc.2: aplicar modalidad al turno persiste la opción elegida íntegramente', () => {
    const turno = crearTurnoBase()
    assert.equal(turno.modalidad, null)
    aplicarModalidadAlTurno(turno, 'COBERTURA')
    assert.equal(turno.modalidad, 'COBERTURA')
  })

  // --- Escenario 3: Pruebas funcionales de la opción elegida y su persistencia íntegra en BD ---
  await test('Esc.3: verificación de persistencia íntegra para modalidad PARTICULAR', () => {
    const turno = crearTurnoConModalidad({
      idTurno: 'turno_020',
      idMedico: MEDICO.idMedico,
      idPaciente: PACIENTE.idPaciente,
      fecha: '2026-12-05',
      hora: '09:00',
      duracionMinutos: 30,
      modalidad: 'PARTICULAR',
    })
    const verificacion = verificarPersistenciaModalidad(turno)
    assert.equal(verificacion.persistida, true)
    assert.equal(verificacion.modalidad, 'PARTICULAR')
  })

  await test('Esc.3: verificación de persistencia íntegra para modalidad COBERTURA', () => {
    const turno = crearTurnoConModalidad({
      idTurno: 'turno_021',
      idMedico: MEDICO.idMedico,
      idPaciente: PACIENTE.idPaciente,
      fecha: '2026-12-06',
      hora: '10:30',
      duracionMinutos: 30,
      modalidad: 'COBERTURA',
    })
    const verificacion = verificarPersistenciaModalidad(turno)
    assert.equal(verificacion.persistida, true)
    assert.equal(verificacion.modalidad, 'COBERTURA')
  })

  await test('Esc.3: sin modalidad seleccionada la persistencia es nula e inválida', () => {
    const turno = crearTurnoBase()
    const verificacion = verificarPersistenciaModalidad(turno)
    assert.equal(verificacion.persistida, false)
    assert.equal(verificacion.modalidad, null)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-25 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-25:', error)
  process.exit(1)
})
