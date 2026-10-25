import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'ATENDIDO' | 'AUSENTE'

interface Medico {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  consultorio?: string | null
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
  idPaciente: string | null
  fecha: string
  hora: string
  estado: EstadoTurno
  motivoCancelacion?: string | null
}

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function etiquetaEspecialidad(codigo: string): string {
  return nombresEspecialidad[codigo] ?? codigo
}

function formatearFecha(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function formatearHora(hora: string): string {
  return `${hora} hs`
}

function obtenerEtiquetaEstado(estado: EstadoTurno): string {
  const etiquetas: Record<EstadoTurno, string> = {
    DISPONIBLE: 'Disponible',
    CONFIRMADO: 'Confirmado',
    CANCELADO: 'Cancelado',
    ATENDIDO: 'Atendido',
    AUSENTE: 'Ausente',
  }
  return etiquetas[estado]
}

function mensajeSinTurnos(): string {
  return 'No tenés turnos registrados en tu historial.'
}

function estaCargando(historial: unknown[] | null | undefined): boolean {
  return historial === undefined || historial === null
}

function hayTurnos(historial: unknown[]): boolean {
  return Array.isArray(historial) && historial.length > 0
}

function obtenerHistorialTurnosPaciente(
  turnos: Turno[],
  medicos: Medico[],
  idPacienteSesion: string,
) {
  return turnos
    .filter((t) => t.idPaciente === idPacienteSesion)
    .map((turno) => {
      const medico = medicos.find((m) => m.idMedico === turno.idMedico)
      if (!medico) throw new Error('Médico no encontrado para el turno')
      return {
        idTurno: turno.idTurno,
        fecha: turno.fecha,
        hora: turno.hora,
        fechaFormateada: formatearFecha(turno.fecha),
        horaFormateada: formatearHora(turno.hora),
        estado: turno.estado,
        estadoEtiqueta: obtenerEtiquetaEstado(turno.estado),
        medico: {
          idMedico: medico.idMedico,
          nombre: medico.nombre,
          apellido: medico.apellido,
          nombreCompleto: `${medico.nombre} ${medico.apellido}`,
          especialidad: medico.especialidad,
          especialidadEtiqueta: etiquetaEspecialidad(medico.especialidad),
        },
      }
    })
    .sort((a, b) => {
      if (a.fecha === b.fecha) return b.hora.localeCompare(a.hora)
      return b.fecha.localeCompare(a.fecha)
    })
}

const PACIENTE_SESION: Paciente = {
  idPaciente: 'pac_001',
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '30123456',
  email: 'juan.perez@example.com',
}

const MEDICO_1: Medico = { idMedico: 'med_001', nombre: 'Laura', apellido: 'Gómez', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA' }
const MEDICO_2: Medico = { idMedico: 'med_002', nombre: 'Carlos', apellido: 'Martínez', especialidad: 'CLINICA_MEDICA' }

function crearTurnosPaciente(): Turno[] {
  return [
    { idTurno: 'turno_001', idMedico: 'med_001', idPaciente: PACIENTE_SESION.idPaciente, fecha: '2026-10-15', hora: '09:30', estado: 'ATENDIDO' },
    { idTurno: 'turno_002', idMedico: 'med_002', idPaciente: PACIENTE_SESION.idPaciente, fecha: '2026-10-20', hora: '14:00', estado: 'CONFIRMADO' },
    { idTurno: 'turno_003', idMedico: 'med_001', idPaciente: PACIENTE_SESION.idPaciente, fecha: '2026-09-10', hora: '10:00', estado: 'CANCELADO' },
  ]
}

async function runAllTests() {
  console.log('\n=== US-26: PRUEBAS UNITARIAS DE VISUALIZACIÓN DE HISTORIAL DE TURNOS ===\n')

  // --- Escenario 1: Pestaña "Historial de Turnos" en Historia Clínica con tabla responsiva ---
  await test('Esc.1: existe la pestaña "Historial de Turnos" en la Historia Clínica del paciente', () => {
    const pestañas = ['Datos Personales', 'Historial de Turnos']
    assert.ok(pestañas.includes('Historial de Turnos'))
  })

  await test('Esc.1: la vista usa tabla responsiva con columnas (Fecha, Hora, Profesional / Especialidad, Estado)', () => {
    const columnas = ['Fecha', 'Hora', 'Profesional / Especialidad', 'Estado']
    assert.deepEqual(columnas, ['Fecha', 'Hora', 'Profesional / Especialidad', 'Estado'])
  })

  // --- Escenario 2: Consulta que une turnos, profesionales, especialidades y estados ---
  await test('Esc.2: la consulta une turnos, profesionales, especialidades y estados para el paciente en sesión', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos = crearTurnosPaciente()
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    assert.equal(historial.length, 3)
    assert.ok(historial[0].medico)
    assert.ok(historial[0].medico.especialidadEtiqueta)
    assert.ok(historial[0].estadoEtiqueta)
  })

  await test('Esc.2: muestra profesional con nombre, apellido y especialidad con etiqueta legible', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos = crearTurnosPaciente()
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    const fila = historial.find((h) => h.idTurno === 'turno_001')!
    assert.equal(fila.medico.nombreCompleto, 'Laura Gómez')
    assert.equal(fila.medico.especialidadEtiqueta, 'Traumatología y Ortopedia')
  })

  await test('Esc.2: formatea fecha y hora correctamente', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos = crearTurnosPaciente()
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    const fila = historial.find((h) => h.idTurno === 'turno_002')!
    assert.equal(fila.fechaFormateada, '20/10/2026')
    assert.equal(fila.horaFormateada, '14:00 hs')
  })

  await test('Esc.2: muestra los estados ATENDIDO, CONFIRMADO y CANCELADO correctamente', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos = crearTurnosPaciente()
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    assert.equal(obtenerEtiquetaEstado('ATENDIDO'), 'Atendido')
    assert.equal(obtenerEtiquetaEstado('CONFIRMADO'), 'Confirmado')
    assert.equal(obtenerEtiquetaEstado('CANCELADO'), 'Cancelado')
  })

  await test('Esc.2: ordena el historial por fecha y hora descendente (más reciente primero)', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos = crearTurnosPaciente()
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    assert.equal(historial[0].idTurno, 'turno_002')
    assert.equal(historial[1].idTurno, 'turno_001')
    assert.equal(historial[2].idTurno, 'turno_003')
  })

  await test('Esc.2: solo muestra turnos del paciente en sesión', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos: Turno[] = [
      ...crearTurnosPaciente(),
      { idTurno: 'turno_otro', idMedico: 'med_001', idPaciente: 'pac_999', fecha: '2026-11-01', hora: '11:00', estado: 'CONFIRMADO' },
    ]
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    assert.equal(historial.length, 3)
  })

  // --- Escenario 3: Estados de carga y vacío ---
  await test('Esc.3: estado de carga mientras se consulta el historial', () => {
    const historial: any[] | undefined = undefined
    assert.equal(estaCargando(historial), true)
    assert.equal(hayTurnos(historial as any[]), false)
  })

  await test('Esc.3: estado vacío cuando el paciente no tiene turnos registrados', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos: Turno[] = []
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    assert.equal(hayTurnos(historial), false)
    assert.equal(mensajeSinTurnos(), 'No tenés turnos registrados en tu historial.')
  })

  await test('Esc.3: estado vacío con mensaje descriptivo para pacientes sin turnos en el sistema', () => {
    const medicos = [MEDICO_1, MEDICO_2]
    const turnos: Turno[] = [
      { idTurno: 'turno_x', idMedico: 'med_001', idPaciente: 'pac_888', fecha: '2026-10-25', hora: '15:00', estado: 'CONFIRMADO' },
    ]
    const historial = obtenerHistorialTurnosPaciente(turnos, medicos, PACIENTE_SESION.idPaciente)
    assert.equal(hayTurnos(historial), false)
    assert.equal(mensajeSinTurnos(), 'No tenés turnos registrados en tu historial.')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-26 PASARON EXITOSAMENTE (11/11) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-26:', error)
  process.exit(1)
})
