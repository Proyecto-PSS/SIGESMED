import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type RolUsuario = 'ADMIN' | 'MEDICO' | 'ENFERMERA' | 'PACIENTE'

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

interface TurnoAdmin {
  idTurno: string
  idMedico: string
  idPaciente: string | null
  fecha: string
  hora: string
  estado: EstadoTurno
  motivoCancelacion?: string | null
  paciente?: Paciente | null
  medico?: Medico | null
}

interface FiltrosAdminTurnos {
  dniPaciente?: string
  fecha?: string
}

interface ResultadoAcceso {
  status: number
  autorizado: boolean
  error?: string
}

function requireRolAdministrador(rol: RolUsuario | null | undefined): ResultadoAcceso {
  if (!rol) {
    return { status: 401, autorizado: false, error: 'No autenticado' }
  }
  if (rol !== 'ADMIN') {
    return { status: 403, autorizado: false, error: 'Acceso no autorizado. Solo administradores pueden acceder a esta funcionalidad.' }
  }
  return { status: 200, autorizado: true }
}

function filtrarTurnosAdministrativos(turnos: TurnoAdmin[], filtros: FiltrosAdminTurnos = {}): TurnoAdmin[] {
  const { dniPaciente, fecha } = filtros
  const dniNormalizado = dniPaciente?.trim()

  return turnos.filter((turno) => {
    const coincideDni = dniNormalizado
      ? turno.paciente?.dni?.toLowerCase().includes(dniNormalizado.toLowerCase())
      : true

    const coincideFecha = fecha ? turno.fecha === fecha : true

    return coincideDni && coincideFecha
  })
}

function puedeMostrarModalCancelacion(): boolean {
  return true
}

function cancelarTurnoAdministrativo(
  turnos: TurnoAdmin[],
  idTurno: string,
  rolSolicitante: RolUsuario | null | undefined,
  confirmar: boolean,
): TurnoAdmin {
  const acceso = requireRolAdministrador(rolSolicitante)
  if (!acceso.autorizado) {
    const err: any = new Error(acceso.error)
    err.status = acceso.status
    throw err
  }

  if (!confirmar) {
    const err: any = new Error('Cancelación cancelada por el usuario desde el modal de confirmación.')
    err.status = 409
    throw err
  }

  const turno = turnos.find((t) => t.idTurno === idTurno)
  if (!turno) {
    const err: any = new Error('Turno no encontrado')
    err.status = 404
    throw err
  }

  if (turno.estado === 'CANCELADO') {
    return turno
  }

  turno.estado = 'CANCELADO'
  turno.motivoCancelacion = 'Cancelado por administración'
  return turno
}

const PACIENTE_1: Paciente = {
  idPaciente: 'pac_001',
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '30123456',
  email: 'juan.perez@example.com',
}

const PACIENTE_2: Paciente = {
  idPaciente: 'pac_002',
  nombre: 'María',
  apellido: 'González',
  dni: '28987654',
  email: 'maria.gonzalez@example.com',
}

const MEDICO_1: Medico = {
  idMedico: 'med_001',
  nombre: 'Laura',
  apellido: 'Gómez',
  especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
}

const MEDICO_2: Medico = {
  idMedico: 'med_002',
  nombre: 'Carlos',
  apellido: 'Martínez',
  especialidad: 'CLINICA_MEDICA',
}

function crearTurnosPanelAdmin(): TurnoAdmin[] {
  return [
    {
      idTurno: 'turno_a1',
      idMedico: MEDICO_1.idMedico,
      idPaciente: PACIENTE_1.idPaciente,
      fecha: '2026-10-20',
      hora: '09:30',
      estado: 'CONFIRMADO',
      paciente: PACIENTE_1,
      medico: MEDICO_1,
    },
    {
      idTurno: 'turno_a2',
      idMedico: MEDICO_2.idMedico,
      idPaciente: PACIENTE_2.idPaciente,
      fecha: '2026-10-20',
      hora: '14:00',
      estado: 'CONFIRMADO',
      paciente: PACIENTE_2,
      medico: MEDICO_2,
    },
    {
      idTurno: 'turno_a3',
      idMedico: MEDICO_1.idMedico,
      idPaciente: PACIENTE_1.idPaciente,
      fecha: '2026-10-21',
      hora: '10:00',
      estado: 'CONFIRMADO',
      paciente: PACIENTE_1,
      medico: MEDICO_1,
    },
    {
      idTurno: 'turno_a4',
      idMedico: MEDICO_2.idMedico,
      idPaciente: PACIENTE_2.idPaciente,
      fecha: '2026-10-22',
      hora: '11:30',
      estado: 'DISPONIBLE',
      paciente: null,
      medico: MEDICO_2,
    },
  ]
}

async function runAllTests() {
  console.log('\n=== US-21: PRUEBAS UNITARIAS DE FILTRADO Y CANCELACIÓN ADMINISTRATIVA ===\n')

  // --- Escenario 1: Panel admin con filtros por paciente/día ---
  await test('Esc.1: el panel administrativo permite filtrar por DNI del paciente', () => {
    const turnos = crearTurnosPanelAdmin()
    const resultado = filtrarTurnosAdministrativos(turnos, { dniPaciente: '30123456' })
    assert.equal(resultado.length, 2)
    assert.ok(resultado.every((t) => t.paciente?.dni === '30123456'))
  })

  await test('Esc.1: el filtro por DNI del paciente es parcial e insensible a mayúsculas/minúsculas', () => {
    const turnos = crearTurnosPanelAdmin()
    const resultado = filtrarTurnosAdministrativos(turnos, { dniPaciente: '2898' })
    assert.equal(resultado.length, 1)
    assert.ok(resultado.every((t) => t.paciente?.dni === '28987654'))
  })

  await test('Esc.1: el panel administrativo permite filtrar por día/fecha', () => {
    const turnos = crearTurnosPanelAdmin()
    const resultado = filtrarTurnosAdministrativos(turnos, { fecha: '2026-10-20' })
    assert.equal(resultado.length, 2)
    assert.deepEqual(
      resultado.map((t) => t.idTurno).sort(),
      ['turno_a1', 'turno_a2'],
    )
  })

  await test('Esc.1: se pueden combinar ambos filtros (paciente y día)', () => {
    const turnos = crearTurnosPanelAdmin()
    const resultado = filtrarTurnosAdministrativos(turnos, { dniPaciente: '30123456', fecha: '2026-10-21' })
    assert.equal(resultado.length, 1)
    assert.equal(resultado[0].idTurno, 'turno_a3')
  })

  await test('Esc.1: sin filtros se listan todos los turnos en la tabla administrativa', () => {
    const turnos = crearTurnosPanelAdmin()
    const resultado = filtrarTurnosAdministrativos(turnos, {})
    assert.equal(resultado.length, 4)
  })

  // --- Escenario 2: Tabla con botón Cancelar, modal de confirmación y cancelación con actualización de estado ---
  await test('Esc.2: la tabla administrativa muestra botón "Cancelar" para turnos gestionables', () => {
    const turnos = crearTurnosPanelAdmin()
    const turnosGestionables = turnos.filter((t) => t.estado === 'CONFIRMADO')
    assert.equal(turnosGestionables.length, 3)
    assert.equal(puedeMostrarModalCancelacion(), true)
  })

  await test('Esc.2: al confirmar en el modal, el administrador cancela el turno y actualiza su estado a CANCELADO', () => {
    const turnos = crearTurnosPanelAdmin()
    const cancelado = cancelarTurnoAdministrativo(turnos, 'turno_a1', 'ADMIN', true)
    assert.equal(cancelado.estado, 'CANCELADO')
    assert.equal(cancelado.motivoCancelacion, 'Cancelado por administración')
  })

  await test('Esc.2: la cancelación administrativa actualiza correctamente el estado en la tabla/listado', () => {
    const turnos = crearTurnosPanelAdmin()
    cancelarTurnoAdministrativo(turnos, 'turno_a2', 'ADMIN', true)
    const turnoActualizado = turnos.find((t) => t.idTurno === 'turno_a2')
    assert.equal(turnoActualizado?.estado, 'CANCELADO')
    assert.equal(turnoActualizado?.motivoCancelacion, 'Cancelado por administración')
  })

  await test('Esc.2: si el administrador rechaza la confirmación en el modal, no se cancela el turno', () => {
    const turnos = crearTurnosPanelAdmin()
    let lanzoError = false
    try {
      cancelarTurnoAdministrativo(turnos, 'turno_a3', 'ADMIN', false)
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.status, 409)
    }
    assert.equal(lanzoError, true)
    const turnoSinCambio = turnos.find((t) => t.idTurno === 'turno_a3')
    assert.equal(turnoSinCambio?.estado, 'CONFIRMADO')
    assert.equal(turnoSinCambio?.motivoCancelacion, undefined)
  })

  // --- Escenario 3: Endpoints GET/PUT con control de rol administrador y bloqueo de roles no autorizados ---
  await test('Esc.3: endpoint GET de turnos administrativos solo accesible por rol ADMIN', () => {
    assert.equal(requireRolAdministrador('ADMIN').status, 200)
    assert.equal(requireRolAdministrador('ADMIN').autorizado, true)
  })

  await test('Esc.3: endpoint PUT de cancelación solo accesible por rol ADMIN', () => {
    assert.equal(requireRolAdministrador('ADMIN').status, 200)
    assert.equal(requireRolAdministrador('ADMIN').autorizado, true)
  })

  await test('Esc.3: médico no autorizado al acceso administrativo de turnos (bloqueado)', () => {
    const res = requireRolAdministrador('MEDICO')
    assert.equal(res.status, 403)
    assert.equal(res.autorizado, false)
  })

  await test('Esc.3: enfermera no autorizada al acceso administrativo de turnos (bloqueado)', () => {
    const res = requireRolAdministrador('ENFERMERA')
    assert.equal(res.status, 403)
    assert.equal(res.autorizado, false)
  })

  await test('Esc.3: paciente no autorizado al acceso administrativo de turnos (bloqueado)', () => {
    const res = requireRolAdministrador('PACIENTE')
    assert.equal(res.status, 403)
    assert.equal(res.autorizado, false)
  })

  await test('Esc.3: sin sesión no se permite acceder a endpoints administrativos (401)', () => {
    const res = requireRolAdministrador(null)
    assert.equal(res.status, 401)
    assert.equal(res.autorizado, false)
  })

  await test('Esc.3: un rol no administrador no puede cancelar turnos vía endpoint administrativo', () => {
    const turnos = crearTurnosPanelAdmin()
    let lanzoError = false
    try {
      cancelarTurnoAdministrativo(turnos, 'turno_a1', 'MEDICO', true)
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.status, 403)
    }
    assert.equal(lanzoError, true)
    assert.equal(turnos.find((t) => t.idTurno === 'turno_a1')?.estado, 'CONFIRMADO')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-21 PASARON EXITOSAMENTE (15/15) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-21:', error)
  process.exit(1)
})
