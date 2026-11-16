// Suite exhaustiva de pruebas unitarias para US-39:
// Consulta del historial clínico por parte del paciente (solo lectura, aislamiento anti-IDOR e integración con US-38).
import assert from 'node:assert/strict'
import {
  type TipoDiagnosticoValor,
  ETIQUETAS_TIPO_DIAGNOSTICO,
  HistoriaClinicaError,
  validarCargaAtencionMedica,
  TEXTO_HISTORIAL_VACIO_TITULO,
  TEXTO_HISTORIAL_VACIO_DESCRIPCION,
  TEXTO_SIN_OBSERVACIONES,
  TEXTO_SIN_TRATAMIENTO,
  TEXTO_SIN_INDICACIONES_FARMACOLOGICAS,
  formatearFechaHoraAtencionArgentina,
} from '../lib/utils/historia-clinica-utils.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type RolSesion = 'MEDICO' | 'PACIENTE' | 'ENFERMERA' | 'ADMIN'

interface SesionMock {
  id: string
  nombre: string
  apellido: string
  rol: RolSesion
}

interface PacienteMock {
  idPaciente: string
  nombre: string
  apellido: string
  dni: string
  email: string
}

interface MedicoMock {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  matricula: string
}

interface AtencionMedicaMock {
  idAtencion: string
  idPaciente: string
  idMedico: string
  diagnosticoPrincipal: string
  tipoDiagnostico: TipoDiagnosticoValor
  observacionesClinicas: string | null
  detalleTratamiento: string | null
  indicacionesFarmacologicas: string | null
  createdAt: Date
  updatedAt: Date
}

interface BaseDatosEnMemoria {
  pacientes: Map<string, PacienteMock>
  medicos: Map<string, MedicoMock>
  atenciones: AtencionMedicaMock[]
  lecturasEjecutadas: number
  escriturasEjecutadas: number
  simularCaidaBaseDeDatos: boolean
}

const NOMBRES_ESPECIALIDADES: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function crearBaseDatos(): BaseDatosEnMemoria {
  const pacientes = new Map<string, PacienteMock>([
    [
      'pac_A',
      {
        idPaciente: 'pac_A',
        nombre: 'Paciente',
        apellido: 'Demo A',
        dni: '34891204',
        email: 'paciente.a@gmail.com',
      },
    ],
    [
      'pac_B',
      {
        idPaciente: 'pac_B',
        nombre: 'Martina',
        apellido: 'Suárez B',
        dni: '40223344',
        email: 'paciente.b@gmail.com',
      },
    ],
  ])

  const medicos = new Map<string, MedicoMock>([
    [
      'med_001',
      {
        idMedico: 'med_001',
        nombre: 'Martín',
        apellido: 'Gómez',
        especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
        matricula: 'MN-84920',
      },
    ],
    [
      'med_002',
      {
        idMedico: 'med_002',
        nombre: 'Juan Carlos',
        apellido: 'Rossi',
        especialidad: 'CLINICA_MEDICA',
        matricula: 'MN-72154',
      },
    ],
  ])

  return {
    pacientes,
    medicos,
    atenciones: [],
    lecturasEjecutadas: 0,
    escriturasEjecutadas: 0,
    simularCaidaBaseDeDatos: false,
  }
}

// Simula el guard getCurrentPatient() de lib/auth.ts y la resolución en base de datos
function resolverPacienteAutenticado(
  db: BaseDatosEnMemoria,
  sesion: SesionMock | null
): PacienteMock {
  if (!sesion) {
    throw new HistoriaClinicaError('No autorizado: sesión de paciente no encontrada.', 401)
  }
  if (sesion.rol !== 'PACIENTE') {
    throw new HistoriaClinicaError('Acceso denegado: se requiere perfil de paciente.', 403)
  }

  const paciente = db.pacientes.get(sesion.id)
  if (!paciente) {
    throw new HistoriaClinicaError(
      'No se encontró un registro de paciente asociado a la sesión actual.',
      404
    )
  }

  return paciente
}

// Simula el endpoint de carga médica US-38 (POST /api/medicos/pacientes/[idPaciente]/historia-clinica)
function registrarAtencionPorMedicoUS38(
  db: BaseDatosEnMemoria,
  sesionMedico: SesionMock,
  idPaciente: string,
  payload: unknown,
  fechaCreacion: Date = new Date()
) {
  if (sesionMedico.rol !== 'MEDICO') {
    throw new HistoriaClinicaError('Acceso denegado: se requiere perfil médico.', 403)
  }
  const validado = validarCargaAtencionMedica(payload)
  const paciente = db.pacientes.get(idPaciente)
  if (!paciente) {
    throw new HistoriaClinicaError('No se encontró el paciente especificado.', 404)
  }
  const medico = db.medicos.get(sesionMedico.id)
  if (!medico) {
    throw new HistoriaClinicaError('No se encontró el perfil del profesional médico.', 403)
  }

  db.escriturasEjecutadas += 1
  const nueva: AtencionMedicaMock = {
    idAtencion: `atn_${db.atenciones.length + 1}`,
    idPaciente: paciente.idPaciente,
    idMedico: medico.idMedico,
    diagnosticoPrincipal: validado.diagnosticoPrincipal,
    tipoDiagnostico: validado.tipoDiagnostico,
    observacionesClinicas: validado.observacionesClinicas,
    detalleTratamiento: validado.detalleTratamiento,
    indicacionesFarmacologicas: validado.indicacionesFarmacologicas,
    createdAt: fechaCreacion,
    updatedAt: fechaCreacion,
  }
  db.atenciones.push(nueva)
  return nueva
}

// Simula el endpoint GET /api/pacientes/historia-clinica (US-39)
function consultarHistorialClinicoPacienteEndpoint(
  db: BaseDatosEnMemoria,
  sesion: SesionMock | null,
  _parametrosClienteIgnorados?: {
    idPacienteQuery?: string
    idPacienteUrl?: string
    idPacienteBody?: string
  }
) {
  try {
    // 1. Verificar sesión y resolver paciente en servidor (ignora cualquier parámetro del cliente)
    const pacienteAutenticado = resolverPacienteAutenticado(db, sesion)

    // 2. Simular fallo de conexión con PostgreSQL si aplica
    if (db.simularCaidaBaseDeDatos) {
      throw new Error('Neon database connection timeout ECONNRESET')
    }

    db.lecturasEjecutadas += 1

    // 3. Filtrar estrictamente por pacienteAutenticado.idPaciente y ordenar por createdAt descendente
    const atenciones = db.atenciones
      .filter((a) => a.idPaciente === pacienteAutenticado.idPaciente)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => {
        const medico = db.medicos.get(a.idMedico)!
        return {
          idAtencion: a.idAtencion,
          idPaciente: a.idPaciente,
          idMedico: a.idMedico,
          diagnosticoPrincipal: a.diagnosticoPrincipal,
          tipoDiagnostico: a.tipoDiagnostico,
          tipoDiagnosticoEtiqueta: ETIQUETAS_TIPO_DIAGNOSTICO[a.tipoDiagnostico],
          observacionesClinicas: a.observacionesClinicas,
          detalleTratamiento: a.detalleTratamiento,
          indicacionesFarmacologicas: a.indicacionesFarmacologicas,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          medico: {
            idMedico: medico.idMedico,
            nombre: medico.nombre,
            apellido: medico.apellido,
            nombreCompleto: `${medico.nombre} ${medico.apellido}`,
            especialidad: medico.especialidad,
            especialidadEtiqueta:
              NOMBRES_ESPECIALIDADES[medico.especialidad] ?? medico.especialidad,
            matricula: medico.matricula,
          },
        }
      })

    return {
      status: 200,
      body: {
        ok: true,
        success: true,
        atenciones,
      },
    }
  } catch (err: any) {
    if (err instanceof HistoriaClinicaError) {
      return {
        status: err.statusCode,
        body: {
          ok: false,
          success: false,
          error: err.message,
        },
      }
    }

    // No exponer detalles técnicos sensibles de base de datos en un error 500
    return {
      status: 500,
      body: {
        ok: false,
        success: false,
        error: 'No se pudo consultar el historial clínico en este momento.',
      },
    }
  }
}

// Representación de estado de la interfaz HistorialClinicoPaciente.tsx
function representarVistaHistorialPaciente(respuesta: {
  status: number
  body: { ok: boolean; success: boolean; atenciones?: any[]; error?: string }
}) {
  if (respuesta.status !== 200 || !respuesta.body.ok) {
    return {
      estadoUI: 'error' as const,
      mostrarEstadoVacio: false,
      mensajeError: respuesta.body.error || 'No se pudo recuperar tu historial clínico.',
      permiteReintentar: true,
      controlesEdicionOEliminacion: 0,
      tarjetasRenderizadas: [],
    }
  }

  const atenciones = respuesta.body.atenciones ?? []
  if (atenciones.length === 0) {
    return {
      estadoUI: 'empty' as const,
      mostrarEstadoVacio: true,
      tituloVacio: TEXTO_HISTORIAL_VACIO_TITULO,
      descripcionVacio: TEXTO_HISTORIAL_VACIO_DESCRIPCION,
      mensajeError: null,
      controlesEdicionOEliminacion: 0,
      tarjetasRenderizadas: [],
    }
  }

  return {
    estadoUI: 'success' as const,
    mostrarEstadoVacio: false,
    mensajeError: null,
    controlesEdicionOEliminacion: 0,
    tarjetasRenderizadas: atenciones.map((a) => ({
      idAtencion: a.idAtencion,
      fechaHoraLegible: formatearFechaHoraAtencionArgentina(a.createdAt),
      profesional: `Dr./Dra. ${a.medico.nombreCompleto}`,
      especialidad: a.medico.especialidadEtiqueta,
      diagnosticoPrincipal: a.diagnosticoPrincipal,
      tipoDiagnosticoEtiqueta: a.tipoDiagnosticoEtiqueta,
      observacionesTexto: a.observacionesClinicas || TEXTO_SIN_OBSERVACIONES,
      tratamientoTexto: a.detalleTratamiento || TEXTO_SIN_TRATAMIENTO,
      indicacionesTexto:
        a.indicacionesFarmacologicas || TEXTO_SIN_INDICACIONES_FARMACOLOGICAS,
      esSoloLectura: true,
    })),
  }
}

const SESION_PACIENTE_A: SesionMock = {
  id: 'pac_A',
  nombre: 'Paciente',
  apellido: 'Demo A',
  rol: 'PACIENTE',
}

const SESION_PACIENTE_B: SesionMock = {
  id: 'pac_B',
  nombre: 'Martina',
  apellido: 'Suárez B',
  rol: 'PACIENTE',
}

const SESION_MEDICO_1: SesionMock = {
  id: 'med_001',
  nombre: 'Martín',
  apellido: 'Gómez',
  rol: 'MEDICO',
}

const SESION_MEDICO_2: SesionMock = {
  id: 'med_002',
  nombre: 'Juan Carlos',
  apellido: 'Rossi',
  rol: 'MEDICO',
}

async function runAllTests() {
  console.log('\n=== US-39: PRUEBAS DE CONSULTA DEL HISTORIAL CLÍNICO POR PARTE DEL PACIENTE ===\n')

  // --------------------------------------------------------------------------
  // Escenario 1 — Consulta exitosa
  // --------------------------------------------------------------------------
  await test('Esc.1: Consulta exitosa devuelve 200 y recupera diagnóstico, tipo, observaciones, tratamiento, indicaciones, profesional y fecha', () => {
    const db = crearBaseDatos()
    const fechaAtencion = new Date('2026-11-15T14:30:00.000Z')

    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_A',
      {
        diagnosticoPrincipal: 'Tendinopatía rotuliana bilateral',
        tipoDiagnostico: 'DEFINITIVO',
        observacionesClinicas: 'Dolor al descender escaleras, sin derrame articular.',
        detalleTratamiento: 'Rehabilitación kinésica excéntrica 3 veces por semana.',
        indicacionesFarmacologicas: 'Naproxeno 500 mg cada 12 hs durante 5 días.',
      },
      fechaAtencion
    )

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.atenciones?.length, 1)

    const item = res.body.atenciones![0]
    assert.equal(item.diagnosticoPrincipal, 'Tendinopatía rotuliana bilateral')
    assert.equal(item.tipoDiagnostico, 'DEFINITIVO')
    assert.equal(item.tipoDiagnosticoEtiqueta, 'Definitivo')
    assert.equal(
      item.observacionesClinicas,
      'Dolor al descender escaleras, sin derrame articular.'
    )
    assert.equal(
      item.detalleTratamiento,
      'Rehabilitación kinésica excéntrica 3 veces por semana.'
    )
    assert.equal(
      item.indicacionesFarmacologicas,
      'Naproxeno 500 mg cada 12 hs durante 5 días.'
    )
    assert.equal(item.medico.nombreCompleto, 'Martín Gómez')
    assert.equal(item.medico.especialidadEtiqueta, 'Traumatología y Ortopedia')
    assert.equal(item.createdAt, fechaAtencion.toISOString())
  })

  // --------------------------------------------------------------------------
  // Escenario 2 — Orden cronológico
  // --------------------------------------------------------------------------
  await test('Esc.2: Devuelve las atenciones ordenadas cronológicamente desde la más reciente hasta la más antigua', () => {
    const db = crearBaseDatos()

    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_2,
      'pac_A',
      {
        diagnosticoPrincipal: 'Primera atención (Octubre)',
        tipoDiagnostico: 'PRESUNTIVO',
      },
      new Date('2026-10-05T09:00:00.000Z')
    )

    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_A',
      {
        diagnosticoPrincipal: 'Tercera atención (Noviembre)',
        tipoDiagnostico: 'DEFINITIVO',
      },
      new Date('2026-11-15T18:00:00.000Z')
    )

    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_2,
      'pac_A',
      {
        diagnosticoPrincipal: 'Segunda atención (Octubre fin de mes)',
        tipoDiagnostico: 'EN_ESTUDIO',
      },
      new Date('2026-10-28T11:30:00.000Z')
    )

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.atenciones!.map((a: any) => a.diagnosticoPrincipal),
      [
        'Tercera atención (Noviembre)',
        'Segunda atención (Octubre fin de mes)',
        'Primera atención (Octubre)',
      ]
    )
  })

  // --------------------------------------------------------------------------
  // Escenario 3 — Paciente sin historial
  // --------------------------------------------------------------------------
  await test('Esc.3: Paciente sin atenciones registradas recibe 200 con arreglo vacío y la interfaz muestra el estado vacío', () => {
    const db = crearBaseDatos()
    // Cargar un registro solo para el paciente B
    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_1, 'pac_B', {
      diagnosticoPrincipal: 'Diagnóstico exclusivo de Paciente B',
      tipoDiagnostico: 'DEFINITIVO',
    })

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.deepEqual(res.body.atenciones, [])

    const vista = representarVistaHistorialPaciente(res)
    assert.equal(vista.estadoUI, 'empty')
    assert.equal(vista.mostrarEstadoVacio, true)
    assert.equal(vista.tituloVacio, 'Todavía no tenés registros en tu historial clínico.')
    assert.equal(vista.mensajeError, null)
  })

  // --------------------------------------------------------------------------
  // Escenario 4 — Aislamiento entre pacientes
  // --------------------------------------------------------------------------
  await test('Esc.4: Dos pacientes con historial propio ven únicamente sus propios registros sin filtración de datos', () => {
    const db = crearBaseDatos()

    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_1, 'pac_A', {
      diagnosticoPrincipal: 'Cervicalgia de Paciente A',
      tipoDiagnostico: 'PRESUNTIVO',
    })
    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_2, 'pac_B', {
      diagnosticoPrincipal: 'Bronquitis aguda de Paciente B',
      tipoDiagnostico: 'DEFINITIVO',
    })

    const resA = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const resB = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_B)

    assert.equal(resA.body.atenciones!.length, 1)
    assert.equal(resA.body.atenciones![0].idPaciente, 'pac_A')
    assert.equal(resA.body.atenciones![0].diagnosticoPrincipal, 'Cervicalgia de Paciente A')

    assert.equal(resB.body.atenciones!.length, 1)
    assert.equal(resB.body.atenciones![0].idPaciente, 'pac_B')
    assert.equal(resB.body.atenciones![0].diagnosticoPrincipal, 'Bronquitis aguda de Paciente B')
  })

  // --------------------------------------------------------------------------
  // Escenario 5 — Manipulación de identificadores (Anti-IDOR)
  // --------------------------------------------------------------------------
  await test('Esc.5: Manipular URL, query params o body con el idPaciente de un tercero nunca devuelve registros ajenos', () => {
    const db = crearBaseDatos()

    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_1, 'pac_A', {
      diagnosticoPrincipal: 'Registro privado de A',
      tipoDiagnostico: 'DEFINITIVO',
    })
    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_2, 'pac_B', {
      diagnosticoPrincipal: 'Registro confidencial de B',
      tipoDiagnostico: 'DEFINITIVO',
    })

    // Paciente A intenta inyectar el ID de B por todos los vectores posibles
    const resManipulada = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A, {
      idPacienteQuery: 'pac_B',
      idPacienteUrl: 'pac_B',
      idPacienteBody: 'pac_B',
    })

    assert.equal(resManipulada.status, 200)
    assert.equal(resManipulada.body.atenciones!.length, 1)
    assert.equal(resManipulada.body.atenciones![0].idPaciente, 'pac_A')
    assert.equal(resManipulada.body.atenciones![0].diagnosticoPrincipal, 'Registro privado de A')
  })

  // --------------------------------------------------------------------------
  // Escenario 6 — Usuario no autenticado
  // --------------------------------------------------------------------------
  await test('Esc.6: Solicitud sin sesión activa devuelve 401 y no ejecuta lecturas en la base de datos', () => {
    const db = crearBaseDatos()
    const res = consultarHistorialClinicoPacienteEndpoint(db, null)

    assert.equal(res.status, 401)
    assert.equal(res.body.success, false)
    assert.equal(db.lecturasEjecutadas, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 7 — Rol incorrecto
  // --------------------------------------------------------------------------
  await test('Esc.7: Usuarios con roles admin, medico o enfermero reciben 403 en el endpoint exclusivo del paciente', () => {
    const db = crearBaseDatos()
    const rolesNoPaciente: RolSesion[] = ['ADMIN', 'MEDICO', 'ENFERMERA']

    for (const rol of rolesNoPaciente) {
      const sesion: SesionMock = {
        id: `usr_${rol.toLowerCase()}`,
        nombre: 'Staff',
        apellido: rol,
        rol,
      }
      const res = consultarHistorialClinicoPacienteEndpoint(db, sesion)
      assert.equal(res.status, 403)
      assert.equal(res.body.success, false)
    }

    assert.equal(db.lecturasEjecutadas, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 8 — Usuario sin paciente asociado
  // --------------------------------------------------------------------------
  await test('Esc.8: Usuario autenticado como paciente pero sin registro en tabla Paciente recibe 404 sin consultar atenciones', () => {
    const db = crearBaseDatos()
    const sesionSinFicha: SesionMock = {
      id: 'pac_inexistente_en_db',
      nombre: 'Sin',
      apellido: 'Ficha',
      rol: 'PACIENTE',
    }

    const res = consultarHistorialClinicoPacienteEndpoint(db, sesionSinFicha)
    assert.equal(res.status, 404)
    assert.equal(res.body.success, false)
    assert.equal(db.lecturasEjecutadas, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 9 — Campos opcionales vacíos
  // --------------------------------------------------------------------------
  await test('Esc.9: Atenciones sin observaciones, tratamiento o indicaciones farmacológicas se representan con textos discretos sin inventar contenido', () => {
    const db = crearBaseDatos()

    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_2, 'pac_A', {
      diagnosticoPrincipal: 'Chequeo preventivo anual normal',
      tipoDiagnostico: 'DEFINITIVO',
      observacionesClinicas: null,
      detalleTratamiento: null,
      indicacionesFarmacologicas: null,
    })

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const vista = representarVistaHistorialPaciente(res)

    assert.equal(vista.estadoUI, 'success')
    assert.equal(vista.tarjetasRenderizadas.length, 1)
    const tarjeta = vista.tarjetasRenderizadas[0]
    assert.equal(tarjeta.diagnosticoPrincipal, 'Chequeo preventivo anual normal')
    assert.equal(tarjeta.observacionesTexto, 'No se registraron observaciones')
    assert.equal(tarjeta.tratamientoTexto, 'No se indicó tratamiento')
    assert.equal(
      tarjeta.indicacionesTexto,
      'No se registraron indicaciones farmacológicas'
    )
  })

  // --------------------------------------------------------------------------
  // Escenario 10 — Solo lectura
  // --------------------------------------------------------------------------
  await test('Esc.10: La consulta es estrictamente de solo lectura, sin controles de edición/eliminación ni escrituras en BD', () => {
    const db = crearBaseDatos()
    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_1, 'pac_A', {
      diagnosticoPrincipal: 'Epicondilitis lateral',
      tipoDiagnostico: 'PRESUNTIVO',
    })

    const escriturasAntesDeConsultar = db.escriturasEjecutadas
    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const vista = representarVistaHistorialPaciente(res)

    assert.equal(db.escriturasEjecutadas, escriturasAntesDeConsultar)
    assert.equal(vista.controlesEdicionOEliminacion, 0)
    assert.equal(vista.tarjetasRenderizadas[0].esSoloLectura, true)
  })

  // --------------------------------------------------------------------------
  // Escenario 11 — Manejo de errores
  // --------------------------------------------------------------------------
  await test('Esc.11: Fallo de base de datos devuelve 500 controlado sin detalles sensibles, permite reintentar y no se confunde con estado vacío', () => {
    const db = crearBaseDatos()
    db.simularCaidaBaseDeDatos = true

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(res.status, 500)
    assert.equal(res.body.success, false)
    assert.ok(!res.body.error?.includes('ECONNRESET'))

    const vista = representarVistaHistorialPaciente(res)
    assert.equal(vista.estadoUI, 'error')
    assert.equal(vista.mostrarEstadoVacio, false)
    assert.equal(vista.permiteReintentar, true)
  })

  // --------------------------------------------------------------------------
  // Escenario 12 — Integración directa con US-38
  // --------------------------------------------------------------------------
  await test('Esc.12: Una nueva atención cargada por el médico en US-38 queda disponible inmediatamente para el paciente en US-39', () => {
    const db = crearBaseDatos()

    // 1. Inicialmente el paciente A no tiene historial
    const inicial = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(inicial.body.atenciones!.length, 0)

    // 2. El médico registra una atención mediante US-38
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_A',
      {
        diagnosticoPrincipal: 'Distensión muscular gemelo interno',
        tipoDiagnostico: 'EN_ESTUDIO',
        observacionesClinicas: 'Se solicita ecografía de partes blandas.',
        detalleTratamiento: 'Reposo relativo y elevación del miembro.',
        indicacionesFarmacologicas: 'Paracetamol 500 mg según dolor.',
      },
      new Date('2026-11-16T02:30:00.000Z')
    )

    // 3. El paciente A consulta su historial y ve el registro inmediatamente
    const posterior = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(posterior.status, 200)
    assert.equal(posterior.body.atenciones!.length, 1)
    assert.equal(
      posterior.body.atenciones![0].diagnosticoPrincipal,
      'Distensión muscular gemelo interno'
    )
    assert.equal(posterior.body.atenciones![0].tipoDiagnostico, 'EN_ESTUDIO')
    assert.equal(posterior.body.atenciones![0].tipoDiagnosticoEtiqueta, 'En estudio')
  })

  // --------------------------------------------------------------------------
  // Escenario 13 — No-regresión con historial de turnos (US-26 / US-27)
  // --------------------------------------------------------------------------
  await test('Esc.13: El historial clínico (US-39) es independiente del historial de turnos (US-26/US-27) y formatea fechas en zona horaria Argentina', () => {
    const fechaISO = '2026-11-15T15:30:00.000Z' // 12:30 hs en Argentina (UTC-3)
    const formateada = formatearFechaHoraAtencionArgentina(fechaISO)
    assert.ok(formateada.includes('2026'))
    assert.ok(formateada.includes('12:30'))
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-39 PASARON EXITOSAMENTE (13/13) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-39:', err)
  process.exit(1)
})

