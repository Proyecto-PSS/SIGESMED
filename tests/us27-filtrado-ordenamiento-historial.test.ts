// Suite de pruebas unitarias para US-27:
// Filtrado por estado y rango de fechas, combinaciones de filtros y ordenamiento del historial.
import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// --------------------------------------------------------------------------
// Definiciones y lógica espejo de citas-service.ts para prueba aislada
// --------------------------------------------------------------------------
type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'ATENDIDO' | 'AUSENTE' | 'CANCELADO'

const ESTADOS_HISTORIAL: readonly EstadoTurno[] = [
  'CONFIRMADO',
  'ATENDIDO',
  'AUSENTE',
  'CANCELADO',
] as const

interface FiltrosHistorialTurnos {
  estado?: string
  desde?: string
  hasta?: string
}

interface TurnoHistorialMock {
  idTurno: string
  idPaciente: string | null
  fecha: Date // UTC 00:00:00
  hora: string // HH:mm
  estado: EstadoTurno
  medico: {
    nombre: string
    apellido: string
    especialidad: string
  }
}

function parsearFechaFiltro(valor: string | undefined, etiqueta: string): Date | undefined {
  if (!valor) return undefined

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error(`La fecha "${etiqueta}" no es válida.`)
  }

  const fecha = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new Error(`La fecha "${etiqueta}" no es válida.`)
  }

  return fecha
}

function obtenerLimiteAntiguedad(fechaReferenciaHoy: Date): Date {
  const limite = new Date(fechaReferenciaHoy)
  limite.setUTCMonth(limite.getUTCMonth() - 6)
  limite.setUTCHours(0, 0, 0, 0)
  return limite
}

function obtenerHistorialTurnosPacienteMock(
  dbTurnos: TurnoHistorialMock[],
  idPaciente: string,
  filtros: FiltrosHistorialTurnos = {},
  ordenar: 'reciente' | 'antiguo' = 'reciente',
  fechaReferenciaHoy: Date = new Date('2026-10-25T12:00:00.000Z')
): TurnoHistorialMock[] {
  let estado: EstadoTurno | undefined
  if (filtros.estado) {
    if (!ESTADOS_HISTORIAL.includes(filtros.estado as EstadoTurno)) {
      throw new Error('El estado seleccionado no es válido.')
    }
    estado = filtros.estado as EstadoTurno
  }

  const desde = parsearFechaFiltro(filtros.desde, 'desde')
  const hasta = parsearFechaFiltro(filtros.hasta, 'hasta')
  if (desde && hasta && desde > hasta) {
    throw new Error('La fecha "desde" no puede ser posterior a la fecha "hasta".')
  }

  const limiteAntiguedad = obtenerLimiteAntiguedad(fechaReferenciaHoy)
  const fechaMinima = desde && desde > limiteAntiguedad ? desde : limiteAntiguedad

  const filtrados = dbTurnos.filter((t) => {
    if (t.idPaciente !== idPaciente) return false
    if (!ESTADOS_HISTORIAL.includes(t.estado)) return false
    if (estado && t.estado !== estado) return false
    if (t.fecha < fechaMinima) return false
    if (hasta && t.fecha > hasta) return false
    return true
  })

  return filtrados.sort((a, b) => {
    const diffFecha = a.fecha.getTime() - b.fecha.getTime()
    if (diffFecha !== 0) {
      return ordenar === 'reciente' ? -diffFecha : diffFecha
    }
    return ordenar === 'reciente'
      ? b.hora.localeCompare(a.hora)
      : a.hora.localeCompare(b.hora)
  })
}

function contarEstadosHistorialTurnosMock(
  dbTurnos: TurnoHistorialMock[],
  idPaciente: string,
  filtros: FiltrosHistorialTurnos = {},
  fechaReferenciaHoy: Date = new Date('2026-10-25T12:00:00.000Z')
): Partial<Record<EstadoTurno, number>> {
  const limite = obtenerLimiteAntiguedad(fechaReferenciaHoy)
  const desde = parsearFechaFiltro(filtros.desde, 'desde')
  const hasta = parsearFechaFiltro(filtros.hasta, 'hasta')
  if (desde && hasta && desde > hasta) {
    throw new Error('La fecha "desde" no puede ser posterior a la fecha "hasta".')
  }
  const fechaGte = desde && desde > limite ? desde : limite

  const conteo: Partial<Record<EstadoTurno, number>> = {}
  for (const t of dbTurnos) {
    if (t.idPaciente !== idPaciente) continue
    if (!ESTADOS_HISTORIAL.includes(t.estado)) continue
    if (t.fecha < fechaGte) continue
    if (hasta && t.fecha > hasta) continue
    conteo[t.estado] = (conteo[t.estado] ?? 0) + 1
  }
  return conteo
}

// --------------------------------------------------------------------------
// Datos de prueba
// --------------------------------------------------------------------------
const HOY_FIJO = new Date('2026-10-25T12:00:00.000Z') // Límite 6 meses: 2026-04-25

const DB_TURNOS_MOCK: TurnoHistorialMock[] = [
  {
    idTurno: 't_antiguo_fuera_rango',
    idPaciente: 'pac_01',
    fecha: new Date('2026-03-10T00:00:00.000Z'), // Más de 6 meses atrás
    hora: '09:00',
    estado: 'ATENDIDO',
    medico: { nombre: 'Juan', apellido: 'Pérez', especialidad: 'CLINICA_MEDICA' },
  },
  {
    idTurno: 't_junio_atendido',
    idPaciente: 'pac_01',
    fecha: new Date('2026-06-15T00:00:00.000Z'),
    hora: '10:00',
    estado: 'ATENDIDO',
    medico: { nombre: 'Juan', apellido: 'Pérez', especialidad: 'CLINICA_MEDICA' },
  },
  {
    idTurno: 't_agosto_cancelado',
    idPaciente: 'pac_01',
    fecha: new Date('2026-08-20T00:00:00.000Z'),
    hora: '11:30',
    estado: 'CANCELADO',
    medico: { nombre: 'María', apellido: 'Gómez', especialidad: 'PEDIATRIA' },
  },
  {
    idTurno: 't_sept_ausente',
    idPaciente: 'pac_01',
    fecha: new Date('2026-09-05T00:00:00.000Z'),
    hora: '08:30',
    estado: 'AUSENTE',
    medico: { nombre: 'Carlos', apellido: 'Ruiz', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA' },
  },
  {
    idTurno: 't_oct_atendido_temprano',
    idPaciente: 'pac_01',
    fecha: new Date('2026-10-10T00:00:00.000Z'),
    hora: '09:00',
    estado: 'ATENDIDO',
    medico: { nombre: 'Juan', apellido: 'Pérez', especialidad: 'CLINICA_MEDICA' },
  },
  {
    idTurno: 't_oct_confirmado_tarde',
    idPaciente: 'pac_01',
    fecha: new Date('2026-10-10T00:00:00.000Z'),
    hora: '16:00',
    estado: 'CONFIRMADO',
    medico: { nombre: 'María', apellido: 'Gómez', especialidad: 'PEDIATRIA' },
  },
  {
    idTurno: 't_otro_paciente',
    idPaciente: 'pac_02',
    fecha: new Date('2026-10-12T00:00:00.000Z'),
    hora: '10:00',
    estado: 'ATENDIDO',
    medico: { nombre: 'Juan', apellido: 'Pérez', especialidad: 'CLINICA_MEDICA' },
  },
]

// --------------------------------------------------------------------------
// Ejecución de escenarios de prueba
// --------------------------------------------------------------------------
async function runAllTests() {
  console.log('\n=== US-27: PRUEBAS DE FILTRADO Y ORDENAMIENTO DEL HISTORIAL ===\n')

  await test('Esc.1: Orden por defecto ("reciente") devuelve turnos en orden descendente por fecha y hora', () => {
    const historial = obtenerHistorialTurnosPacienteMock(DB_TURNOS_MOCK, 'pac_01', {}, 'reciente', HOY_FIJO)

    // Excluye el turno de marzo (> 6 meses) y el de otro paciente
    assert.equal(historial.length, 5)
    assert.deepEqual(
      historial.map((t) => t.idTurno),
      [
        't_oct_confirmado_tarde', // 2026-10-10 16:00
        't_oct_atendido_temprano', // 2026-10-10 09:00
        't_sept_ausente', // 2026-09-05 08:30
        't_agosto_cancelado', // 2026-08-20 11:30
        't_junio_atendido', // 2026-06-15 10:00
      ]
    )
  })

  await test('Esc.2: Orden "antiguo" devuelve turnos en orden ascendente cronológico', () => {
    const historial = obtenerHistorialTurnosPacienteMock(DB_TURNOS_MOCK, 'pac_01', {}, 'antiguo', HOY_FIJO)

    assert.equal(historial.length, 5)
    assert.deepEqual(
      historial.map((t) => t.idTurno),
      [
        't_junio_atendido',
        't_agosto_cancelado',
        't_sept_ausente',
        't_oct_atendido_temprano',
        't_oct_confirmado_tarde',
      ]
    )
  })

  await test('Esc.3: Filtro individual por estado devuelve únicamente los turnos de ese estado', () => {
    const atendidos = obtenerHistorialTurnosPacienteMock(
      DB_TURNOS_MOCK,
      'pac_01',
      { estado: 'ATENDIDO' },
      'reciente',
      HOY_FIJO
    )

    assert.equal(atendidos.length, 2)
    assert.ok(atendidos.every((t) => t.estado === 'ATENDIDO'))
    assert.deepEqual(atendidos.map((t) => t.idTurno), ['t_oct_atendido_temprano', 't_junio_atendido'])
  })

  await test('Esc.4: Filtro por rango de fechas (desde y hasta) acota correctamente los resultados', () => {
    const rango = obtenerHistorialTurnosPacienteMock(
      DB_TURNOS_MOCK,
      'pac_01',
      { desde: '2026-08-01', hasta: '2026-09-30' },
      'reciente',
      HOY_FIJO
    )

    assert.equal(rango.length, 2)
    assert.deepEqual(rango.map((t) => t.idTurno), ['t_sept_ausente', 't_agosto_cancelado'])
  })

  await test('Esc.5: Combinación de filtros (estado + rango desde/hasta) mantiene orden por defecto', () => {
    const combinado = obtenerHistorialTurnosPacienteMock(
      DB_TURNOS_MOCK,
      'pac_01',
      { estado: 'ATENDIDO', desde: '2026-09-01', hasta: '2026-10-31' },
      'reciente',
      HOY_FIJO
    )

    assert.equal(combinado.length, 1)
    assert.equal(combinado[0].idTurno, 't_oct_atendido_temprano')

    // Combinación sin coincidencias devuelve arreglo vacío
    const vacio = obtenerHistorialTurnosPacienteMock(
      DB_TURNOS_MOCK,
      'pac_01',
      { estado: 'CANCELADO', desde: '2026-09-01', hasta: '2026-10-31' },
      'reciente',
      HOY_FIJO
    )
    assert.equal(vacio.length, 0)
  })

  await test('Esc.6: Respeta el límite de 6 meses de antigüedad aunque se envíe una fecha "desde" más antigua', () => {
    const historial = obtenerHistorialTurnosPacienteMock(
      DB_TURNOS_MOCK,
      'pac_01',
      { desde: '2026-01-01' },
      'reciente',
      HOY_FIJO
    )

    assert.equal(
      historial.some((t) => t.idTurno === 't_antiguo_fuera_rango'),
      false,
      'No debe incluir turnos con más de 6 meses de antigüedad'
    )
  })

  await test('Esc.7: Validaciones de errores ante estados inválidos, fechas malformadas o rango invertido', () => {
    // Estado no permitido en historial
    assert.throws(
      () => obtenerHistorialTurnosPacienteMock(DB_TURNOS_MOCK, 'pac_01', { estado: 'DISPONIBLE' }, 'reciente', HOY_FIJO),
      /El estado seleccionado no es válido/
    )

    // Fecha con formato incorrecto o inexistente en calendario
    assert.throws(
      () => obtenerHistorialTurnosPacienteMock(DB_TURNOS_MOCK, 'pac_01', { desde: '25-10-2026' }, 'reciente', HOY_FIJO),
      /La fecha "desde" no es válida/
    )
    assert.throws(
      () => obtenerHistorialTurnosPacienteMock(DB_TURNOS_MOCK, 'pac_01', { hasta: '2026-02-30' }, 'reciente', HOY_FIJO),
      /La fecha "hasta" no es válida/
    )

    // Fecha "desde" posterior a "hasta"
    assert.throws(
      () =>
        obtenerHistorialTurnosPacienteMock(
          DB_TURNOS_MOCK,
          'pac_01',
          { desde: '2026-10-20', hasta: '2026-10-01' },
          'reciente',
          HOY_FIJO
        ),
      /La fecha "desde" no puede ser posterior a la fecha "hasta"/
    )
  })

  await test('Esc.8: Conteo de estados agrupa correctamente dentro del rango de fechas', () => {
    const conteoTotal = contarEstadosHistorialTurnosMock(DB_TURNOS_MOCK, 'pac_01', {}, HOY_FIJO)
    assert.equal(conteoTotal.ATENDIDO, 2)
    assert.equal(conteoTotal.CONFIRMADO, 1)
    assert.equal(conteoTotal.CANCELADO, 1)
    assert.equal(conteoTotal.AUSENTE, 1)

    const conteoOctubre = contarEstadosHistorialTurnosMock(
      DB_TURNOS_MOCK,
      'pac_01',
      { desde: '2026-10-01', hasta: '2026-10-31' },
      HOY_FIJO
    )
    assert.equal(conteoOctubre.ATENDIDO, 1)
    assert.equal(conteoOctubre.CONFIRMADO, 1)
    assert.equal(conteoOctubre.CANCELADO, undefined)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-27 PASARON EXITOSAMENTE (8/8) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-27:', error)
  process.exit(1)
})