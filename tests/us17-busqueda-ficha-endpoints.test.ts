import assert from 'node:assert/strict'
import {
  type TipoDiagnosticoValor,
  ETIQUETAS_TIPO_DIAGNOSTICO,
  TEXTO_DNI_NO_ENCONTRADO,
  TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS,
  HistoriaClinicaError,
  sanearDniBusqueda,
  esDniValido,
  validarDniBusqueda,
  filtrarPacientesPorTermino,
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
  telefono: string | null
  obraSocial: string | null
  numeroAfiliado: string | null
  plan: string | null
}

interface PacienteFichaMock extends PacienteMock {
  cantidadAtenciones: number
}

interface MedicoMock {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  matricula: string
}

interface AtencionMock {
  idAtencion: string
  idPaciente: string
  idMedico: string
  diagnosticoPrincipal: string
  tipoDiagnostico: TipoDiagnosticoValor
  observacionesClinicas: string | null
  detalleTratamiento: string | null
  indicacionesFarmacologicas: string | null
  createdAt: Date
  medico: MedicoMock
}

interface AtencionFichaMock extends Omit<AtencionMock, 'createdAt'> {
  createdAt: string
  tipoDiagnosticoEtiqueta: string
  fechaFormateadaArgentina: string
}

interface BaseDatosMock {
  pacientes: PacienteMock[]
  atenciones: AtencionMock[]
  lecturasBaseDatos: number
}

interface RespuestaEndpoint {
  status: number
  body: {
    ok: boolean
    success: boolean
    paciente?: PacienteFichaMock
    atenciones?: AtencionFichaMock[]
    sinRegistrosClinicos?: boolean
    mensajeHistorialVacio?: string | null
    error?: string
  }
}

interface EstadoBuscadorMock {
  dniInput: string
  error: string | null
  noEncontrado: boolean
  pacienteEncontrado: PacienteFichaMock | null
  fichaAbierta: boolean
  atenciones: AtencionFichaMock[]
  urlsInvocadas: string[]
}

function crearBaseDatos(): BaseDatosMock {
  const medico: MedicoMock = {
    idMedico: 'med_1',
    nombre: 'Martín',
    apellido: 'Gómez',
    especialidad: 'CLINICA_MEDICA',
    matricula: 'MN-84920',
  }

  return {
    lecturasBaseDatos: 0,
    pacientes: [
      {
        idPaciente: 'pac_con_historial',
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '35123456',
        email: 'juan.perez@email.com',
        telefono: '11-4555-0101',
        obraSocial: 'OSDE',
        numeroAfiliado: '123456789',
        plan: '310',
      },
      {
        idPaciente: 'pac_sin_historial',
        nombre: 'María',
        apellido: 'González',
        dni: '40222333',
        email: 'maria.gonzalez@email.com',
        telefono: null,
        obraSocial: 'Swiss Medical',
        numeroAfiliado: '987654321',
        plan: 'SMG20',
      },
      {
        idPaciente: 'pac_tercero',
        nombre: 'Ana Belén',
        apellido: 'López',
        dni: '7654321',
        email: 'ana.lopez@email.com',
        telefono: null,
        obraSocial: 'Particular',
        numeroAfiliado: null,
        plan: null,
      },
    ],
    atenciones: [
      {
        idAtencion: 'atn_1',
        idPaciente: 'pac_con_historial',
        idMedico: 'med_1',
        diagnosticoPrincipal: 'Hipertensión arterial esencial controlada',
        tipoDiagnostico: 'DEFINITIVO',
        observacionesClinicas: 'TA 125/80 mmHg. Buena adherencia al esquema.',
        detalleTratamiento: 'Dieta hiposódica y actividad aeróbica 30 min diarios.',
        indicacionesFarmacologicas: 'Losartán 50 mg 1 comprimido cada 24 hs.',
        createdAt: new Date('2026-11-10T14:00:00.000Z'),
        medico,
      },
      {
        idAtencion: 'atn_2',
        idPaciente: 'pac_con_historial',
        idMedico: 'med_1',
        diagnosticoPrincipal: 'Control evolutivo cardiovascular',
        tipoDiagnostico: 'EN_ESTUDIO',
        observacionesClinicas: 'Se solicita ecocardiograma Doppler de control.',
        detalleTratamiento: null,
        indicacionesFarmacologicas: null,
        createdAt: new Date('2026-11-15T16:30:00.000Z'),
        medico,
      },
      {
        idAtencion: 'atn_3',
        idPaciente: 'pac_tercero',
        idMedico: 'med_1',
        diagnosticoPrincipal: 'Control pediátrico de rutina',
        tipoDiagnostico: 'PRESUNTIVO',
        observacionesClinicas: null,
        detalleTratamiento: null,
        indicacionesFarmacologicas: null,
        createdAt: new Date('2026-11-12T09:00:00.000Z'),
        medico,
      },
    ],
  }
}

const SESION_MEDICO: SesionMock = {
  id: 'med_1',
  nombre: 'Martín',
  apellido: 'Gómez',
  rol: 'MEDICO',
}

function autorizarSoloMedico(sesion: SesionMock | null): void {
  if (!sesion) {
    throw new HistoriaClinicaError(
      'No autorizado: sesión no encontrada o perfil inexistente.',
      401
    )
  }
  if (sesion.rol !== 'MEDICO') {
    throw new HistoriaClinicaError('Acceso denegado: se requiere perfil médico.', 403)
  }
}

function responderError(error: unknown, mensajeErrorInterno: string): RespuestaEndpoint {
  if (error instanceof HistoriaClinicaError) {
    return {
      status: error.statusCode,
      body: { ok: false, success: false, error: error.message },
    }
  }

  const status =
    typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? ((error as { statusCode: number }).statusCode)
      : 500

  return {
    status,
    body: {
      ok: false,
      success: false,
      error:
        status === 500
          ? mensajeErrorInterno
          : (error as Error).message || 'No autorizado.',
    },
  }
}

function endpointBuscarPacientePorDni(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  dniQuery: string | null,
  fallarBaseDeDatos = false
): RespuestaEndpoint {
  try {
    autorizarSoloMedico(sesion)
    const dniLimpio = validarDniBusqueda(dniQuery)

    if (fallarBaseDeDatos) {
      throw new Error('Neon database connection timeout ECONNRESET')
    }

    db.lecturasBaseDatos += 1
    const paciente = db.pacientes.find((p) => p.dni === dniLimpio)
    if (!paciente) {
      throw new HistoriaClinicaError(TEXTO_DNI_NO_ENCONTRADO, 404)
    }

    return {
      status: 200,
      body: {
        ok: true,
        success: true,
        paciente: {
          ...paciente,
          cantidadAtenciones: db.atenciones.filter(
            (a) => a.idPaciente === paciente.idPaciente
          ).length,
        },
      },
    }
  } catch (error) {
    return responderError(error, 'Error interno al buscar al paciente por DNI.')
  }
}

function endpointObtenerFichaPaciente(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  idPaciente: string | null,
  fallarBaseDeDatos = false
): RespuestaEndpoint {
  try {
    autorizarSoloMedico(sesion)
    const idLimpio = idPaciente?.trim()
    if (!idLimpio) {
      throw new HistoriaClinicaError('El identificador del paciente es obligatorio.', 400)
    }

    if (fallarBaseDeDatos) {
      throw new Error('Neon database connection timeout ECONNRESET')
    }

    db.lecturasBaseDatos += 1
    const paciente = db.pacientes.find((p) => p.idPaciente === idLimpio)
    if (!paciente) {
      throw new HistoriaClinicaError('No se encontró el paciente solicitado.', 404)
    }

    const atenciones: AtencionFichaMock[] = db.atenciones
      .filter((a) => a.idPaciente === paciente.idPaciente)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        tipoDiagnosticoEtiqueta: ETIQUETAS_TIPO_DIAGNOSTICO[a.tipoDiagnostico],
        fechaFormateadaArgentina: formatearFechaHoraAtencionArgentina(a.createdAt),
      }))

    const sinRegistrosClinicos = atenciones.length === 0

    return {
      status: 200,
      body: {
        ok: true,
        success: true,
        paciente: { ...paciente, cantidadAtenciones: atenciones.length },
        atenciones,
        sinRegistrosClinicos,
        mensajeHistorialVacio: sinRegistrosClinicos
          ? TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS
          : null,
      },
    }
  } catch (error) {
    return responderError(error, 'Error interno al consultar la ficha clínica del paciente.')
  }
}

function simularBuscadorFichaPaciente(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  dniInput: string
): EstadoBuscadorMock {
  const estado: EstadoBuscadorMock = {
    dniInput,
    error: null,
    noEncontrado: false,
    pacienteEncontrado: null,
    fichaAbierta: false,
    atenciones: [],
    urlsInvocadas: [],
  }

  let dniLimpio: string
  try {
    dniLimpio = sanearDniBusqueda(dniInput)
  } catch (error) {
    estado.error = (error as Error).message
    return estado
  }

  if (!esDniValido(dniLimpio)) {
    estado.error =
      'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.'
    return estado
  }

  estado.urlsInvocadas.push(
    `/api/medicos/pacientes/buscar?dni=${encodeURIComponent(dniLimpio)}`
  )
  const respuestaBusqueda = endpointBuscarPacientePorDni(db, sesion, dniLimpio)

  if (respuestaBusqueda.status === 404) {
    estado.noEncontrado = true
    return estado
  }
  if (respuestaBusqueda.status !== 200 || !respuestaBusqueda.body.paciente) {
    estado.error =
      respuestaBusqueda.body.error ?? 'No se pudo completar la búsqueda del paciente.'
    return estado
  }

  estado.pacienteEncontrado = respuestaBusqueda.body.paciente
  const idPaciente = respuestaBusqueda.body.paciente.idPaciente
  estado.urlsInvocadas.push(
    `/api/medicos/pacientes/${encodeURIComponent(idPaciente)}/ficha`
  )

  const respuestaFicha = endpointObtenerFichaPaciente(db, sesion, idPaciente)
  if (respuestaFicha.status !== 200) {
    estado.error = respuestaFicha.body.error ?? 'Error al abrir la ficha clínica del paciente.'
    return estado
  }

  estado.fichaAbierta = true
  estado.atenciones = respuestaFicha.body.atenciones ?? []
  return estado
}

function simularInterfazSeleccion(
  db: BaseDatosMock,
  termino: string
): { pacientes: PacienteMock[]; sinResultados: boolean } {
  const pacientes = filtrarPacientesPorTermino(db.pacientes, termino)
  return { pacientes, sinResultados: pacientes.length === 0 }
}

async function runAllTests() {
  console.log(
    '\n=== US-17: PRUEBAS UNITARIAS DE BÚSQUEDA, SELECCIÓN Y ACCESO A FICHA ===\n'
  )

  await test('Esc.1: GET /buscar con DNI saneado devuelve 200 y el paciente localizado con su cantidad de atenciones', () => {
    const db = crearBaseDatos()
    const res = endpointBuscarPacientePorDni(db, SESION_MEDICO, ' 35.123.456 ')

    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(res.body.success, true)
    assert.equal(res.body.paciente?.idPaciente, 'pac_con_historial')
    assert.equal(res.body.paciente?.nombre, 'Juan')
    assert.equal(res.body.paciente?.apellido, 'Pérez')
    assert.equal(res.body.paciente?.dni, '35123456')
    assert.equal(res.body.paciente?.telefono, '11-4555-0101')
    assert.equal(res.body.paciente?.obraSocial, 'OSDE')
    assert.equal(res.body.paciente?.numeroAfiliado, '123456789')
    assert.equal(res.body.paciente?.plan, '310')
    assert.equal(res.body.paciente?.cantidadAtenciones, 2)
  })

  await test('Esc.2: DNI inválido devuelve 400 con el mensaje exacto y sin consultar la base de datos', () => {
    const db = crearBaseDatos()

    assert.equal(sanearDniBusqueda(' 34.891.204 '), '34891204')
    assert.equal(esDniValido('7654321'), true)
    assert.equal(validarDniBusqueda('34.891.204'), '34891204')

    const casosInvalidos: Array<{ valor: unknown; mensaje: string }> = [
      { valor: '', mensaje: 'El DNI es obligatorio para realizar la búsqueda.' },
      { valor: '   ', mensaje: 'El DNI es obligatorio para realizar la búsqueda.' },
      {
        valor: '123456',
        mensaje:
          'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.',
      },
      {
        valor: '123456789',
        mensaje:
          'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.',
      },
      {
        valor: '3512345A',
        mensaje:
          'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.',
      },
      {
        valor: '35-123-456',
        mensaje:
          'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.',
      },
      {
        valor: null,
        mensaje:
          'El DNI es obligatorio y debe contener entre 7 y 8 dígitos numéricos.',
      },
      {
        valor: undefined,
        mensaje:
          'El DNI es obligatorio y debe contener entre 7 y 8 dígitos numéricos.',
      },
    ]

    for (const caso of casosInvalidos) {
      const res = endpointBuscarPacientePorDni(db, SESION_MEDICO, caso.valor as string | null)
      assert.equal(res.status, 400, `DNI ${String(caso.valor)} debe ser rechazado`)
      assert.equal(res.body.ok, false)
      assert.equal(res.body.success, false)
      assert.equal(res.body.error, caso.mensaje)
    }

    assert.equal(db.lecturasBaseDatos, 0)
  })

  await test('Esc.3: DNI con formato válido inexistente devuelve 404 con el mensaje exacto de "no encontrado"', () => {
    const db = crearBaseDatos()
    const res = endpointBuscarPacientePorDni(db, SESION_MEDICO, '99887766')

    assert.equal(res.status, 404)
    assert.equal(res.body.ok, false)
    assert.equal(res.body.success, false)
    assert.equal(res.body.error, TEXTO_DNI_NO_ENCONTRADO)
    assert.equal(res.body.error, 'No se encontraron pacientes con el DNI ingresado')
    assert.equal(db.lecturasBaseDatos, 1)
  })

  await test('Esc.4: La interfaz de selección filtra por nombre sin tildes, DNI, correo y obra social usando el helper real', () => {
    const db = crearBaseDatos()

    assert.deepEqual(
      simularInterfazSeleccion(db, 'GONZALEZ').pacientes.map((p) => p.idPaciente),
      ['pac_sin_historial']
    )
    assert.deepEqual(
      simularInterfazSeleccion(db, 'juan').pacientes.map((p) => p.idPaciente),
      ['pac_con_historial']
    )
    assert.deepEqual(
      simularInterfazSeleccion(db, '7654321').pacientes.map((p) => p.idPaciente),
      ['pac_tercero']
    )
    assert.deepEqual(
      simularInterfazSeleccion(db, 'ana.lopez@email.com').pacientes.map((p) => p.idPaciente),
      ['pac_tercero']
    )
    assert.deepEqual(
      simularInterfazSeleccion(db, 'swiss').pacientes.map((p) => p.idPaciente),
      ['pac_sin_historial']
    )
  })

  await test('Esc.5: La interfaz de selección exige coincidencia de todas las palabras, muestra estado vacío y devuelve todos con la búsqueda vacía', () => {
    const db = crearBaseDatos()

    assert.deepEqual(
      simularInterfazSeleccion(db, 'maria swiss').pacientes.map((p) => p.idPaciente),
      ['pac_sin_historial']
    )

    const sinCoincidencias = simularInterfazSeleccion(db, 'maria OSDE')
    assert.equal(sinCoincidencias.sinResultados, true)
    assert.deepEqual(sinCoincidencias.pacientes, [])

    const sinTermino = simularInterfazSeleccion(db, '   ')
    assert.equal(sinTermino.pacientes.length, 3)
    assert.equal(sinTermino.sinResultados, false)
  })

  await test('Esc.6: GET /ficha abre la ficha del paciente seleccionado con datos filiatorios, cobertura e historial ordenado', () => {
    const db = crearBaseDatos()
    const res = endpointObtenerFichaPaciente(db, SESION_MEDICO, 'pac_con_historial')

    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(res.body.success, true)
    assert.equal(res.body.paciente?.nombre, 'Juan')
    assert.equal(res.body.paciente?.apellido, 'Pérez')
    assert.equal(res.body.paciente?.dni, '35123456')
    assert.equal(res.body.paciente?.obraSocial, 'OSDE')
    assert.equal(res.body.paciente?.plan, '310')
    assert.equal(res.body.paciente?.numeroAfiliado, '123456789')
    assert.equal(res.body.paciente?.cantidadAtenciones, 2)
    assert.equal(res.body.sinRegistrosClinicos, false)
    assert.equal(res.body.mensajeHistorialVacio, null)
    assert.equal(res.body.atenciones?.length, 2)
    assert.deepEqual(
      res.body.atenciones?.map((a) => a.diagnosticoPrincipal),
      ['Control evolutivo cardiovascular', 'Hipertensión arterial esencial controlada']
    )
    assert.equal(res.body.atenciones?.[0].tipoDiagnosticoEtiqueta, 'En estudio')
    assert.equal(res.body.atenciones?.[1].tipoDiagnosticoEtiqueta, 'Definitivo')
    assert.equal(res.body.atenciones?.[0].medico.nombre, 'Martín')
    assert.equal(res.body.atenciones?.[0].medico.apellido, 'Gómez')
    assert.equal(res.body.atenciones?.[0].medico.matricula, 'MN-84920')
    assert.ok(res.body.atenciones?.[0].fechaFormateadaArgentina.includes('13:30'))
    assert.ok(res.body.atenciones?.[0].fechaFormateadaArgentina.includes('noviembre'))
    assert.equal(
      res.body.atenciones?.[0].createdAt,
      new Date('2026-11-15T16:30:00.000Z').toISOString()
    )
  })

  await test('Esc.7: Ficha de paciente sin registros clínicos devuelve 200 con estado vacío y mensaje explícito', () => {
    const db = crearBaseDatos()
    const res = endpointObtenerFichaPaciente(db, SESION_MEDICO, 'pac_sin_historial')

    assert.equal(res.status, 200)
    assert.equal(res.body.paciente?.nombre, 'María')
    assert.equal(res.body.paciente?.apellido, 'González')
    assert.equal(res.body.paciente?.dni, '40222333')
    assert.equal(res.body.paciente?.obraSocial, 'Swiss Medical')
    assert.equal(res.body.paciente?.cantidadAtenciones, 0)
    assert.deepEqual(res.body.atenciones, [])
    assert.equal(res.body.sinRegistrosClinicos, true)
    assert.equal(res.body.mensajeHistorialVacio, TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS)
    assert.equal(
      res.body.mensajeHistorialVacio,
      'Este paciente aún no posee registros clínicos cargados'
    )
  })

  await test('Esc.8: Casos inexistentes en la ficha — id vacío devuelve 400 e id inexistente devuelve 404', () => {
    const db = crearBaseDatos()

    const idVacio = endpointObtenerFichaPaciente(db, SESION_MEDICO, '   ')
    assert.equal(idVacio.status, 400)
    assert.equal(idVacio.body.success, false)
    assert.equal(idVacio.body.error, 'El identificador del paciente es obligatorio.')

    const idInexistente = endpointObtenerFichaPaciente(db, SESION_MEDICO, 'pac_inexistente')
    assert.equal(idInexistente.status, 404)
    assert.equal(idInexistente.body.success, false)
    assert.equal(idInexistente.body.error, 'No se encontró el paciente solicitado.')
  })

  await test('Esc.9: Permisos — sin sesión devuelve 401 y PACIENTE, ENFERMERA y ADMIN reciben 403 en ambos endpoints sin consultar la BD', () => {
    const db = crearBaseDatos()

    const sinSesionBuscar = endpointBuscarPacientePorDni(db, null, '35123456')
    const sinSesionFicha = endpointObtenerFichaPaciente(db, null, 'pac_con_historial')
    assert.equal(sinSesionBuscar.status, 401)
    assert.equal(sinSesionBuscar.body.error, 'No autorizado: sesión no encontrada o perfil inexistente.')
    assert.equal(sinSesionFicha.status, 401)
    assert.equal(sinSesionFicha.body.error, 'No autorizado: sesión no encontrada o perfil inexistente.')

    const rolesBloqueados: RolSesion[] = ['PACIENTE', 'ENFERMERA', 'ADMIN']
    for (const rol of rolesBloqueados) {
      const sesion: SesionMock = {
        id: `usr_${rol.toLowerCase()}`,
        nombre: 'Usuario',
        apellido: rol,
        rol,
      }
      const resBuscar = endpointBuscarPacientePorDni(db, sesion, '35123456')
      const resFicha = endpointObtenerFichaPaciente(db, sesion, 'pac_con_historial')
      assert.equal(resBuscar.status, 403, `búsqueda con rol ${rol}`)
      assert.equal(resBuscar.body.error, 'Acceso denegado: se requiere perfil médico.')
      assert.equal(resFicha.status, 403, `ficha con rol ${rol}`)
      assert.equal(resFicha.body.error, 'Acceso denegado: se requiere perfil médico.')
    }

    assert.equal(db.lecturasBaseDatos, 0)
  })

  await test('Esc.10: Flujo completo del buscador sanea el DNI, invoca las URLs correctas y abre la ficha con el historial', () => {
    const db = crearBaseDatos()
    const estado = simularBuscadorFichaPaciente(db, SESION_MEDICO, ' 35.123.456 ')

    assert.deepEqual(estado.urlsInvocadas, [
      '/api/medicos/pacientes/buscar?dni=35123456',
      '/api/medicos/pacientes/pac_con_historial/ficha',
    ])
    assert.equal(estado.error, null)
    assert.equal(estado.noEncontrado, false)
    assert.equal(estado.pacienteEncontrado?.dni, '35123456')
    assert.equal(estado.fichaAbierta, true)
    assert.equal(estado.atenciones.length, 2)
  })

  await test('Esc.11: El buscador refleja el caso inexistente y bloquea la apertura de ficha para roles no médicos', () => {
    const db = crearBaseDatos()

    const inexistente = simularBuscadorFichaPaciente(db, SESION_MEDICO, '99.887.766')
    assert.equal(inexistente.noEncontrado, true)
    assert.equal(inexistente.fichaAbierta, false)
    assert.deepEqual(inexistente.urlsInvocadas, [
      '/api/medicos/pacientes/buscar?dni=99887766',
    ])

    const invalido = simularBuscadorFichaPaciente(db, SESION_MEDICO, '35-123-456')
    assert.equal(
      invalido.error,
      'El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.'
    )
    assert.deepEqual(invalido.urlsInvocadas, [])

    const noMedico: SesionMock = { ...SESION_MEDICO, rol: 'ENFERMERA' }
    const sinPermiso = simularBuscadorFichaPaciente(db, noMedico, '35123456')
    assert.equal(sinPermiso.error, 'Acceso denegado: se requiere perfil médico.')
    assert.equal(sinPermiso.fichaAbierta, false)
  })

  await test('Esc.12: Fallo de base de datos devuelve 500 controlado sin exponer detalles técnicos en ambos endpoints', () => {
    const db = crearBaseDatos()

    const resBuscar = endpointBuscarPacientePorDni(db, SESION_MEDICO, '35123456', true)
    assert.equal(resBuscar.status, 500)
    assert.equal(resBuscar.body.success, false)
    assert.equal(resBuscar.body.error, 'Error interno al buscar al paciente por DNI.')
    assert.ok(!resBuscar.body.error?.includes('ECONNRESET'))

    const resFicha = endpointObtenerFichaPaciente(db, SESION_MEDICO, 'pac_con_historial', true)
    assert.equal(resFicha.status, 500)
    assert.equal(resFicha.body.success, false)
    assert.equal(
      resFicha.body.error,
      'Error interno al consultar la ficha clínica del paciente.'
    )
    assert.ok(!resFicha.body.error?.includes('ECONNRESET'))

    assert.equal(db.lecturasBaseDatos, 0)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-17 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas unitarias de US-17:', error)
  process.exit(1)
})
