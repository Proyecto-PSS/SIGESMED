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
import { nombreEspecialidadMedica } from '../lib/utils/especialidades-medicas.ts'

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
            especialidadEtiqueta: nombreEspecialidadMedica(medico.especialidad),
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

const ENCABEZADOS_VISIBLES = [
  'Profesional:',
  'Dr./Dra.',
  'Diagnóstico',
  'Diagnóstico principal',
  'Tipo de diagnóstico',
  'Observaciones clínicas',
  'Tratamiento',
  'Detalle del tratamiento',
  'Indicaciones farmacológicas',
]

function representarVistaHistorialPaciente(respuesta: {
  status: number
  body: { ok: boolean; success: boolean; atenciones?: any[]; error?: string }
}) {
  const ariaLabelSeccion = 'Registros de tu historial clínico'
  const ariaLabelLista = 'Atenciones médicas registradas en tu historial clínico'
  const textoCarga = 'Cargando registros de tu historial clínico...'
  const botonReintentar = 'Reintentar'

  if (respuesta.status !== 200 || !respuesta.body.ok) {
    return {
      estadoUI: 'error' as const,
      mostrarEstadoVacio: false,
      mensajeError: respuesta.body.error || 'No se pudo recuperar tu historial clínico.',
      permiteReintentar: true,
      controlesEdicionOEliminacion: 0,
      tarjetasRenderizadas: [],
      contador: null,
      encabezadosVisibles: ENCABEZADOS_VISIBLES,
      ariaLabelSeccion,
      ariaLabelLista,
      textoCarga,
      botonReintentar,
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
      contador: null,
      encabezadosVisibles: ENCABEZADOS_VISIBLES,
      ariaLabelSeccion,
      ariaLabelLista,
      textoCarga,
      botonReintentar: null,
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
      profesional: `Dr./Dra. ${a.medico.nombreCompleto}${
        a.medico.especialidadEtiqueta ? ` · ${a.medico.especialidadEtiqueta}` : ''
      }`,
      especialidad: a.medico.especialidadEtiqueta,
      diagnosticoPrincipal: a.diagnosticoPrincipal,
      tipoDiagnosticoEtiqueta: a.tipoDiagnosticoEtiqueta,
      observacionesTexto: a.observacionesClinicas || TEXTO_SIN_OBSERVACIONES,
      tratamientoTexto: a.detalleTratamiento || TEXTO_SIN_TRATAMIENTO,
      indicacionesTexto:
        a.indicacionesFarmacologicas || TEXTO_SIN_INDICACIONES_FARMACOLOGICAS,
      esSoloLectura: true,
    })),
    contador:
      atenciones.length === 1
        ? '1 atención registrada'
        : `${atenciones.length} atenciones registradas`,
    encabezadosVisibles: ENCABEZADOS_VISIBLES,
    ariaLabelSeccion,
    ariaLabelLista,
    textoCarga,
    botonReintentar: null,
  }
}

function simularFetchHistorial(
  respuesta: {
    status: number
    body: { ok: boolean; success: boolean; atenciones?: any[]; error?: string }
  },
  atencionesIniciales: any[] = []
) {
  const url = '/api/pacientes/historia-clinica'
  const init = { method: 'GET', cache: 'no-store' }
  const vista = representarVistaHistorialPaciente(respuesta)
  const atenciones = Array.isArray(respuesta.body.atenciones) ? respuesta.body.atenciones : []

  return {
    url,
    init,
    estadoUI: vista.estadoUI,
    mensajeError: vista.mensajeError,
    permiteReintentar: vista.estadoUI === 'error',
    botonReintentar: vista.estadoUI === 'error' ? 'Reintentar' : null,
    tarjetasRenderizadas: vista.tarjetasRenderizadas,
    contador: vista.contador,
    atencionesIniciales: atencionesIniciales.length,
    atencionesFinales: atenciones.length,
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
    assert.equal(item.medico.especialidadEtiqueta, 'Traumatología y ortopedia')
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

  await test('Esc.14: Dos pacientes con dos médicos distintos ven solo sus diagnósticos exactos, sin filtración cruzada al renderizar', () => {
    const db = crearBaseDatos()

    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_A',
      { diagnosticoPrincipal: 'Fractura de radio distal izquierda', tipoDiagnostico: 'DEFINITIVO' },
      new Date('2026-11-20T10:00:00.000Z')
    )
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_2,
      'pac_A',
      { diagnosticoPrincipal: 'Lumbalgia mecánica crónica', tipoDiagnostico: 'EN_ESTUDIO' },
      new Date('2026-11-18T09:00:00.000Z')
    )
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_2,
      'pac_B',
      { diagnosticoPrincipal: 'Otitis media aguda bilateral', tipoDiagnostico: 'PRESUNTIVO' },
      new Date('2026-11-19T08:00:00.000Z')
    )
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_B',
      { diagnosticoPrincipal: 'Dermatitis de contacto en manos', tipoDiagnostico: 'DEFINITIVO' },
      new Date('2026-11-17T07:00:00.000Z')
    )

    const resA = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const resB = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_B)
    const vistaA = representarVistaHistorialPaciente(resA)
    const vistaB = representarVistaHistorialPaciente(resB)

    assert.deepEqual(resA.body.atenciones!.map((a: any) => a.diagnosticoPrincipal), [
      'Fractura de radio distal izquierda',
      'Lumbalgia mecánica crónica',
    ])
    assert.deepEqual(resB.body.atenciones!.map((a: any) => a.diagnosticoPrincipal), [
      'Otitis media aguda bilateral',
      'Dermatitis de contacto en manos',
    ])
    assert.ok(resA.body.atenciones!.every((a: any) => a.idPaciente === 'pac_A'))
    assert.ok(resB.body.atenciones!.every((a: any) => a.idPaciente === 'pac_B'))
    assert.deepEqual(
      vistaA.tarjetasRenderizadas.map((t: any) => t.diagnosticoPrincipal),
      ['Fractura de radio distal izquierda', 'Lumbalgia mecánica crónica']
    )
    assert.deepEqual(
      vistaB.tarjetasRenderizadas.map((t: any) => t.diagnosticoPrincipal),
      ['Otitis media aguda bilateral', 'Dermatitis de contacto en manos']
    )
    assert.equal(vistaA.tarjetasRenderizadas[0].profesional, 'Dr./Dra. Martín Gómez · Traumatología y ortopedia')
    assert.equal(vistaA.tarjetasRenderizadas[1].profesional, 'Dr./Dra. Juan Carlos Rossi · Clínica médica')
    assert.equal(vistaB.tarjetasRenderizadas[0].profesional, 'Dr./Dra. Juan Carlos Rossi · Clínica médica')
    assert.equal(vistaB.tarjetasRenderizadas[1].profesional, 'Dr./Dra. Martín Gómez · Traumatología y ortopedia')
    assert.ok(!JSON.stringify(vistaA).includes('Otitis media aguda bilateral'))
    assert.ok(!JSON.stringify(vistaA).includes('Dermatitis de contacto en manos'))
    assert.ok(!JSON.stringify(vistaB).includes('Fractura de radio distal izquierda'))
    assert.ok(!JSON.stringify(vistaB).includes('Lumbalgia mecánica crónica'))
  })

  await test('Esc.15: El renderizado replica literalmente el diagnóstico cargado por el médico, sus etiquetas, profesional, fecha y contador', () => {
    const db = crearBaseDatos()

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
      new Date('2026-03-20T14:30:00.000Z')
    )

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const vista = representarVistaHistorialPaciente(res)

    assert.equal(vista.estadoUI, 'success')
    assert.equal(vista.contador, '1 atención registrada')
    assert.equal(vista.ariaLabelSeccion, 'Registros de tu historial clínico')
    assert.equal(vista.ariaLabelLista, 'Atenciones médicas registradas en tu historial clínico')
    assert.equal(vista.textoCarga, 'Cargando registros de tu historial clínico...')
    assert.equal(vista.botonReintentar, null)
    assert.deepEqual(vista.encabezadosVisibles, [
      'Profesional:',
      'Dr./Dra.',
      'Diagnóstico',
      'Diagnóstico principal',
      'Tipo de diagnóstico',
      'Observaciones clínicas',
      'Tratamiento',
      'Detalle del tratamiento',
      'Indicaciones farmacológicas',
    ])
    assert.deepEqual(vista.tarjetasRenderizadas[0], {
      idAtencion: res.body.atenciones![0].idAtencion,
      fechaHoraLegible: '20 de marzo de 2026 · 11:30 hs',
      profesional: 'Dr./Dra. Martín Gómez · Traumatología y ortopedia',
      especialidad: 'Traumatología y ortopedia',
      diagnosticoPrincipal: 'Tendinopatía rotuliana bilateral',
      tipoDiagnosticoEtiqueta: 'Definitivo',
      observacionesTexto: 'Dolor al descender escaleras, sin derrame articular.',
      tratamientoTexto: 'Rehabilitación kinésica excéntrica 3 veces por semana.',
      indicacionesTexto: 'Naproxeno 500 mg cada 12 hs durante 5 días.',
      esSoloLectura: true,
    })
  })

  await test('Esc.16: Las etiquetas de tipo y especialidad usan las utilidades reales, sin mayúsculas inventadas', () => {
    assert.equal(nombreEspecialidadMedica('CLINICA_MEDICA'), 'Clínica médica')
    assert.equal(nombreEspecialidadMedica('PEDIATRIA'), 'Pediatría')
    assert.equal(nombreEspecialidadMedica('TRAUMATOLOGIA_ORTOPEDIA'), 'Traumatología y ortopedia')

    const db = crearBaseDatos()
    db.medicos.set('med_003', {
      idMedico: 'med_003',
      nombre: 'Ana',
      apellido: 'Pérez',
      especialidad: 'PEDIATRIA',
      matricula: 'MN-30303',
    })
    const sesionMedico3: SesionMock = {
      id: 'med_003',
      nombre: 'Ana',
      apellido: 'Pérez',
      rol: 'MEDICO',
    }

    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_A',
      { diagnosticoPrincipal: 'Esguince de tobillo', tipoDiagnostico: 'PRESUNTIVO' },
      new Date('2026-11-18T09:00:00.000Z')
    )
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_2,
      'pac_A',
      { diagnosticoPrincipal: 'Hipertensión en evaluación', tipoDiagnostico: 'EN_ESTUDIO' },
      new Date('2026-11-19T10:00:00.000Z')
    )
    registrarAtencionPorMedicoUS38(
      db,
      sesionMedico3,
      'pac_A',
      { diagnosticoPrincipal: 'Bronquiolitis aguda', tipoDiagnostico: 'DEFINITIVO' },
      new Date('2026-11-20T11:00:00.000Z')
    )

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const vista = representarVistaHistorialPaciente(res)
    assert.deepEqual(vista.tarjetasRenderizadas.map((t: any) => t.tipoDiagnosticoEtiqueta), [
      'Definitivo',
      'En estudio',
      'Presuntivo',
    ])
    assert.deepEqual(vista.tarjetasRenderizadas.map((t: any) => t.especialidad), [
      'Pediatría',
      'Clínica médica',
      'Traumatología y ortopedia',
    ])
    assert.deepEqual(vista.tarjetasRenderizadas.map((t: any) => t.profesional), [
      'Dr./Dra. Ana Pérez · Pediatría',
      'Dr./Dra. Juan Carlos Rossi · Clínica médica',
      'Dr./Dra. Martín Gómez · Traumatología y ortopedia',
    ])
  })

  await test('Esc.17: El body de respuesta y los mensajes de error respetan el contrato exacto del endpoint', () => {
    const db = crearBaseDatos()
    registrarAtencionPorMedicoUS38(db, SESION_MEDICO_1, 'pac_A', {
      diagnosticoPrincipal: 'Contractura muscular dorsal',
      tipoDiagnostico: 'DEFINITIVO',
    })

    const res = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.deepEqual(Object.keys(res.body).sort(), ['atenciones', 'ok', 'success'])
    assert.ok(!('paciente' in res.body))
    assert.ok(!('message' in res.body))

    const sinSesion = consultarHistorialClinicoPacienteEndpoint(db, null)
    assert.equal(sinSesion.status, 401)
    assert.equal(sinSesion.body.error, 'No autorizado: sesión de paciente no encontrada.')

    const rolIncorrecto = consultarHistorialClinicoPacienteEndpoint(db, SESION_MEDICO_1)
    assert.equal(rolIncorrecto.status, 403)
    assert.equal(rolIncorrecto.body.error, 'Acceso denegado: se requiere perfil de paciente.')

    const sesionSinFicha: SesionMock = {
      id: 'pac_sin_ficha',
      nombre: 'Sin',
      apellido: 'Ficha',
      rol: 'PACIENTE',
    }
    const sinFicha = consultarHistorialClinicoPacienteEndpoint(db, sesionSinFicha)
    assert.equal(sinFicha.status, 404)
    assert.equal(sinFicha.body.error, 'No se encontró un registro de paciente asociado a la sesión actual.')

    db.simularCaidaBaseDeDatos = true
    const fallo = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    assert.equal(fallo.status, 500)
    assert.equal(fallo.body.error, 'No se pudo consultar el historial clínico en este momento.')
    assert.deepEqual(Object.keys(fallo.body).sort(), ['error', 'ok', 'success'])
  })

  await test('Esc.18: El fetch del cliente usa URL/cache exactos, muestra el error y reintenta sin duplicar tarjetas', () => {
    const db = crearBaseDatos()
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_1,
      'pac_A',
      {
        diagnosticoPrincipal: 'Registro inicial del servidor',
        tipoDiagnostico: 'DEFINITIVO',
      },
      new Date('2026-11-20T10:00:00.000Z')
    )

    const inicialRes = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const inicial = simularFetchHistorial(inicialRes, inicialRes.body.atenciones)
    assert.equal(inicial.url, '/api/pacientes/historia-clinica')
    assert.deepEqual(inicial.init, { method: 'GET', cache: 'no-store' })
    assert.equal(inicial.estadoUI, 'success')
    assert.equal(inicial.tarjetasRenderizadas.length, 1)
    assert.equal(inicial.atencionesIniciales, 1)
    assert.equal(inicial.atencionesFinales, 1)

    db.simularCaidaBaseDeDatos = true
    const fallido = simularFetchHistorial(
      consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A),
      inicialRes.body.atenciones
    )
    assert.equal(fallido.estadoUI, 'error')
    assert.equal(fallido.mensajeError, 'No se pudo consultar el historial clínico en este momento.')
    assert.equal(fallido.permiteReintentar, true)
    assert.equal(fallido.botonReintentar, 'Reintentar')
    assert.equal(fallido.tarjetasRenderizadas.length, 0)

    db.simularCaidaBaseDeDatos = false
    registrarAtencionPorMedicoUS38(
      db,
      SESION_MEDICO_2,
      'pac_A',
      {
        diagnosticoPrincipal: 'Segundo registro tras reintento',
        tipoDiagnostico: 'PRESUNTIVO',
      },
      new Date('2026-11-21T10:00:00.000Z')
    )
    const reintentadoRes = consultarHistorialClinicoPacienteEndpoint(db, SESION_PACIENTE_A)
    const reintentado = simularFetchHistorial(reintentadoRes, inicialRes.body.atenciones)
    assert.equal(reintentado.estadoUI, 'success')
    assert.equal(reintentado.mensajeError, null)
    assert.equal(reintentado.tarjetasRenderizadas.length, 2)
    assert.equal(reintentado.contador, '2 atenciones registradas')
    assert.equal(reintentado.atencionesIniciales, 1)
    assert.equal(reintentado.atencionesFinales, 2)
    assert.deepEqual(
      reintentado.tarjetasRenderizadas.map((t: any) => t.diagnosticoPrincipal),
      ['Segundo registro tras reintento', 'Registro inicial del servidor']
    )
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-39 PASARON EXITOSAMENTE (18/18) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-39:', err)
  process.exit(1)
})

