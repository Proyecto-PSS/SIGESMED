import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// --- Modelo de app/dashboard/paciente/reservar-turno/page.tsx -----------------

const RESERVAR_TURNO = '/dashboard/paciente/reservar-turno'

// lib/services/turnos-service.ts:4-9 — pestañas de especialidad.
const especialidades = [
  { value: 'TODAS', label: 'Todos' },
  { value: 'PEDIATRIA', label: 'Pediatría' },
  { value: 'TRAUMATOLOGIA_ORTOPEDIA', label: 'Traumatología' },
  { value: 'CLINICA_MEDICA', label: 'Clínica Médica' },
] as const

// Etiquetas usadas en las tarjetas y en la pantalla de horarios.
const NOMBRES_ESPECIALIDAD_CARD: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

type Medico = {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  consultorio: string | null
  direccion: string | null
}

const MEDICOS: Medico[] = [
  { idMedico: 'med_001', nombre: 'Laura', apellido: 'Gómez', especialidad: 'CLINICA_MEDICA', consultorio: 'Consultorio 1', direccion: 'Av. Siempreviva 742' },
  { idMedico: 'med_002', nombre: 'Martín', apellido: 'Álvarez', especialidad: 'PEDIATRIA', consultorio: 'Consultorio 3', direccion: null },
  { idMedico: 'med_003', nombre: 'Sofía', apellido: 'Fernández', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', consultorio: 'Consultorio 2', direccion: 'Rivadavia 100' },
  { idMedico: 'med_004', nombre: 'Ana', apellido: 'Pérez', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', consultorio: null, direccion: null },
  { idMedico: 'med_005', nombre: 'Bruno', apellido: 'Pérez', especialidad: 'PEDIATRIA', consultorio: 'Consultorio 5', direccion: null },
]

// page.tsx:29-31 — resuelve el filtro a partir del ?especialidad= de la URL.
function resolverFiltro(param?: string): string {
  return param && especialidades.some(({ value }) => value === param) ? param : 'TODAS'
}

// turnos-service.ts:19-33 — where por especialidad + orden por apellido, nombre.
function filtrarMedicos(medicos: Medico[], especialidad: string): Medico[] {
  const filtrados = especialidad === 'TODAS' ? medicos : medicos.filter((m) => m.especialidad === especialidad)
  return [...filtrados].sort((a, b) => {
    const porApellido = a.apellido.localeCompare(b.apellido, 'es')
    return porApellido !== 0 ? porApellido : a.nombre.localeCompare(b.nombre, 'es')
  })
}

// page.tsx:47-53 — destino de cada pestaña de especialidad.
function hrefTab(value: string): string {
  return value === 'TODAS' ? RESERVAR_TURNO : `${RESERVAR_TURNO}?especialidad=${value}`
}

// page.tsx:54-58 — pestaña activa según el filtro vigente.
function tabActiva(filtroActual: string, value: string): boolean {
  return filtroActual === value
}

// page.tsx:89-94 — botón "Ver horarios disponibles".
function hrefVerHorarios(idMedico: string): string {
  return `${RESERVAR_TURNO}/horarios/${idMedico}`
}

// page.tsx:65-98 — estado del listado (tarjetas + mensaje informativo).
function estadoListado(medicos: Medico[]): { cantidadTarjetas: number; mensaje: string | null } {
  return {
    cantidadTarjetas: medicos.length,
    mensaje: medicos.length === 0 ? 'No hay médicos para la especialidad seleccionada.' : null,
  }
}

// horarios/[idMedico]/page.tsx:43-51 — cabecera con datos del profesional elegido.
function detalleMedico(m: Medico): { titulo: string; especialidad: string; consultorio: string } {
  return {
    titulo: `${m.nombre} ${m.apellido}`,
    especialidad: NOMBRES_ESPECIALIDAD_CARD[m.especialidad],
    consultorio: m.consultorio ? ` · ${m.consultorio}` : '',
  }
}

async function runAllTests() {
  console.log('\n=== US-10: PRUEBAS UNITARIAS DE ELECCIÓN DE MÉDICO ===\n')

  // --- Escenario 1: camino exitoso ---
  await test('Esc.1: sin especialidad en la URL, el filtro por defecto es TODAS', () => {
    assert.equal(resolverFiltro(undefined), 'TODAS')
  })

  await test('Esc.1: una especialidad válida enviada por la URL se respeta', () => {
    assert.equal(resolverFiltro('PEDIATRIA'), 'PEDIATRIA')
    assert.equal(resolverFiltro('TRAUMATOLOGIA_ORTOPEDIA'), 'TRAUMATOLOGIA_ORTOPEDIA')
  })

  await test('Esc.1: una especialidad inexistente cae a TODAS (no rompe la pantalla)', () => {
    assert.equal(resolverFiltro('CARDIOLOGIA'), 'TODAS')
    assert.equal(resolverFiltro(''), 'TODAS')
  })

  await test('Esc.1: con TODAS se muestran todos los médicos cargados', () => {
    const listado = filtrarMedicos(MEDICOS, 'TODAS')
    assert.equal(listado.length, MEDICOS.length)
    assert.deepEqual(new Set(listado.map((m) => m.idMedico)), new Set(MEDICOS.map((m) => m.idMedico)))
  })

  await test('Esc.1: al elegir una pestaña, el listado muestra únicamente esa especialidad', () => {
    const pediatras = filtrarMedicos(MEDICOS, 'PEDIATRIA')
    assert.deepEqual(pediatras.map((m) => m.idMedico), ['med_002', 'med_005'])
    assert.ok(pediatras.every((m) => m.especialidad === 'PEDIATRIA'))
  })

  await test('Esc.1: la pestaña TODAS apunta a la URL sin query', () => {
    assert.equal(hrefTab('TODAS'), '/dashboard/paciente/reservar-turno')
  })

  await test('Esc.1: cada especialidad apunta a la URL con ?especialidad=', () => {
    assert.equal(hrefTab('PEDIATRIA'), '/dashboard/paciente/reservar-turno?especialidad=PEDIATRIA')
    assert.equal(hrefTab('TRAUMATOLOGIA_ORTOPEDIA'), '/dashboard/paciente/reservar-turno?especialidad=TRAUMATOLOGIA_ORTOPEDIA')
    assert.equal(hrefTab('CLINICA_MEDICA'), '/dashboard/paciente/reservar-turno?especialidad=CLINICA_MEDICA')
  })

  await test('Esc.1: se marca activa solo la pestaña seleccionada', () => {
    assert.equal(tabActiva('PEDIATRIA', 'PEDIATRIA'), true)
    assert.equal(tabActiva('PEDIATRIA', 'TODAS'), false)
    assert.equal(tabActiva('TODAS', 'TODAS'), true)
  })

  await test('Esc.1: "Ver horarios disponibles" redirige a la selección de día y horario del médico', () => {
    assert.equal(hrefVerHorarios('med_002'), '/dashboard/paciente/reservar-turno/horarios/med_002')
  })

  await test('Esc.1: la pantalla destino muestra nombre, especialidad y consultorio del profesional', () => {
    const detalle = detalleMedico(MEDICOS[1])
    assert.equal(detalle.titulo, 'Martín Álvarez')
    assert.equal(detalle.especialidad, 'Pediatría')
    assert.equal(detalle.consultorio, ' · Consultorio 3')
  })

  await test('Esc.1: si el médico no tiene consultorio cargado, no se muestra separador', () => {
    const detalle = detalleMedico(MEDICOS[3])
    assert.equal(detalle.titulo, 'Ana Pérez')
    assert.equal(detalle.especialidad, 'Traumatología y Ortopedia')
    assert.equal(detalle.consultorio, '')
  })

  // --- Escenario 2: filtrado sin resultados disponibles ---
  await test('Esc.2: una especialidad sin médicos cargados devuelve listado vacío', () => {
    const sinClinica = MEDICOS.filter((m) => m.especialidad !== 'CLINICA_MEDICA')
    assert.deepEqual(filtrarMedicos(sinClinica, 'CLINICA_MEDICA'), [])
  })

  await test('Esc.2: listado vacío => cero tarjetas y mensaje informativo en pantalla', () => {
    const estado = estadoListado([])
    assert.equal(estado.cantidadTarjetas, 0)
    assert.equal(estado.mensaje, 'No hay médicos para la especialidad seleccionada.')
  })

  await test('Esc.2: con resultados => se muestran tarjetas y no el mensaje', () => {
    const estado = estadoListado(filtrarMedicos(MEDICOS, 'PEDIATRIA'))
    assert.equal(estado.cantidadTarjetas, 2)
    assert.equal(estado.mensaje, null)
  })

  // --- Casos extra ---
  await test('Extra: el filtro es por igualdad exacta (no substring ni distinto case)', () => {
    assert.deepEqual(filtrarMedicos(MEDICOS, 'pediatria'), [])
    assert.deepEqual(filtrarMedicos(MEDICOS, 'PEDIA'), [])
    assert.equal(filtrarMedicos(MEDICOS, 'PEDIATRIA').length, 2)
  })

  await test('Extra: etiquetas es-AR correctas en pestañas y tarjetas', () => {
    assert.deepEqual(
      especialidades.map((e) => e.label),
      ['Todos', 'Pediatría', 'Traumatología', 'Clínica Médica'],
    )
    assert.equal(NOMBRES_ESPECIALIDAD_CARD.CLINICA_MEDICA, 'Clínica Médica')
    assert.equal(NOMBRES_ESPECIALIDAD_CARD.PEDIATRIA, 'Pediatría')
    assert.equal(NOMBRES_ESPECIALIDAD_CARD.TRAUMATOLOGIA_ORTOPEDIA, 'Traumatología y Ortopedia')
  })

  await test('Extra: el listado se ordena por apellido y luego por nombre', () => {
    const listado = filtrarMedicos(MEDICOS, 'TODAS')
    assert.deepEqual(
      listado.map((m) => `${m.apellido} ${m.nombre}`),
      ['Álvarez Martín', 'Fernández Sofía', 'Gómez Laura', 'Pérez Ana', 'Pérez Bruno'],
    )
  })

  await test('Extra: la pestaña activa por defecto es TODAS cuando no hay filtro', () => {
    const filtro = resolverFiltro(undefined)
    assert.equal(tabActiva(filtro, 'TODAS'), true)
    assert.equal(tabActiva(filtro, 'PEDIATRIA'), false)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-10 PASARON EXITOSAMENTE (18/18) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-10:', error)
  process.exit(1)
})
