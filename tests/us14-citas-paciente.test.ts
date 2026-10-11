import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// 1. TIPOS Y ESTRUCTURAS (Simulando Prisma)
type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO'

interface Turno {
  idTurno: string
  idMedico: string
  fecha: string
  hora: string
  estado: EstadoTurno
  idPaciente: string | null
  motivoCancelacion?: string | null
}

const ID_PACIENTE_ACTUAL = 'pac_001'
const ID_OTRO_PACIENTE = 'pac_002'

// 2. LÓGICA DEL SERVICIO REPLICADA EN MEMORIA
function obtenerCitasPaciente(turnos: Turno[], idPaciente: string): Turno[] {
  return turnos
    .filter((t) => t.idPaciente === idPaciente && t.estado === 'CONFIRMADO')
    .sort((a, b) => {
      if (a.fecha === b.fecha) return a.hora.localeCompare(b.hora)
      return a.fecha.localeCompare(b.fecha)
    })
}

function obtenerFechaTurno(fecha: string, hora: string): Date {
  // Simplificamos la conversión de fecha para la prueba en memoria
  return new Date(`${fecha}T${hora}:00Z`)
}

// Le pasamos "ahora" como parámetro para poder viajar en el tiempo en el test y probar la regla de 48hs
function cancelarCitaPaciente(turnos: Turno[], idTurno: string, idPaciente: string, ahora: Date): Turno {
  const turno = turnos.find((t) => t.idTurno === idTurno && t.idPaciente === idPaciente && t.estado === 'CONFIRMADO')

  if (!turno) {
    const existente = turnos.find((t) => t.idTurno === idTurno)
    if (!existente) throw new Error('No se encontró el turno')
    
    // Idempotencia: Si ya estaba cancelado por el paciente, devolvemos OK
    if (existente.estado === 'DISPONIBLE' && existente.motivoCancelacion === 'Cancelado por el paciente') {
      return existente
    }
    throw new Error('No se encontró el turno o ya no está confirmado')
  }

  const fechaTurno = obtenerFechaTurno(turno.fecha, turno.hora)
  const horasRestantes = (fechaTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60)

  if (horasRestantes <= 48) {
    throw new Error('No se puede cancelar el turno porque faltan 48 horas o menos')
  }

  // Actualizamos el estado del turno simulando la base de datos
  turno.idPaciente = null
  turno.estado = 'DISPONIBLE'
  turno.motivoCancelacion = 'Cancelado por el paciente'

  return turno
}

// 3. DATOS DE PRUEBA (MOCKS)
function crearTurnosPrueba(): Turno[] {
  return [
    {
      idTurno: 'turno_futuro',
      idMedico: 'med_001',
      fecha: '2026-10-20', // Turno válido para cancelar (> 48hs)
      hora: '10:00',
      estado: 'CONFIRMADO',
      idPaciente: ID_PACIENTE_ACTUAL,
    },
    {
      idTurno: 'turno_proximo',
      idMedico: 'med_001',
      fecha: '2026-10-12', // Turno muy cercano (< 48hs)
      hora: '10:00',
      estado: 'CONFIRMADO',
      idPaciente: ID_PACIENTE_ACTUAL,
    },
    {
      idTurno: 'turno_otro_paciente',
      idMedico: 'med_001',
      fecha: '2026-10-21',
      hora: '11:00',
      estado: 'CONFIRMADO',
      idPaciente: ID_OTRO_PACIENTE, // De otro paciente
    },
    {
      idTurno: 'turno_ya_cancelado',
      idMedico: 'med_001',
      fecha: '2026-10-25',
      hora: '09:00',
      estado: 'DISPONIBLE',
      idPaciente: null,
      motivoCancelacion: 'Cancelado por el paciente',
    },
    {
      idTurno: 'turno_futuro_2',
      idMedico: 'med_001',
      fecha: '2026-10-22',
      hora: '08:00',
      estado: 'CONFIRMADO',
      idPaciente: ID_PACIENTE_ACTUAL,
    }
  ]
}

// 4. EJECUCIÓN DE LAS PRUEBAS
async function runAllTests() {
  console.log('\n=== US-14: PRUEBAS UNITARIAS DE CONSULTA Y CANCELACIÓN DE CITAS ===\n')

  // Congelamos el tiempo de "hoy" para probar la regla de 48hs consistentemente
  const AHORA = new Date('2026-10-11T10:00:00Z')

  await test('Esc.1: obtenerCitasPaciente devuelve solo los turnos CONFIRMADOS del paciente solicitado', () => {
    const turnos = crearTurnosPrueba()
    const citas = obtenerCitasPaciente(turnos, ID_PACIENTE_ACTUAL)
    
    assert.equal(citas.length, 3, 'Debe devolver exactamente 3 turnos')
    assert.ok(citas.every((c) => c.estado === 'CONFIRMADO' && c.idPaciente === ID_PACIENTE_ACTUAL))
  })

  await test('Esc.1: obtenerCitasPaciente devuelve los turnos ordenados por fecha y hora ascendente', () => {
    const turnos = crearTurnosPrueba()
    const citas = obtenerCitasPaciente(turnos, ID_PACIENTE_ACTUAL)
    
    assert.equal(citas[0].idTurno, 'turno_proximo') // 2026-10-12
    assert.equal(citas[1].idTurno, 'turno_futuro')  // 2026-10-20
    assert.equal(citas[2].idTurno, 'turno_futuro_2')// 2026-10-22
  })

  await test('Esc.2: cancelarCitaPaciente con más de 48hs cambia el estado a DISPONIBLE y libera al paciente', () => {
    const turnos = crearTurnosPrueba()
    const cancelado = cancelarCitaPaciente(turnos, 'turno_futuro', ID_PACIENTE_ACTUAL, AHORA)
    
    assert.equal(cancelado.estado, 'DISPONIBLE')
    assert.equal(cancelado.idPaciente, null)
    assert.equal(cancelado.motivoCancelacion, 'Cancelado por el paciente')
  })

  await test('Esc.3: cancelarCitaPaciente con 48hs o menos arroja error y no modifica el turno', () => {
    const turnos = crearTurnosPrueba()
    let lanzoError = false
    try {
      // turno_proximo es el 12 de octubre y "AHORA" es el 11 de octubre (faltan 24hs)
      cancelarCitaPaciente(turnos, 'turno_proximo', ID_PACIENTE_ACTUAL, AHORA) 
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'No se puede cancelar el turno porque faltan 48 horas o menos')
    }
    
    assert.equal(lanzoError, true, 'Debería haber lanzado error de 48hs')
    
    // Verificamos que el turno sigue intacto
    const turnoOriginal = turnos.find((t) => t.idTurno === 'turno_proximo')
    assert.equal(turnoOriginal?.estado, 'CONFIRMADO')
  })

  await test('Esc.4: intentar cancelar un turno que le pertenece a otro paciente arroja error', () => {
    const turnos = crearTurnosPrueba()
    let lanzoError = false
    try {
      cancelarCitaPaciente(turnos, 'turno_otro_paciente', ID_PACIENTE_ACTUAL, AHORA) 
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'No se encontró el turno o ya no está confirmado')
    }
    assert.equal(lanzoError, true)
  })

  await test('Esc.4: idempotencia - cancelar un turno ya cancelado por el paciente devuelve el turno sin fallar', () => {
    const turnos = crearTurnosPrueba()
    const resultado = cancelarCitaPaciente(turnos, 'turno_ya_cancelado', ID_PACIENTE_ACTUAL, AHORA)
    
    assert.equal(resultado.estado, 'DISPONIBLE')
    assert.equal(resultado.motivoCancelacion, 'Cancelado por el paciente')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-14 PASARON EXITOSAMENTE ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-14:', error)
  process.exit(1)
})