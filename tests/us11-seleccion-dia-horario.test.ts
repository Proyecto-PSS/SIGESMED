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
  idPaciente?: string | null
}

const nombresDias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const nombresMeses = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00`)
}

function fechaCorta(fecha: string) {
  const f = fechaLocal(fecha)
  return { dia: nombresDias[f.getDay()], numero: f.getDate(), mes: nombresMeses[f.getMonth()] }
}

function armarResumen(sel: { dia: string; numero: number; mes: string; hora: string }) {
  return `${sel.dia} ${sel.numero} ${sel.mes} - ${sel.hora} hs`
}

function agruparDias(turnos: Turno[]) {
  const fechas = [...new Set(turnos.map((t) => t.fecha))].sort()
  return fechas.map((fecha) => {
    const delDia = turnos.filter((t) => t.fecha === fecha)
    return {
      fecha,
      turnos: delDia,
      tieneDisponibles: delDia.some((t) => t.estado === 'DISPONIBLE'),
    }
  })
}

function seleccionarDia(
  dias: { fecha: string; tieneDisponibles: boolean }[],
  fecha: string,
  estado: { diaSeleccionado: string; turnoSeleccionado: string | null },
) {
  const dia = dias.find((d) => d.fecha === fecha)
  if (!dia || !dia.tieneDisponibles) {
    return { ...estado, cambio: false }
  }
  return { diaSeleccionado: fecha, turnoSeleccionado: null, cambio: true }
}

function horariosSeleccionables(turnos: Turno[], fecha: string) {
  return turnos.filter((t) => t.fecha === fecha && t.estado === 'DISPONIBLE')
}

function puedeContinuar(turnoSeleccionado: string | null): boolean {
  return turnoSeleccionado !== null
}

function hrefContinuar(idTurno: string): string {
  return `/dashboard/paciente/reservar-turno/confirmacion?turno=${idTurno}`
}

function filtrarReservables(turnos: Turno[], hoy: string, limite: string): Turno[] {
  return turnos.filter((t) => t.fecha >= hoy && t.fecha < limite)
}

function puedeConfirmarTurno(turno: Turno): boolean {
  return turno.estado === 'DISPONIBLE' && !turno.idPaciente
}

const HOY = '2999-12-01'
const LIMITE = '3000-12-01'

const TURNOS: Turno[] = [
  { id: 't1', fecha: '2999-12-02', hora: '08:00', duracionMinutos: 30, estado: 'DISPONIBLE' },
  { id: 't2', fecha: '2999-12-02', hora: '09:30', duracionMinutos: 30, estado: 'DISPONIBLE' },
  { id: 't3', fecha: '2999-12-02', hora: '10:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 't4', fecha: '2999-12-03', hora: '08:00', duracionMinutos: 30, estado: 'CONFIRMADO' },
  { id: 't5', fecha: '2999-11-30', hora: '09:00', duracionMinutos: 30, estado: 'DISPONIBLE' },
  { id: 't6', fecha: '3001-03-15', hora: '09:00', duracionMinutos: 30, estado: 'DISPONIBLE' },
]

async function runAllTests() {
  console.log('\n=== US-11: PRUEBAS UNITARIAS DE ELECCIÓN DE DÍA Y HORARIO ===\n')

  await test('Esc.1 paso 2: se listan los días del médico agrupados por fecha', () => {
    const dias = agruparDias(TURNOS)
    assert.deepEqual(dias.map((d) => d.fecha).sort(), [
      '2999-11-30', '2999-12-02', '2999-12-03', '3001-03-15',
    ])
  })

  await test('Esc.1 paso 2: seleccionar un día disponible lo deja marcado como elegido', () => {
    const dias = agruparDias(TURNOS)
    const estado = seleccionarDia(dias, '2999-12-02', { diaSeleccionado: '', turnoSeleccionado: null })
    assert.equal(estado.cambio, true)
    assert.equal(estado.diaSeleccionado, '2999-12-02')
  })

  await test('Esc.1 paso 3: seleccionar un horario disponible lo deja seleccionado', () => {
    const horarios = horariosSeleccionables(TURNOS, '2999-12-02')
    const elegido = horarios.find((t) => t.hora === '09:30')
    assert.ok(elegido)
    assert.equal(elegido?.id, 't2')
  })

  await test('Esc.1 paso 3: el resumen del turno se arma como "martes 15 octubre - 09:30 hs"', () => {
    const resumen = armarResumen({ dia: 'martes', numero: 15, mes: 'octubre', hora: '09:30' })
    assert.equal(resumen, 'martes 15 octubre - 09:30 hs')
  })

  await test('Esc.1 paso 3: fechaCorta calcula número y mes correctos', () => {
    const info = fechaCorta('2999-12-02')
    assert.equal(info.numero, 2)
    assert.equal(info.mes, 'diciembre')
    assert.ok(nombresDias.includes(info.dia))
  })

  await test('Esc.1 paso 4: con horario elegido se habilita "Continuar a Confirmación" con el turno correcto', () => {
    assert.equal(puedeContinuar('t2'), true)
    assert.equal(hrefContinuar('t2'), '/dashboard/paciente/reservar-turno/confirmacion?turno=t2')
  })

  await test('Esc.1: cambiar de día resetea el horario seleccionado', () => {
    const dias = agruparDias(TURNOS)
    const estado = seleccionarDia(dias, '2999-12-02', { diaSeleccionado: '', turnoSeleccionado: null })
    const conTurno = { ...estado, turnoSeleccionado: 't2' }
    const cambiado = seleccionarDia(dias, '2999-11-30', conTurno)
    assert.equal(cambiado.turnoSeleccionado, null)
  })

  await test('Esc.2 paso 2: hacer clic en un día agotado no cambia la selección', () => {
    const dias = agruparDias(TURNOS)
    const estado = seleccionarDia(dias, '2999-12-03', { diaSeleccionado: '2999-12-02', turnoSeleccionado: null })
    assert.equal(estado.cambio, false)
    assert.equal(estado.diaSeleccionado, '2999-12-02')
  })

  await test('Esc.2 paso 2: un día agotado no tiene horarios seleccionables', () => {
    assert.equal(horariosSeleccionables(TURNOS, '2999-12-03').length, 0)
  })

  await test('Esc.2 paso 2: sin horario elegido, "Continuar a Confirmación" permanece inactivo', () => {
    assert.equal(puedeContinuar(null), false)
  })

  await test('Esc.2 paso 2: aunque se intente elegir un día agotado, el botón Continuar sigue inactivo', () => {
    const dias = agruparDias(TURNOS)
    let estado: { diaSeleccionado: string; turnoSeleccionado: string | null } = {
      diaSeleccionado: '',
      turnoSeleccionado: null,
    }
    const intento = seleccionarDia(dias, '2999-12-03', estado)
    estado = { diaSeleccionado: intento.diaSeleccionado, turnoSeleccionado: intento.turnoSeleccionado }
    assert.equal(estado.diaSeleccionado, '')
    assert.equal(puedeContinuar(estado.turnoSeleccionado), false)
  })

  await test('Requisito: los turnos ocupados no se ofrecen como horarios disponibles', () => {
    const horas = horariosSeleccionables(TURNOS, '2999-12-02').map((t) => t.hora)
    assert.deepEqual(horas, ['08:00', '09:30'])
    assert.ok(!horas.includes('10:00'))
  })

  await test('Requisito: los turnos pasados se excluyen del listado reservable', () => {
    const reservables = filtrarReservables(TURNOS, HOY, LIMITE)
    assert.ok(!reservables.some((t) => t.fecha === '2999-11-30'))
  })

  await test('Requisito: un día cuyo único turno es pasado no queda disponible', () => {
    const reservables = filtrarReservables(TURNOS, HOY, LIMITE)
    const dias = agruparDias(reservables)
    assert.ok(!dias.some((d) => d.fecha === '2999-11-30'))
  })

  await test('Requisito: los turnos a más de 12 meses se excluyen', () => {
    const reservables = filtrarReservables(TURNOS, HOY, LIMITE)
    assert.ok(!reservables.some((t) => t.fecha === '3001-03-15'))
  })

  await test('Requisito: no se puede confirmar un turno ocupado (estado no DISPONIBLE)', () => {
    const ocupado = TURNOS.find((t) => t.id === 't3')!
    assert.equal(puedeConfirmarTurno(ocupado), false)
  })

  await test('Requisito: no se puede confirmar un turno con paciente ya asignado', () => {
    const asignado: Turno = { id: 'z1', fecha: '2999-12-05', hora: '09:00', duracionMinutos: 30, estado: 'DISPONIBLE', idPaciente: 'pac_1' }
    assert.equal(puedeConfirmarTurno(asignado), false)
  })

  await test('Requisito: sí se puede confirmar un turno DISPONIBLE sin paciente', () => {
    const libre = TURNOS.find((t) => t.id === 't1')!
    assert.equal(puedeConfirmarTurno(libre), true)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-11 PASARON EXITOSAMENTE (18/18) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-11:', error)
  process.exit(1)
})
