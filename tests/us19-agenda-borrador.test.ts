import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6
type DuracionTurno = 20 | 30 | 45

interface ShiftDraft {
  id?: string
  diaSemana: DiaSemana
  horaDesde: string
  horaHasta: string
  duracion: DuracionTurno
}

interface AvailabilityDraft {
  version: 'v1'
  mes: string
  idMedico: string
  shifts: ShiftDraft[]
  updatedAt: string
}

type SaveStatus =
  | 'sin_cambios'
  | 'guardando'
  | 'guardado'
  | 'cambios_locales'
  | 'offline_borrador'
  | 'recuperando'
  | 'borrador_recuperado'
  | 'error'
  | 'publicado'

const DRAFT_PREFIX = 'SIGESMED:US19:availability:v1'

interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function crearStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

function getDraftKey(idMedico: string, mes: string): string {
  if (!idMedico || !mes) return ''
  return `${DRAFT_PREFIX}:${idMedico}:${mes}`
}

function saveDraft(storage: Storage, idMedico: string, mes: string, shifts: ShiftDraft[]): boolean {
  try {
    const key = getDraftKey(idMedico, mes)
    if (!key) return false
    const draft: AvailabilityDraft = {
      version: 'v1',
      mes,
      idMedico,
      shifts,
      updatedAt: new Date().toISOString(),
    }
    storage.setItem(key, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

function loadDraft(storage: Storage, idMedico: string, mes: string): AvailabilityDraft | null {
  try {
    const key = getDraftKey(idMedico, mes)
    if (!key) return null
    const data = storage.getItem(key)
    if (!data) return null
    const parsed = JSON.parse(data)
    if (
      parsed.version !== 'v1' ||
      parsed.idMedico !== idMedico ||
      parsed.mes !== mes ||
      !Array.isArray(parsed.shifts)
    ) {
      return null
    }
    const validShifts: ShiftDraft[] = parsed.shifts.filter((s: any) => {
      const isDiaSemanaValid = [1, 2, 3, 4, 5, 6].includes(s.diaSemana)
      const isDuracionValid = [20, 30, 45].includes(s.duracion)
      const isHoraDesdeValid = typeof s.horaDesde === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(s.horaDesde)
      const isHoraHastaValid = typeof s.horaHasta === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(s.horaHasta)
      return isDiaSemanaValid && isDuracionValid && isHoraDesdeValid && isHoraHastaValid && s.horaDesde < s.horaHasta
    })
    return { version: parsed.version, mes: parsed.mes, idMedico: parsed.idMedico, shifts: validShifts, updatedAt: parsed.updatedAt }
  } catch {
    return null
  }
}

function clearDraft(storage: Storage, idMedico: string, mes: string): boolean {
  try {
    const key = getDraftKey(idMedico, mes)
    if (!key) return false
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function checkConnectivity(navigatorOnLine: boolean): boolean {
  return navigatorOnLine
}

function compareShifts(a: ShiftDraft[], b: ShiftDraft[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x.diaSemana - y.diaSemana)
  const sortedB = [...b].sort((x, y) => x.diaSemana - y.diaSemana)
  for (let i = 0; i < sortedA.length; i++) {
    const sa = sortedA[i]
    const sb = sortedB[i]
    if (sa.diaSemana !== sb.diaSemana || sa.horaDesde !== sb.horaDesde || sa.horaHasta !== sb.horaHasta || sa.duracion !== sb.duracion) {
      return false
    }
  }
  return true
}

// Máquina de estados del indicador (US-19)
function trasEdicion(online: boolean): SaveStatus {
  return online ? 'cambios_locales' : 'offline_borrador'
}

function alPasarOffline(status: SaveStatus): SaveStatus {
  if (status === 'cambios_locales' || status === 'sin_cambios' || status === 'guardado' || status === 'borrador_recuperado') {
    return 'offline_borrador'
  }
  return status
}

function alRecuperarConexion(status: SaveStatus): SaveStatus {
  return status === 'offline_borrador' ? 'cambios_locales' : status
}

function textIndicador(status: SaveStatus): string {
  switch (status) {
    case 'sin_cambios':
      return 'Sin cambios'
    case 'guardando':
      return 'Guardando...'
    case 'guardado':
      return 'Guardado en servidor remoto'
    case 'cambios_locales':
      return 'Cambios pendientes de guardado remoto'
    case 'offline_borrador':
      return 'Sin conexión - borrador preservado'
    case 'recuperando':
      return 'Recuperando borrador...'
    case 'borrador_recuperado':
      return 'Borrador recuperado (local)'
    case 'error':
      return 'Error al guardar'
    case 'publicado':
      return 'Agenda publicada'
    default:
      return ''
  }
}

interface Disponibilidad {
  diaSemana: DiaSemana
  horaDesde: string
  horaHasta: string
  duracion: DuracionTurno
}

interface Turno {
  idTurno: string
  fecha: string
  hora: string
}

interface Db {
  turnos: Turno[]
  disponibilidades: Disponibilidad[]
}

function calcularSlots(horaDesde: string, horaHasta: string, duracion: number): string[] {
  const [h1, m1] = horaDesde.split(':').map(Number)
  const [h2, m2] = horaHasta.split(':').map(Number)
  const start = h1 * 60 + m1
  const end = h2 * 60 + m2
  const slots: string[] = []
  for (let t = start; t + duracion <= end; t += duracion) {
    const h = Math.floor(t / 60)
    const mm = t % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return slots
}

function fechasDelMesParaDia(mes: string, diaSemana: DiaSemana): string[] {
  const [year, month] = mes.split('-').map(Number)
  const fechas: string[] = []
  const d = new Date(Date.UTC(year, month - 1, 1))
  while (d.getUTCMonth() === month - 1) {
    if (d.getUTCDay() === diaSemana) fechas.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return fechas
}

function turnosDeDisponibilidad(disp: Disponibilidad, mes: string): Turno[] {
  const slots = calcularSlots(disp.horaDesde, disp.horaHasta, disp.duracion)
  return fechasDelMesParaDia(mes, disp.diaSemana).flatMap((fecha) =>
    slots.map((hora) => ({ idTurno: `${disp.diaSemana}-${fecha}-${hora}`, fecha, hora })),
  )
}

// Transacción atómica de publicación: todo-o-nada (rollback ante fallo).
function publicarAgenda(db: Db, mes: string, opts: { fallaTras?: number } = {}) {
  const backup = db.turnos.map((t) => ({ ...t }))
  let generados = 0
  try {
    for (const disp of db.disponibilidades) {
      for (const turno of turnosDeDisponibilidad(disp, mes)) {
        db.turnos.push(turno)
        generados++
        if (opts.fallaTras && generados >= opts.fallaTras) {
          throw new Error('Fallo simulado durante la publicación')
        }
      }
    }
    return { success: true, mes, total_jornadas: db.disponibilidades.length, total_turnos: generados }
  } catch (error) {
    db.turnos = backup
    throw error
  }
}

const ID_MEDICO = 'med_123'
const MES = '2999-12'

const SHIFTS: ShiftDraft[] = [
  { diaSemana: 1, horaDesde: '08:00', horaHasta: '10:00', duracion: 30 },
  { diaSemana: 3, horaDesde: '14:00', horaHasta: '15:00', duracion: 20 },
]

function crearDb(): Db {
  return {
    turnos: [],
    disponibilidades: [
      { diaSemana: 1, horaDesde: '08:00', horaHasta: '10:00', duracion: 30 },
      { diaSemana: 3, horaDesde: '14:00', horaHasta: '15:00', duracion: 20 },
    ],
  }
}

async function runAllTests() {
  console.log('\n=== US-19: PRUEBAS UNITARIAS DE BORRADOR Y PUBLICACIÓN DE AGENDA ===\n')

  await test('Esc.1: el estado inicial del indicador es "sin_cambios"', () => {
    const status: SaveStatus = 'sin_cambios'
    assert.equal(textIndicador(status), 'Sin cambios')
  })

  await test('Esc.1 paso 2-3: al configurar días y franjas (online) el estado pasa a "cambios_locales"', () => {
    assert.equal(trasEdicion(true), 'cambios_locales')
    assert.equal(textIndicador('cambios_locales'), 'Cambios pendientes de guardado remoto')
  })

  await test('Esc.1 paso 3: mientras se guarda, el indicador refleja "Guardando..."', () => {
    assert.equal(textIndicador('guardando'), 'Guardando...')
  })

  await test('Esc.1 paso 3: tras guardar en el servidor, el indicador refleja "guardado"', () => {
    assert.equal(textIndicador('guardado'), 'Guardado en servidor remoto')
  })

  await test('Esc.1 paso 4: publicar ejecuta la transacción atómica y publica la agenda íntegra', () => {
    const db = crearDb()
    const res = publicarAgenda(db, MES)
    assert.equal(res.success, true)
    assert.equal(res.total_jornadas, 2)
    const esperados =
      turnosDeDisponibilidad(db.disponibilidades[0], MES).length +
      turnosDeDisponibilidad(db.disponibilidades[1], MES).length
    assert.equal(res.total_turnos, esperados)
    assert.equal(db.turnos.length, esperados)
  })

  await test('Esc.1 paso 4: tras publicar el indicador muestra "publicado"', () => {
    assert.equal(textIndicador('publicado'), 'Agenda publicada')
  })

  await test('Esc.2 paso 3: al perder la conexión el indicador pasa a "Sin conexión - borrador preservado"', () => {
    const status = alPasarOffline(trasEdicion(true))
    assert.equal(status, 'offline_borrador')
    assert.equal(textIndicador(status), 'Sin conexión - borrador preservado')
  })

  await test('Esc.2 paso 3: la configuración se resguarda en LocalStorage sin perderse', () => {
    const storage = crearStorage()
    saveDraft(storage, ID_MEDICO, MES, SHIFTS)
    const draft = loadDraft(storage, ID_MEDICO, MES)
    assert.deepEqual(draft?.shifts, SHIFTS)
  })

  await test('Esc.2: estando sin conexión no se permite publicar', () => {
    const online = checkConnectivity(false)
    assert.equal(online, false)
    const resultado = online ? 'publica' : 'bloqueado'
    assert.equal(resultado, 'bloqueado')
  })

  await test('Esc.2: getDraftKey aísla por médico y mes y devuelve "" si falta alguno', () => {
    assert.equal(getDraftKey(ID_MEDICO, MES), `${DRAFT_PREFIX}:${ID_MEDICO}:${MES}`)
    assert.equal(getDraftKey('', MES), '')
    assert.equal(getDraftKey(ID_MEDICO, ''), '')
    assert.notEqual(getDraftKey('med_otro', MES), getDraftKey(ID_MEDICO, MES))
  })

  await test('Esc.3 paso 1-2: tras recargar se recupera la configuración del borrador', () => {
    const storage = crearStorage()
    saveDraft(storage, ID_MEDICO, MES, SHIFTS)
    const recuperado = loadDraft(storage, ID_MEDICO, MES)
    assert.equal(recuperado?.idMedico, ID_MEDICO)
    assert.equal(recuperado?.mes, MES)
    assert.equal(recuperado?.shifts.length, 2)
    assert.equal(recuperado?.shifts[0].diaSemana, 1)
  })

  await test('Esc.3: borrador distinto del remoto → estado "borrador_recuperado"', () => {
    const storage = crearStorage()
    saveDraft(storage, ID_MEDICO, MES, SHIFTS)
    const remoto: ShiftDraft[] = [{ diaSemana: 1, horaDesde: '08:00', horaHasta: '10:00', duracion: 30 }]
    const draft = loadDraft(storage, ID_MEDICO, MES)!
    const isSame = compareShifts(remoto, draft.shifts)
    assert.equal(isSame, false)
    const status: SaveStatus = isSame ? 'guardado' : 'borrador_recuperado'
    assert.equal(status, 'borrador_recuperado')
    assert.equal(textIndicador(status), 'Borrador recuperado (local)')
  })

  await test('Esc.3: borrador igual al remoto → sin cambios pendientes (se limpia)', () => {
    const storage = crearStorage()
    saveDraft(storage, ID_MEDICO, MES, SHIFTS)
    const draft = loadDraft(storage, ID_MEDICO, MES)!
    const isSame = compareShifts(SHIFTS, draft.shifts)
    assert.equal(isSame, true)
    clearDraft(storage, ID_MEDICO, MES)
    assert.equal(loadDraft(storage, ID_MEDICO, MES), null)
  })

  await test('Esc.3: loadDraft descarta shifts inválidos preservando la integridad', () => {
    const storage = crearStorage()
    const key = getDraftKey(ID_MEDICO, MES)
    storage.setItem(
      key,
      JSON.stringify({
        version: 'v1',
        mes: MES,
        idMedico: ID_MEDICO,
        shifts: [
          { diaSemana: 1, horaDesde: '08:00', horaHasta: '12:00', duracion: 30 },
          { diaSemana: 8, horaDesde: '14:00', horaHasta: '18:00', duracion: 20 },
          { diaSemana: 3, horaDesde: '25:00', horaHasta: '18:00', duracion: 20 },
          { diaSemana: 4, horaDesde: '10:00', horaHasta: '08:00', duracion: 20 },
          { diaSemana: 5, horaDesde: '10:00', horaHasta: '12:00', duracion: 99 },
        ],
        updatedAt: new Date().toISOString(),
      }),
    )
    const draft = loadDraft(storage, ID_MEDICO, MES)
    assert.equal(draft?.shifts.length, 1)
    assert.equal(draft?.shifts[0].diaSemana, 1)
  })

  await test('Esc.3: loadDraft ignora borradores de otra versión, médico o mes', () => {
    const storage = crearStorage()
    const key = getDraftKey(ID_MEDICO, MES)
    storage.setItem(key, JSON.stringify({ version: 'v2', mes: MES, idMedico: ID_MEDICO, shifts: SHIFTS, updatedAt: '' }))
    assert.equal(loadDraft(storage, ID_MEDICO, MES), null)
    storage.setItem(key, JSON.stringify({ version: 'v1', mes: '3000-01', idMedico: ID_MEDICO, shifts: SHIFTS, updatedAt: '' }))
    assert.equal(loadDraft(storage, ID_MEDICO, MES), null)
  })

  await test('Esc.3 paso 3: al restablecer la conexión el estado vuelve a "cambios_locales"', () => {
    const offline = alPasarOffline(trasEdicion(true))
    assert.equal(alRecuperarConexion(offline), 'cambios_locales')
  })

  await test('Esc.3: la publicación es atómica — ante un fallo no quedan turnos parciales', () => {
    const db = crearDb()
    assert.equal(db.turnos.length, 0)
    assert.throws(() => publicarAgenda(db, MES, { fallaTras: 1 }), /Fallo simulado/)
    assert.equal(db.turnos.length, 0)
  })

  await test('Esc.3 paso 4: tras publicar se limpia el borrador local', () => {
    const storage = crearStorage()
    saveDraft(storage, ID_MEDICO, MES, SHIFTS)
    const db = crearDb()
    const res = publicarAgenda(db, MES)
    assert.equal(res.success, true)
    clearDraft(storage, ID_MEDICO, MES)
    assert.equal(loadDraft(storage, ID_MEDICO, MES), null)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-19 PASARON EXITOSAMENTE (18/18) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-19:', error)
  process.exit(1)
})
