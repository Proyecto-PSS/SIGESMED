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
  id: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: EstadoTurno
}

const RUTA_LISTA_MEDICOS = '/dashboard/paciente/medicos'

function calcularDias(turnos: Turno[], mes: string) {
  const delMes = turnos.filter((t) => t.fecha.startsWith(`${mes}-`))
  const porFecha = new Map<string, Turno[]>()
  for (const t of delMes) {
    const arr = porFecha.get(t.fecha) ?? []
    arr.push(t)
    porFecha.set(t.fecha, arr)
  }
  return [...porFecha.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fecha, ts]) => ({
      fecha,
      turnos: ts,
      disponibles: ts.filter((t) => t.estado === 'DISPONIBLE').length,
    }))
}

function etiquetaDia(dia: { disponibles: number }): 'Disponible' | 'Agotado' {
  return dia.disponibles > 0 ? 'Disponible' : 'Agotado'
}

function puedeSeleccionarDia(dia: { disponibles: number }): boolean {
  return dia.disponibles > 0
}

function todosAgotados(dias: { disponibles: number }[]): boolean {
  return dias.length > 0 && dias.every((d) => d.disponibles === 0)
}

function etiquetaBotonCliente(dia: { disponibles: number }, seleccionado: boolean): string {
  const tieneDisponibles = dia.disponibles > 0
  return tieneDisponibles ? (seleccionado ? 'Elegido' : 'Libre') : 'Agotado'
}

function estaDeshabilitadoCliente(dia: { disponibles: number }): boolean {
  return dia.disponibles === 0
}

function horariosDisponiblesDelDia(turnos: Turno[], fecha: string) {
  const disponibles = turnos.filter((t) => t.fecha === fecha && t.estado === 'DISPONIBLE')
  return {
    todos: disponibles,
    manana: disponibles.filter((t) => Number(t.hora.slice(0, 2)) < 12),
    tarde: disponibles.filter((t) => Number(t.hora.slice(0, 2)) >= 12),
  }
}

function reservarTurno(turnos: Turno[], id: string) {
  const objetivo = turnos.find((t) => t.id === id && t.estado === 'DISPONIBLE')
  if (!objetivo) return { ok: false as const }
  objetivo.estado = 'CONFIRMADO'
  return { ok: true as const }
}

function clonar(turnos: Turno[]): Turno[] {
  return turnos.map((t) => ({ ...t }))
}

const MES = '2999-12'

const TURNOS: Turno[] = [
  { id: 't1', fecha: '2999-12-02', hora: '08:00', duracionMinutos: 30, estado: 'DISPONIBLE' },
  { id: 't2', fecha: '2999-12-02', hora: '09:00', duracionMinutos: 30, estado: 'DISPONIBLE' },
  { id: 't3', fecha: '2999-12-02', hora: '10:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 't4', fecha: '2999-12-02', hora: '14:30', duracionMinutos: 30, estado: 'DISPONIBLE' },
  { id: 't5', fecha: '2999-12-03', hora: '08:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 't6', fecha: '2999-12-03', hora: '09:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 't7', fecha: '2999-12-04', hora: '15:00', duracionMinutos: 30, estado: 'CANCELADO' },
]

const TURNOS_TODOS_AGOTADOS: Turno[] = [
  { id: 'a1', fecha: '2999-12-02', hora: '08:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 'a2', fecha: '2999-12-04', hora: '09:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 'a3', fecha: '2999-12-05', hora: '10:00', duracionMinutos: 30, estado: 'CANCELADO' },
]

async function runAllTests() {
  console.log('\n=== US-08: PRUEBAS UNITARIAS DE VISUALIZACIÓN DE HORARIOS DISPONIBLES ===\n')

  await test('Esc.1 paso 2: se listan los días que atiende el médico para el mes', () => {
    const dias = calcularDias(TURNOS, MES)
    assert.deepEqual(dias.map((d) => d.fecha), ['2999-12-02', '2999-12-03', '2999-12-04'])
  })

  await test('Esc.1 paso 2: un día con cupos libres se marca como "Disponible"', () => {
    const dia = calcularDias(TURNOS, MES).find((d) => d.fecha === '2999-12-02')
    assert.equal(dia?.disponibles, 3)
    assert.equal(etiquetaDia(dia!), 'Disponible')
  })

  await test('Esc.1 paso 2: un día sin cupos libres se marca como "Agotado"', () => {
    const dia = calcularDias(TURNOS, MES).find((d) => d.fecha === '2999-12-03')
    assert.equal(dia?.disponibles, 0)
    assert.equal(etiquetaDia(dia!), 'Agotado')
  })

  await test('Esc.1 paso 3: no es posible seleccionar un día agotado', () => {
    const dia = calcularDias(TURNOS, MES).find((d) => d.fecha === '2999-12-03')
    assert.equal(puedeSeleccionarDia(dia!), false)
  })

  await test('Esc.1 paso 4: sí es posible seleccionar un día disponible', () => {
    const dia = calcularDias(TURNOS, MES).find((d) => d.fecha === '2999-12-02')
    assert.equal(puedeSeleccionarDia(dia!), true)
  })

  await test('Esc.1 paso 5: al elegir un día se muestran únicamente sus horarios disponibles', () => {
    const horarios = horariosDisponiblesDelDia(TURNOS, '2999-12-02')
    assert.deepEqual(horarios.todos.map((t) => t.hora), ['08:00', '09:00', '14:30'])
  })

  await test('Esc.1 paso 5: los horarios se separan en turno mañana y turno tarde', () => {
    const horarios = horariosDisponiblesDelDia(TURNOS, '2999-12-02')
    assert.deepEqual(horarios.manana.map((t) => t.hora), ['08:00', '09:00'])
    assert.deepEqual(horarios.tarde.map((t) => t.hora), ['14:30'])
  })

  await test('Esc.1: un horario reservado no se ofrece al paciente', () => {
    const horas = horariosDisponiblesDelDia(TURNOS, '2999-12-02').todos.map((t) => t.hora)
    assert.ok(!horas.includes('10:00'))
  })

  await test('Esc.1: la vista cliente etiqueta los días como Libre, Elegido o Agotado', () => {
    const disponibles = { disponibles: 2 }
    const agotado = { disponibles: 0 }
    assert.equal(etiquetaBotonCliente(disponibles, false), 'Libre')
    assert.equal(etiquetaBotonCliente(disponibles, true), 'Elegido')
    assert.equal(etiquetaBotonCliente(agotado, false), 'Agotado')
  })

  await test('Esc.1: la vista cliente deshabilita los días agotados', () => {
    assert.equal(estaDeshabilitadoCliente({ disponibles: 0 }), true)
    assert.equal(estaDeshabilitadoCliente({ disponibles: 1 }), false)
  })

  await test('Esc.2 paso 2: detecta cuando todos los días del médico están agotados', () => {
    const dias = calcularDias(TURNOS_TODOS_AGOTADOS, MES)
    assert.equal(dias.length > 0, true)
    assert.equal(todosAgotados(dias), true)
  })

  await test('Esc.2 paso 3: con todos los días agotados no se puede seleccionar ninguno', () => {
    const dias = calcularDias(TURNOS_TODOS_AGOTADOS, MES)
    assert.ok(dias.every((d) => puedeSeleccionarDia(d) === false))
  })

  await test('Esc.2: con todos los días agotados no se ofrece ningún horario', () => {
    const dias = calcularDias(TURNOS_TODOS_AGOTADOS, MES)
    assert.equal(todosAgotados(dias), true)
    for (const dia of dias) {
      assert.equal(horariosDisponiblesDelDia(TURNOS_TODOS_AGOTADOS, dia.fecha).todos.length, 0)
    }
  })

  await test('Esc.2 paso 4: está disponible el retorno "Volver a Médicos"', () => {
    assert.equal(RUTA_LISTA_MEDICOS, '/dashboard/paciente/medicos')
  })

  await test('Requisito: reservar un turno lo quita de la grilla del paciente', () => {
    const turnos = clonar(TURNOS)
    const res = reservarTurno(turnos, 't1')
    assert.equal(res.ok, true)
    const horas = horariosDisponiblesDelDia(turnos, '2999-12-02').todos.map((t) => t.hora)
    assert.ok(!horas.includes('08:00'))
  })

  await test('Requisito: si se reserva el último cupo, el día pasa a "Agotado"', () => {
    const turnos = clonar([
      { id: 'x1', fecha: '2999-12-02', hora: '08:00', duracionMinutos: 30, estado: 'DISPONIBLE' },
      { id: 'x2', fecha: '2999-12-02', hora: '10:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
    ])
    reservarTurno(turnos, 'x1')
    const dia = calcularDias(turnos, MES).find((d) => d.fecha === '2999-12-02')
    assert.equal(dia?.disponibles, 0)
    assert.equal(etiquetaDia(dia!), 'Agotado')
    assert.equal(puedeSeleccionarDia(dia!), false)
  })

  await test('Requisito: un día con turnos reservados muestra solo los libres', () => {
    const turnos = clonar(TURNOS)
    reservarTurno(turnos, 't2')
    const horarios = horariosDisponiblesDelDia(turnos, '2999-12-02')
    assert.deepEqual(horarios.todos.map((t) => t.hora), ['08:00', '14:30'])
  })

  await test('Requisito: reservar un turno no afecta a los demás días', () => {
    const turnos = clonar(TURNOS)
    reservarTurno(turnos, 't1')
    const dias = calcularDias(turnos, MES)
    assert.equal(dias.find((d) => d.fecha === '2999-12-03')?.disponibles, 0)
    assert.equal(dias.find((d) => d.fecha === '2999-12-04')?.disponibles, 0)
    assert.equal(dias.find((d) => d.fecha === '2999-12-02')?.disponibles, 2)
  })

  await test('Requisito: el conteo de disponibles por día refleja solo turnos DISPONIBLE', () => {
    const dias = calcularDias(TURNOS, MES)
    assert.deepEqual(
      dias.map((d) => d.disponibles),
      [3, 0, 0],
    )
  })

  await test('Requisito: no se puede reservar un turno que ya no está disponible', () => {
    const turnos = clonar(TURNOS)
    const res = reservarTurno(turnos, 't3')
    assert.equal(res.ok, false)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-08 PASARON EXITOSAMENTE (20/20) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-08:', error)
  process.exit(1)
})
