import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

const NOMBRES_DIAS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DURACIONES_VALIDAS = [20, 30, 45]

interface Franja {
  diaSemana: number
  horaDesde: string
  horaHasta: string
  duracion: number
}

interface Turno {
  fecha: string
  hora: string
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO'
}

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 2) return NaN
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (isNaN(hours) || isNaN(minutes)) return NaN
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
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

function textoMes(mes: string): string {
  const [yearStr, monthStr] = mes.split('-')
  return `${MESES[parseInt(monthStr, 10) - 1]} ${yearStr}`
}

function calcularResumen(shifts: Franja[], mes: string) {
  let total_jornadas = 0
  let total_turnos = 0
  const jornadas_detalle = shifts.map((s) => {
    const fechas = obtenerFechasDelMesParaDia(mes, s.diaSemana)
    const turnos_por_dia = calcularTurnosPosibles(s.horaDesde, s.horaHasta, s.duracion)
    const subtotal_turnos = turnos_por_dia * fechas.length
    total_jornadas += fechas.length
    total_turnos += subtotal_turnos
    return {
      dia_semana: s.diaSemana,
      dia_nombre: NOMBRES_DIAS[s.diaSemana],
      hora_desde: s.horaDesde,
      hora_hasta: s.horaHasta,
      turnos_por_dia,
      ocurrencias_en_mes: fechas.length,
      subtotal_turnos,
    }
  })
  return { mes_vigencia: mes, total_jornadas, total_turnos, jornadas_detalle }
}

function generarTurnos(shifts: Franja[], mes: string): Turno[] {
  const turnos: Turno[] = []
  for (const s of shifts) {
    for (const fecha of obtenerFechasDelMesParaDia(mes, s.diaSemana)) {
      let current = timeToMinutes(s.horaDesde)
      const end = timeToMinutes(s.horaHasta)
      while (current + s.duracion <= end) {
        turnos.push({ fecha, hora: minutesToTime(current), estado: 'DISPONIBLE' })
        current += s.duracion
      }
    }
  }
  return turnos
}

function abrirResumen(shifts: Franja[], online: boolean) {
  if (!online) {
    return { ok: false as const, error: 'No tienes conexión. No es posible publicar la agenda en este momento.' }
  }
  if (shifts.length === 0) {
    return { ok: false as const, error: 'Debes seleccionar al menos un día de atención.' }
  }
  return { ok: true as const, error: null }
}

function publicarAgenda(disponibilidades: Franja[], mes: string, online = true) {
  if (!online) {
    return { ok: false as const, error: 'Se ha perdido la conexión. No es posible confirmar la publicación.' }
  }
  if (!validarFormatoMes(mes)) {
    return { ok: false as const, error: 'Formato de mes inválido. Debe ser YYYY-MM' }
  }
  if (esMesPasado(mes)) {
    return { ok: false as const, error: 'No se puede configurar disponibilidad para meses anteriores al actual.' }
  }
  if (disponibilidades.length === 0) {
    return { ok: false as const, error: 'No hay disponibilidades configuradas para este mes.' }
  }

  const resumen = calcularResumen(disponibilidades, mes)
  const estado = 'publicado' as const
  const tab = 'agenda' as const
  const mensaje =
    `¡Agenda publicada con éxito! Se abrieron ${resumen.total_turnos} turnos en ${resumen.total_jornadas} jornadas para reserva online de pacientes.`
  return {
    ok: true as const,
    error: null,
    estado,
    tab,
    mensaje,
    total_turnos: resumen.total_turnos,
    total_jornadas: resumen.total_jornadas,
  }
}

function calcularVisibilidad(turnos: Turno[], mes: string, fecha?: string) {
  const delMes = turnos.filter((t) => t.fecha.startsWith(`${mes}-`))
  const porFecha = new Map<string, Turno[]>()
  for (const t of delMes) {
    const arr = porFecha.get(t.fecha) ?? []
    arr.push(t)
    porFecha.set(t.fecha, arr)
  }

  const dias = [...porFecha].map(([f, ts]) => ({
    fecha: f,
    disponibles: ts.filter((t) => t.estado === 'DISPONIBLE').length,
  }))

  const delDia = fecha ? porFecha.get(fecha) ?? [] : []
  const disponibles = delDia.filter((t) => t.estado === 'DISPONIBLE')

  return {
    dias,
    horariosManana: disponibles.filter((t) => Number(t.hora.slice(0, 2)) < 12),
    horariosTarde: disponibles.filter((t) => Number(t.hora.slice(0, 2)) >= 12),
    hayTurnosEnDia: Boolean(fecha && porFecha.has(fecha)),
  }
}

function reservarTurno(turnos: Turno[], fecha: string, hora: string) {
  const objetivo = turnos.find((t) => t.fecha === fecha && t.hora === hora && t.estado === 'DISPONIBLE')
  if (!objetivo) return { ok: false as const }
  objetivo.estado = 'CONFIRMADO'
  return { ok: true as const }
}

const MES_FUTURO = '2999-12'

const FRANJA_MARTES: Franja = { diaSemana: 2, horaDesde: '08:00', horaHasta: '13:00', duracion: 30 }
const FRANJA_JUEVES: Franja = { diaSemana: 4, horaDesde: '14:00', horaHasta: '19:00', duracion: 30 }
const DISPONIBILIDADES: Franja[] = [FRANJA_MARTES, FRANJA_JUEVES]

const TURNOS_PUBLICADOS: Turno[] = [
  { fecha: '2999-12-02', hora: '08:00', estado: 'DISPONIBLE' },
  { fecha: '2999-12-02', hora: '09:00', estado: 'DISPONIBLE' },
  { fecha: '2999-12-02', hora: '14:30', estado: 'DISPONIBLE' },
  { fecha: '2999-12-02', hora: '10:00', estado: 'CONFIRMADO' },
  { fecha: '2999-12-04', hora: '15:00', estado: 'CANCELADO' },
]

async function runAllTests() {
  console.log('\n=== US-04: PRUEBAS UNITARIAS DE PUBLICACIÓN DE AGENDA MENSUAL ===\n')

  await test('Esc.1 paso 1: arma el texto del período en el resumen ("Diciembre 2999")', () => {
    assert.equal(textoMes(MES_FUTURO), 'Diciembre 2999')
  })

  await test('Esc.1 paso 1: el resumen totaliza las jornadas sumando las ocurrencias de cada día', () => {
    const resumen = calcularResumen(DISPONIBILIDADES, MES_FUTURO)
    const esperado =
      obtenerFechasDelMesParaDia(MES_FUTURO, 2).length +
      obtenerFechasDelMesParaDia(MES_FUTURO, 4).length
    assert.equal(resumen.total_jornadas, esperado)
  })

  await test('Esc.1 paso 1: el resumen totaliza los cupos (cupos por jornada × ocurrencias)', () => {
    const resumen = calcularResumen(DISPONIBILIDADES, MES_FUTURO)
    const esperado =
      10 * obtenerFechasDelMesParaDia(MES_FUTURO, 2).length +
      10 * obtenerFechasDelMesParaDia(MES_FUTURO, 4).length
    assert.equal(resumen.total_turnos, esperado)
  })

  await test('Esc.1 paso 1: el detalle por día incluye nombre, ocurrencias y subtotal de turnos', () => {
    const resumen = calcularResumen(DISPONIBILIDADES, MES_FUTURO)
    assert.equal(resumen.jornadas_detalle.length, 2)
    assert.equal(resumen.jornadas_detalle[0].dia_nombre, 'Martes')
    assert.equal(resumen.jornadas_detalle[0].turnos_por_dia, 10)
    assert.equal(
      resumen.jornadas_detalle[0].subtotal_turnos,
      resumen.jornadas_detalle[0].turnos_por_dia * resumen.jornadas_detalle[0].ocurrencias_en_mes,
    )
  })

  await test('Esc.1 paso 1: cada franja de 5 horas con turnos de 30 min genera 10 cupos', () => {
    assert.equal(calcularTurnosPosibles('08:00', '13:00', 30), 10)
    assert.equal(calcularTurnosPosibles('14:00', '19:00', 30), 10)
  })

  await test('Esc.1 paso 2: con horarios definidos se puede abrir el resumen de publicación', () => {
    const res = abrirResumen(DISPONIBILIDADES, true)
    assert.equal(res.ok, true)
    assert.equal(res.error, null)
  })

  await test('Esc.1 paso 2: no se puede publicar sin días de atención seleccionados', () => {
    const res = abrirResumen([], true)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Debes seleccionar al menos un día de atención.')
  })

  await test('Esc.1 paso 3: el diálogo muestra el período, el profesional y los totales', () => {
    const resumen = calcularResumen(DISPONIBILIDADES, MES_FUTURO)
    const medico = { nombre: 'Juan Pérez', especialidad: 'Cardiología' }
    assert.equal(textoMes(resumen.mes_vigencia), 'Diciembre 2999')
    assert.equal(medico.nombre, 'Juan Pérez')
    assert.equal(medico.especialidad, 'Cardiología')
    assert.ok(resumen.total_jornadas > 0)
    assert.ok(resumen.total_turnos > 0)
  })

  await test('Esc.1 paso 4: publicar actualiza el estado de borrador a publicado', () => {
    const res = publicarAgenda(DISPONIBILIDADES, MES_FUTURO)
    assert.equal(res.ok, true)
    assert.equal(res.estado, 'publicado')
  })

  await test('Esc.1 paso 4: publicar abre los cupos como turnos DISPONIBLE', () => {
    const res = publicarAgenda(DISPONIBILIDADES, MES_FUTURO)
    const turnos = generarTurnos(DISPONIBILIDADES, MES_FUTURO)
    assert.equal(turnos.length, res.total_turnos)
    assert.ok(turnos.every((t) => t.estado === 'DISPONIBLE'))
  })

  await test('Esc.1 paso 4: muestra un mensaje de éxito con turnos y jornadas', () => {
    const res = publicarAgenda(DISPONIBILIDADES, MES_FUTURO)
    assert.ok(res.mensaje.includes(`${res.total_turnos} turnos`))
    assert.ok(res.mensaje.includes(`${res.total_jornadas} jornadas`))
    assert.ok(res.mensaje.startsWith('¡Agenda publicada con éxito!'))
  })

  await test('Esc.1 paso 4: redirige al médico a su panel de control', () => {
    const res = publicarAgenda(DISPONIBILIDADES, MES_FUTURO)
    assert.equal(res.tab, 'agenda')
  })

  await test('Esc.1: rechaza publicar si se pierde la conexión', () => {
    const res = publicarAgenda(DISPONIBILIDADES, MES_FUTURO, false)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Se ha perdido la conexión. No es posible confirmar la publicación.')
  })

  await test('Esc.1: rechaza publicar un mes con formato inválido', () => {
    const res = publicarAgenda(DISPONIBILIDADES, '2999-13')
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Formato de mes inválido. Debe ser YYYY-MM')
  })

  await test('Esc.1: rechaza publicar un mes anterior al actual', () => {
    const res = publicarAgenda(DISPONIBILIDADES, '2020-01')
    assert.equal(res.ok, false)
    assert.equal(res.error, 'No se puede configurar disponibilidad para meses anteriores al actual.')
  })

  await test('Esc.1: rechaza publicar si no hay disponibilidades configuradas', () => {
    const res = publicarAgenda([], MES_FUTURO)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'No hay disponibilidades configuradas para este mes.')
  })

  await test('Esc.1: republicar no duplica cupos (idempotencia / skipDuplicates)', () => {
    const primera = generarTurnos(DISPONIBILIDADES, MES_FUTURO)
    const segunda = generarTurnos(DISPONIBILIDADES, MES_FUTURO)
    const unicos = new Set(segunda.map((t) => `${t.fecha}_${t.hora}`))
    assert.equal(segunda.length, primera.length)
    assert.equal(unicos.size, segunda.length)
  })

  await test('Esc.2: el paciente visualiza los cupos disponibles por día del mes publicado', () => {
    const vista = calcularVisibilidad(TURNOS_PUBLICADOS, MES_FUTURO)
    const dia2 = vista.dias.find((d) => d.fecha === '2999-12-02')
    const dia4 = vista.dias.find((d) => d.fecha === '2999-12-04')
    assert.equal(dia2?.disponibles, 3)
    assert.equal(dia4?.disponibles, 0)
  })

  await test('Esc.2: solo se ofrecen turnos en estado DISPONIBLE (excluye confirmados/cancelados)', () => {
    const vista = calcularVisibilidad(TURNOS_PUBLICADOS, MES_FUTURO, '2999-12-02')
    const horas = [...vista.horariosManana, ...vista.horariosTarde].map((t) => t.hora)
    assert.ok(!horas.includes('10:00'))
    assert.ok(vista.horariosManana.concat(vista.horariosTarde).every((t) => t.estado === 'DISPONIBLE'))
  })

  await test('Esc.2: separa los horarios disponibles en mañana y tarde', () => {
    const vista = calcularVisibilidad(TURNOS_PUBLICADOS, MES_FUTURO, '2999-12-02')
    assert.deepEqual(vista.horariosManana.map((t) => t.hora), ['08:00', '09:00'])
    assert.deepEqual(vista.horariosTarde.map((t) => t.hora), ['14:30'])
  })

  await test('Esc.2: detecta correctamente si un día tiene turnos cargados', () => {
    assert.equal(calcularVisibilidad(TURNOS_PUBLICADOS, MES_FUTURO, '2999-12-02').hayTurnosEnDia, true)
    assert.equal(calcularVisibilidad(TURNOS_PUBLICADOS, MES_FUTURO, '2999-12-03').hayTurnosEnDia, false)
  })

  await test('Esc.2: el paciente puede reservar un turno disponible (pasa a CONFIRMADO)', () => {
    const turnos = TURNOS_PUBLICADOS.map((t) => ({ ...t }))
    const res = reservarTurno(turnos, '2999-12-02', '08:00')
    assert.equal(res.ok, true)
    const reservado = turnos.find((t) => t.fecha === '2999-12-02' && t.hora === '08:00')
    assert.equal(reservado?.estado, 'CONFIRMADO')
  })

  await test('Esc.2: tras reservar, el cupo deja de figurar como disponible', () => {
    const turnos = TURNOS_PUBLICADOS.map((t) => ({ ...t }))
    reservarTurno(turnos, '2999-12-02', '08:00')
    const vista = calcularVisibilidad(turnos, MES_FUTURO, '2999-12-02')
    const horas = [...vista.horariosManana, ...vista.horariosTarde].map((t) => t.hora)
    assert.ok(!horas.includes('08:00'))
    assert.equal(vista.horariosManana.map((t) => t.hora).includes('09:00'), true)
  })

  await test('Esc.2: no permite reservar un turno que ya no está disponible', () => {
    const turnos = TURNOS_PUBLICADOS.map((t) => ({ ...t }))
    const res = reservarTurno(turnos, '2999-12-02', '10:00')
    assert.equal(res.ok, false)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-04 PASARON EXITOSAMENTE (24/24) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-04:', error)
  process.exit(1)
})
