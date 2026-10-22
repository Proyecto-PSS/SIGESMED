import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

const DURACIONES_VALIDAS = [20, 30, 45]

interface Franja {
  diaSemana: number
  horaDesde: string
  horaHasta: string
  duracion: number
}

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 2) return NaN
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (isNaN(hours) || isNaN(minutes)) return NaN
  return hours * 60 + minutes
}

function calcularTurnosPosibles(horaDesde: string, horaHasta: string, duracion: number): number {
  const start = timeToMinutes(horaDesde)
  const end = timeToMinutes(horaHasta)
  if (isNaN(start) || isNaN(end) || start >= end) return 0
  if (!DURACIONES_VALIDAS.includes(duracion)) return 0

  let total = 0
  let current = start
  while (current + duracion <= end) {
    total += 1
    current += duracion
  }
  return total
}

function obtenerFechasDelMesParaDia(mes: string, diaSemana: number): string[] {
  const [yearStr, monthStr] = mes.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1

  const fechas: string[] = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    const jsDay = date.getDay()
    if (jsDay >= 1 && jsDay <= 6 && jsDay === diaSemana) {
      const y = date.getFullYear()
      const m = (date.getMonth() + 1).toString().padStart(2, '0')
      const d = date.getDate().toString().padStart(2, '0')
      fechas.push(`${y}-${m}-${d}`)
    }
    date.setDate(date.getDate() + 1)
  }
  return fechas
}

function getMesActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
}

function esMesPasado(mes: string): boolean {
  return mes < getMesActual()
}

function validarFormatoMes(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
}

function toggleDia(seleccionados: number[], dia: number) {
  if (seleccionados.includes(dia)) {
    return { ok: true as const, seleccionados: seleccionados.filter((d) => d !== dia), error: null }
  }
  if (seleccionados.length >= 2) {
    return { ok: false as const, seleccionados, error: 'Solo puedes seleccionar hasta 2 días semanales.' }
  }
  return { ok: true as const, seleccionados: [...seleccionados, dia], error: null }
}

function estadoIndicador(seleccionados: number[]) {
  const count = seleccionados.length
  return { count, maxReached: count >= 2, etiqueta: `${count} / 2 ACTIVOS` }
}

function estaBloqueado(dia: number, seleccionados: number[]): boolean {
  const maxReached = seleccionados.length >= 2
  return maxReached && !seleccionados.includes(dia)
}

function guardarDisponibilidad(shifts: Franja[], mes: string) {
  if (!validarFormatoMes(mes)) {
    return { ok: false as const, error: 'Formato de mes inválido. Debe ser YYYY-MM', turnosGenerados: 0 }
  }
  if (esMesPasado(mes)) {
    return { ok: false as const, error: 'No se puede configurar disponibilidad para meses anteriores al actual.', turnosGenerados: 0 }
  }
  if (shifts.length === 0) {
    return { ok: false as const, error: 'Debes seleccionar al menos un día de atención.', turnosGenerados: 0 }
  }
  if (shifts.length > 2) {
    return { ok: false as const, error: 'No puedes configurar más de 2 días a la semana.', turnosGenerados: 0 }
  }

  let turnosGenerados = 0
  for (const s of shifts) {
    const cupos = calcularTurnosPosibles(s.horaDesde, s.horaHasta, s.duracion)
    const ocurrencias = obtenerFechasDelMesParaDia(mes, s.diaSemana).length
    turnosGenerados += cupos * ocurrencias
  }
  return { ok: true as const, error: null, turnosGenerados }
}

function agregarDiaEnServidor(diasExistentes: number[], diaNuevo: number) {
  const existente = diasExistentes.includes(diaNuevo)
  if (!existente && diasExistentes.length >= 2) {
    return { ok: false as const, error: 'Regla de negocio: Un médico puede configurar un máximo de 2 días de atención por semana.' }
  }
  return { ok: true as const, error: null }
}

const MES_FUTURO = '2999-12'

const FRANJA_MARTES: Franja = { diaSemana: 2, horaDesde: '08:00', horaHasta: '13:00', duracion: 30 }
const FRANJA_JUEVES: Franja = { diaSemana: 4, horaDesde: '14:00', horaHasta: '19:00', duracion: 30 }

async function runAllTests() {
  console.log('\n=== US-03: PRUEBAS UNITARIAS DE CARGA DE HORARIOS MÉDICOS ===\n')

  await test('Esc.2: rechaza seleccionar un tercer día cuando ya hay dos cargados', () => {
    const res = toggleDia([2, 4], 5)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Solo puedes seleccionar hasta 2 días semanales.')
    assert.deepEqual(res.seleccionados, [2, 4])
  })

  await test('permite seleccionar hasta dos días semanales', () => {
    const primero = toggleDia([], 2)
    assert.equal(primero.ok, true)
    const segundo = toggleDia(primero.seleccionados, 4)
    assert.equal(segundo.ok, true)
    assert.equal(segundo.seleccionados.length, 2)
  })

  await test('desmarcar un día ya seleccionado lo quita de la selección', () => {
    const res = toggleDia([2, 4], 2)
    assert.equal(res.ok, true)
    assert.deepEqual(res.seleccionados, [4])
  })

  await test('permite reemplazar un día tras desmarcarlo (no queda trabado)', () => {
    const quitado = toggleDia([2, 4], 2)
    const reemplazado = toggleDia(quitado.seleccionados, 5)
    assert.equal(reemplazado.ok, true)
    assert.deepEqual(reemplazado.seleccionados, [4, 5])
  })

  await test('rechaza guardar el formulario con más de dos días (defensa del guardado)', () => {
    const res = guardarDisponibilidad(
      [FRANJA_MARTES, FRANJA_JUEVES, { diaSemana: 5, horaDesde: '09:00', horaHasta: '12:00', duracion: 30 }],
      MES_FUTURO,
    )
    assert.equal(res.ok, false)
    assert.equal(res.error, 'No puedes configurar más de 2 días a la semana.')
  })

  await test('rechaza guardar sin ningún día seleccionado', () => {
    const res = guardarDisponibilidad([], MES_FUTURO)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Debes seleccionar al menos un día de atención.')
  })

  await test('rechaza configurar un mes anterior al actual', () => {
    const res = guardarDisponibilidad([FRANJA_MARTES], '2020-01')
    assert.equal(res.ok, false)
    assert.equal(res.error, 'No se puede configurar disponibilidad para meses anteriores al actual.')
  })

  await test('servidor: rechaza un tercer día nuevo si el mes ya tiene dos configurados', () => {
    const res = agregarDiaEnServidor([2, 4], 5)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Regla de negocio: Un médico puede configurar un máximo de 2 días de atención por semana.')
  })

  await test('servidor: permite editar un día ya existente aunque haya dos cargados', () => {
    const res = agregarDiaEnServidor([2, 4], 4)
    assert.equal(res.ok, true)
    assert.equal(res.error, null)
  })

  await test('indicador muestra "0 / 2 ACTIVOS" sin días seleccionados', () => {
    assert.equal(estadoIndicador([]).etiqueta, '0 / 2 ACTIVOS')
  })

  await test('indicador muestra "1 / 2 ACTIVOS" con un día seleccionado', () => {
    assert.equal(estadoIndicador([2]).etiqueta, '1 / 2 ACTIVOS')
  })

  await test('indicador muestra "2 / 2 ACTIVOS" y marca el máximo al completar dos días', () => {
    const estado = estadoIndicador([2, 4])
    assert.equal(estado.etiqueta, '2 / 2 ACTIVOS')
    assert.equal(estado.maxReached, true)
  })

  await test('con dos días cargados un día no seleccionado queda bloqueado', () => {
    assert.equal(estaBloqueado(5, [2, 4]), true)
  })

  await test('al desmarcar un día se libera el bloqueo de los demás', () => {
    assert.equal(estaBloqueado(5, [2]), false)
  })

  await test('Esc.1: genera 10 cupos para Martes 08:00-13:00 con turnos de 30 min', () => {
    assert.equal(calcularTurnosPosibles('08:00', '13:00', 30), 10)
  })

  await test('Esc.1: genera 10 cupos para Jueves 14:00-19:00 con turnos de 30 min', () => {
    assert.equal(calcularTurnosPosibles('14:00', '19:00', 30), 10)
  })

  await test('genera cupos con duraciones permitidas de 20 y 45 minutos', () => {
    assert.equal(calcularTurnosPosibles('08:00', '13:00', 20), 15)
    assert.equal(calcularTurnosPosibles('08:00', '12:00', 45), 5)
  })

  await test('no genera cupos si el inicio es mayor o igual al fin', () => {
    assert.equal(calcularTurnosPosibles('13:00', '08:00', 30), 0)
    assert.equal(calcularTurnosPosibles('08:00', '08:00', 30), 0)
  })

  await test('no genera cupos con una duración no permitida', () => {
    assert.equal(calcularTurnosPosibles('08:00', '13:00', 60), 0)
  })

  await test('Esc.1: guardar Martes y Jueves genera el total mensual de cupos', () => {
    const res = guardarDisponibilidad([FRANJA_MARTES, FRANJA_JUEVES], MES_FUTURO)
    const esperado =
      10 * obtenerFechasDelMesParaDia(MES_FUTURO, 2).length +
      10 * obtenerFechasDelMesParaDia(MES_FUTURO, 4).length
    assert.equal(res.ok, true)
    assert.equal(res.turnosGenerados, esperado)
  })

  await test('valida el formato del mes de planificación (YYYY-MM)', () => {
    assert.equal(validarFormatoMes('2026-10'), true)
    assert.equal(validarFormatoMes('2026-13'), false)
    assert.equal(validarFormatoMes('26-10'), false)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-03 PASARON EXITOSAMENTE (21/21) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-03:', error)
  process.exit(1)
})
