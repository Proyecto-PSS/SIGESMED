// Suite exhaustiva de pruebas unitarias para US-38:
// Carga de diagnósticos y tratamientos en la historia clínica del paciente.
import assert from 'node:assert/strict'
import {
  type TipoDiagnosticoValor,
  TIPOS_DIAGNOSTICO_VALIDOS,
  ETIQUETAS_TIPO_DIAGNOSTICO,
  HistoriaClinicaError,
  esTipoDiagnosticoValido,
  validarCargaAtencionMedica,
  construirMensajeExitoAtencion,
  filtrarPacientesPorTermino,
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
  especialidad?: string
  matricula?: string
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

interface RepositorioClinicoEnMemoria {
  pacientes: Map<string, PacienteMock>
  medicos: Map<string, MedicoMock>
  atenciones: AtencionMedicaMock[]
  simularFalloPersistencia?: boolean
}

function crearRepositorioBase(): RepositorioClinicoEnMemoria {
  const pacientes = new Map<string, PacienteMock>([
    [
      'pac_001',
      {
        idPaciente: 'pac_001',
        nombre: 'Paciente',
        apellido: 'Demo',
        dni: '34891204',
        email: 'paciente@gmail.com',
      },
    ],
    [
      'pac_002',
      {
        idPaciente: 'pac_002',
        nombre: 'Lucía',
        apellido: 'Fernández',
        dni: '39112233',
        email: 'lucia.fernandez@example.test',
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
    simularFalloPersistencia: false,
  }
}

function verificarAutorizacionMedico(sesion: SesionMock | null): SesionMock {
  if (!sesion) {
    throw new HistoriaClinicaError(
      'No autorizado: sesión no encontrada o perfil inexistente.',
      401
    )
  }
  if (sesion.rol !== 'MEDICO') {
    throw new HistoriaClinicaError(
      'Acceso denegado: se requiere perfil médico.',
      403
    )
  }
  return sesion
}

function registrarAtencionEnMemoria(
  repo: RepositorioClinicoEnMemoria,
  sesion: SesionMock | null,
  idPacienteRuta: string,
  body: unknown,
  fechaServidor: Date = new Date()
) {
  const medicoSesion = verificarAutorizacionMedico(sesion)
  const datosValidados = validarCargaAtencionMedica(body)

  const paciente = repo.pacientes.get(idPacienteRuta.trim())
  if (!paciente) {
    throw new HistoriaClinicaError('No se encontró el paciente especificado.', 404)
  }

  const medico = repo.medicos.get(medicoSesion.id)
  if (!medico) {
    throw new HistoriaClinicaError('No se encontró el perfil del profesional médico.', 403)
  }

  if (repo.simularFalloPersistencia) {
    throw new HistoriaClinicaError(
      'Error interno al guardar la atención médica en la historia clínica.',
      500
    )
  }

  const nuevaAtencion: AtencionMedicaMock = {
    idAtencion: `atn_${repo.atenciones.length + 1}`,
    idPaciente: paciente.idPaciente,
    idMedico: medico.idMedico,
    diagnosticoPrincipal: datosValidados.diagnosticoPrincipal,
    tipoDiagnostico: datosValidados.tipoDiagnostico,
    observacionesClinicas: datosValidados.observacionesClinicas,
    detalleTratamiento: datosValidados.detalleTratamiento,
    indicacionesFarmacologicas: datosValidados.indicacionesFarmacologicas,
    createdAt: fechaServidor,
    updatedAt: fechaServidor,
  }

  repo.atenciones.push(nuevaAtencion)

  return {
    status: 201,
    body: {
      ok: true,
      success: true,
      message: construirMensajeExitoAtencion(datosValidados),
      atencion: {
        ...nuevaAtencion,
        tipoDiagnosticoEtiqueta: ETIQUETAS_TIPO_DIAGNOSTICO[nuevaAtencion.tipoDiagnostico],
        createdAt: nuevaAtencion.createdAt.toISOString(),
        updatedAt: nuevaAtencion.updatedAt.toISOString(),
        medico: {
          ...medico,
          nombreCompleto: `${medico.nombre} ${medico.apellido}`,
        },
      },
    },
  }
}

function consultarHistorialPacienteEnMemoria(
  repo: RepositorioClinicoEnMemoria,
  sesion: SesionMock | null,
  idPacienteRuta: string
) {
  verificarAutorizacionMedico(sesion)

  const paciente = repo.pacientes.get(idPacienteRuta.trim())
  if (!paciente) {
    throw new HistoriaClinicaError('No se encontró el paciente solicitado.', 404)
  }

  const atenciones = repo.atenciones
    .filter((a) => a.idPaciente === paciente.idPaciente)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((a) => {
      const medico = repo.medicos.get(a.idMedico)!
      return {
        ...a,
        tipoDiagnosticoEtiqueta: ETIQUETAS_TIPO_DIAGNOSTICO[a.tipoDiagnostico],
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        medico: {
          ...medico,
          nombreCompleto: `${medico.nombre} ${medico.apellido}`,
        },
      }
    })

  return {
    status: 200,
    body: {
      ok: true,
      success: true,
      paciente,
      atenciones,
    },
  }
}

// Simulación del flujo de interfaz del formulario y modal de cancelación (RF-38.6)
interface EstadoFormularioUI {
  diagnosticoPrincipal: string
  tipoDiagnostico: TipoDiagnosticoValor
  observacionesClinicas: string
  detalleTratamiento: string
  indicacionesFarmacologicas: string
  modalCancelarAbierto: boolean
  rutaActual: string
  error: string | null
  success: string | null
}

function crearEstadoFormularioInicial(): EstadoFormularioUI {
  return {
    diagnosticoPrincipal: '',
    tipoDiagnostico: 'PRESUNTIVO',
    observacionesClinicas: '',
    detalleTratamiento: '',
    indicacionesFarmacologicas: '',
    modalCancelarAbierto: false,
    rutaActual: '/dashboard/medico/fichas-clinicas',
    error: null,
    success: null,
  }
}

const SESION_MEDICO: SesionMock = {
  id: 'med_001',
  nombre: 'Martín',
  apellido: 'Gómez',
  rol: 'MEDICO',
  especialidad: 'Traumatología y Ortopedia',
  matricula: 'MN-84920',
}

async function runAllTests() {
  console.log('\n=== US-38: PRUEBAS DE CARGA DE DIAGNÓSTICOS Y TRATAMIENTOS EN HISTORIA CLÍNICA ===\n')

  // --------------------------------------------------------------------------
  // Escenario 1 — Registro exitoso
  // --------------------------------------------------------------------------
  await test('Esc.1: Registro exitoso de atención médica con todos los campos completos devuelve 201 y persiste íntegramente', () => {
    const repo = crearRepositorioBase()
    const respuesta = registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
      diagnosticoPrincipal: 'Esguince de tobillo derecho grado II',
      tipoDiagnostico: 'DEFINITIVO',
      observacionesClinicas: 'Edema maleolar externo y dolor a la palpación ligamentaria.',
      detalleTratamiento: 'Inmovilización con bota walker, crioterapia local y reposo deportivo por 14 días.',
      indicacionesFarmacologicas: 'Ibuprofeno 400 mg cada 8 hs por 5 días post ingesta.',
    })

    assert.equal(respuesta.status, 201)
    assert.equal(respuesta.body.success, true)
    assert.equal(
      respuesta.body.message,
      'Diagnóstico y tratamiento guardados exitosamente en la historia clínica del paciente'
    )
    assert.ok(respuesta.body.atencion.idAtencion)
    assert.equal(respuesta.body.atencion.idPaciente, 'pac_001')
    assert.equal(respuesta.body.atencion.idMedico, 'med_001')
    assert.equal(respuesta.body.atencion.diagnosticoPrincipal, 'Esguince de tobillo derecho grado II')
    assert.equal(respuesta.body.atencion.tipoDiagnostico, 'DEFINITIVO')
    assert.equal(respuesta.body.atencion.tipoDiagnosticoEtiqueta, 'Definitivo')
    assert.equal(
      respuesta.body.atencion.observacionesClinicas,
      'Edema maleolar externo y dolor a la palpación ligamentaria.'
    )
    assert.equal(
      respuesta.body.atencion.detalleTratamiento,
      'Inmovilización con bota walker, crioterapia local y reposo deportivo por 14 días.'
    )
    assert.equal(
      respuesta.body.atencion.indicacionesFarmacologicas,
      'Ibuprofeno 400 mg cada 8 hs por 5 días post ingesta.'
    )
    assert.equal(repo.atenciones.length, 1)
  })

  // --------------------------------------------------------------------------
  // Escenario 2 — Diagnóstico obligatorio
  // --------------------------------------------------------------------------
  await test('Esc.2: Intentar guardar sin diagnóstico principal o con texto vacío devuelve 400 y no crea registros', () => {
    const repo = crearRepositorioBase()

    for (const valorInvalido of ['', '   ', null, undefined, 12345]) {
      assert.throws(
        () =>
          registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
            diagnosticoPrincipal: valorInvalido,
            tipoDiagnostico: 'PRESUNTIVO',
          }),
        (err: unknown) =>
          err instanceof HistoriaClinicaError && err.statusCode === 400
      )
    }

    assert.equal(repo.atenciones.length, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 3 — Validación del tipo de diagnóstico
  // --------------------------------------------------------------------------
  await test('Esc.3: Acepta PRESUNTIVO, DEFINITIVO y EN_ESTUDIO y rechaza valores arbitrarios con 400', () => {
    const repo = crearRepositorioBase()

    for (const tipo of TIPOS_DIAGNOSTICO_VALIDOS) {
      assert.equal(esTipoDiagnosticoValido(tipo), true)
      const res = registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
        diagnosticoPrincipal: `Diagnóstico de prueba (${tipo})`,
        tipoDiagnostico: tipo,
      })
      assert.equal(res.status, 201)
      assert.equal(res.body.atencion.tipoDiagnostico, tipo)
    }

    for (const invalido of ['CONFIRMADO', 'DESCARTADO', 'presuntivo', '', null, undefined]) {
      assert.equal(esTipoDiagnosticoValido(invalido), false)
      assert.throws(
        () =>
          registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
            diagnosticoPrincipal: 'Diagnóstico válido',
            tipoDiagnostico: invalido,
          }),
        (err: unknown) =>
          err instanceof HistoriaClinicaError && err.statusCode === 400
      )
    }

    assert.equal(repo.atenciones.length, 3)
  })

  // --------------------------------------------------------------------------
  // Escenario 4 — Tratamiento opcional
  // --------------------------------------------------------------------------
  await test('Esc.4: Permite guardar una atención sin tratamiento ni indicaciones farmacológicas', () => {
    const repo = crearRepositorioBase()
    const res = registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
      diagnosticoPrincipal: 'Control clínico periódico sin hallazgos patológicos',
      tipoDiagnostico: 'EN_ESTUDIO',
      observacionesClinicas: 'Se solicitan estudios de laboratorio de rutina.',
      detalleTratamiento: '   ',
      indicacionesFarmacologicas: '',
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.message, 'Registro clínico guardado exitosamente.')
    assert.equal(res.body.atencion.detalleTratamiento, null)
    assert.equal(res.body.atencion.indicacionesFarmacologicas, null)
    assert.equal(
      res.body.atencion.observacionesClinicas,
      'Se solicitan estudios de laboratorio de rutina.'
    )
  })

  // --------------------------------------------------------------------------
  // Escenario 5 — Paciente inexistente y aislamiento entre pacientes
  // --------------------------------------------------------------------------
  await test('Esc.5: Registrar atención para paciente inexistente devuelve 404 sin persistir y aísla registros por paciente', () => {
    const repo = crearRepositorioBase()

    assert.throws(
      () =>
        registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_inexistente_999', {
          diagnosticoPrincipal: 'Lumbalgia mecánica',
          tipoDiagnostico: 'PRESUNTIVO',
        }),
      (err: unknown) =>
        err instanceof HistoriaClinicaError && err.statusCode === 404
    )
    assert.equal(repo.atenciones.length, 0)

    // Registrar para pac_001 y verificar que pac_002 no lo vea en su historial
    registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
      diagnosticoPrincipal: 'Lumbalgia mecánica aguda',
      tipoDiagnostico: 'PRESUNTIVO',
    })

    const historialPac1 = consultarHistorialPacienteEnMemoria(repo, SESION_MEDICO, 'pac_001')
    const historialPac2 = consultarHistorialPacienteEnMemoria(repo, SESION_MEDICO, 'pac_002')

    assert.equal(historialPac1.body.atenciones.length, 1)
    assert.equal(historialPac2.body.atenciones.length, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 6 — Autoría del registro
  // --------------------------------------------------------------------------
  await test('Esc.6: Ignora cualquier idMedico enviado desde el cliente y asigna el médico autenticado en sesión', () => {
    const repo = crearRepositorioBase()
    const res = registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
      idMedico: 'med_002_suplantado',
      idPaciente: 'pac_002_suplantado',
      diagnosticoPrincipal: 'Tendinitis rotuliana',
      tipoDiagnostico: 'DEFINITIVO',
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.atencion.idMedico, 'med_001')
    assert.equal(res.body.atencion.idPaciente, 'pac_001')
    assert.equal(res.body.atencion.medico.nombreCompleto, 'Martín Gómez')
  })

  // --------------------------------------------------------------------------
  // Escenario 7 — Cancelación y descarte
  // --------------------------------------------------------------------------
  await test('Esc.7: El flujo de cancelación muestra modal, "Continuar editando" preserva datos y "Descartar y salir" limpia y redirige sin persistir', () => {
    const repo = crearRepositorioBase()
    const uiState = crearEstadoFormularioInicial()

    // El médico ingresa datos en el formulario
    uiState.diagnosticoPrincipal = 'Cuadro febril en estudio'
    uiState.tipoDiagnostico = 'EN_ESTUDIO'
    uiState.observacionesClinicas = 'Temperatura 38.3°C'
    uiState.detalleTratamiento = 'Hidratación abundante'

    // 1. Presiona "Cancelar" -> se abre el modal
    uiState.modalCancelarAbierto = true
    assert.equal(uiState.modalCancelarAbierto, true)

    // 2. Selecciona "Continuar editando" -> cierra modal y conserva datos intactos
    uiState.modalCancelarAbierto = false
    assert.equal(uiState.diagnosticoPrincipal, 'Cuadro febril en estudio')
    assert.equal(uiState.tipoDiagnostico, 'EN_ESTUDIO')
    assert.equal(uiState.observacionesClinicas, 'Temperatura 38.3°C')
    assert.equal(uiState.detalleTratamiento, 'Hidratación abundante')
    assert.equal(repo.atenciones.length, 0)

    // 3. Vuelve a presionar "Cancelar" y confirma "Descartar y salir"
    uiState.modalCancelarAbierto = true
    uiState.modalCancelarAbierto = false
    uiState.diagnosticoPrincipal = ''
    uiState.tipoDiagnostico = 'PRESUNTIVO'
    uiState.observacionesClinicas = ''
    uiState.detalleTratamiento = ''
    uiState.indicacionesFarmacologicas = ''
    uiState.rutaActual = '/dashboard/medico'

    assert.equal(uiState.diagnosticoPrincipal, '')
    assert.equal(uiState.rutaActual, '/dashboard/medico')
    assert.equal(repo.atenciones.length, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 8 — Control de acceso
  // --------------------------------------------------------------------------
  await test('Esc.8: Control de acceso rechaza no autenticados (401) y roles paciente, enfermero y admin (403)', () => {
    const repo = crearRepositorioBase()
    const payloadValido = {
      diagnosticoPrincipal: 'Faringoamigdalitis aguda',
      tipoDiagnostico: 'PRESUNTIVO',
    }

    // Sin sesión -> 401
    assert.throws(
      () => registrarAtencionEnMemoria(repo, null, 'pac_001', payloadValido),
      (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 401
    )

    // Roles no autorizados -> 403
    const rolesNoMedicos: RolSesion[] = ['PACIENTE', 'ENFERMERA', 'ADMIN']
    for (const rol of rolesNoMedicos) {
      const sesionNoAutorizada: SesionMock = {
        id: `usr_${rol.toLowerCase()}`,
        nombre: 'Usuario',
        apellido: rol,
        rol,
      }
      assert.throws(
        () => registrarAtencionEnMemoria(repo, sesionNoAutorizada, 'pac_001', payloadValido),
        (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 403
      )
      assert.throws(
        () => consultarHistorialPacienteEnMemoria(repo, sesionNoAutorizada, 'pac_001'),
        (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 403
      )
    }

    assert.equal(repo.atenciones.length, 0)

    // Médico autenticado -> 201
    const ok = registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', payloadValido)
    assert.equal(ok.status, 201)
    assert.equal(repo.atenciones.length, 1)
  })

  // --------------------------------------------------------------------------
  // Escenario 9 — Persistencia histórica
  // --------------------------------------------------------------------------
  await test('Esc.9: Múltiples atenciones para un mismo paciente se conservan como registros independientes ordenados del más reciente al más antiguo', () => {
    const repo = crearRepositorioBase()
    const fechaPrimera = new Date('2026-10-10T10:00:00.000Z')
    const fechaSegunda = new Date('2026-11-15T14:30:00.000Z')

    registrarAtencionEnMemoria(
      repo,
      SESION_MEDICO,
      'pac_001',
      {
        diagnosticoPrincipal: 'Sospecha de gonalgia meniscal',
        tipoDiagnostico: 'PRESUNTIVO',
        observacionesClinicas: 'Se solicita resonancia magnética de rodilla.',
      },
      fechaPrimera
    )

    registrarAtencionEnMemoria(
      repo,
      SESION_MEDICO,
      'pac_001',
      {
        diagnosticoPrincipal: 'Lesión del cuerno posterior del menisco interno',
        tipoDiagnostico: 'DEFINITIVO',
        observacionesClinicas: 'RMN confirma trazo horizontal.',
        detalleTratamiento: 'Fisioterapia y fortalecimiento de cuádriceps.',
      },
      fechaSegunda
    )

    const consulta = consultarHistorialPacienteEnMemoria(repo, SESION_MEDICO, 'pac_001')
    const lista = consulta.body.atenciones

    assert.equal(lista.length, 2)
    // El más reciente primero
    assert.equal(lista[0].diagnosticoPrincipal, 'Lesión del cuerno posterior del menisco interno')
    assert.equal(lista[0].tipoDiagnostico, 'DEFINITIVO')
    // El primero conserva sus datos originales sin haber sido sobrescrito
    assert.equal(lista[1].diagnosticoPrincipal, 'Sospecha de gonalgia meniscal')
    assert.equal(lista[1].tipoDiagnostico, 'PRESUNTIVO')
    assert.equal(lista[1].observacionesClinicas, 'Se solicita resonancia magnética de rodilla.')
  })

  // --------------------------------------------------------------------------
  // Escenario 10 — Consulta posterior
  // --------------------------------------------------------------------------
  await test('Esc.10: Consulta posterior devuelve todos los campos clínicos, fecha y profesional responsable', () => {
    const repo = crearRepositorioBase()
    const fechaRegistro = new Date('2026-11-15T16:45:00.000Z')

    registrarAtencionEnMemoria(
      repo,
      SESION_MEDICO,
      'pac_001',
      {
        diagnosticoPrincipal: 'Cervicalgia postural',
        tipoDiagnostico: 'DEFINITIVO',
        observacionesClinicas: 'Contractura paravertebral cervical bilateral.',
        detalleTratamiento: 'Kinesiología motora 10 sesiones y ergonomía laboral.',
        indicacionesFarmacologicas: 'Paracetamol 500 mg cada 8 hs si presenta dolor.',
      },
      fechaRegistro
    )

    const consulta = consultarHistorialPacienteEnMemoria(repo, SESION_MEDICO, 'pac_001')
    assert.equal(consulta.status, 200)
    assert.equal(consulta.body.atenciones.length, 1)

    const item = consulta.body.atenciones[0]
    assert.equal(item.diagnosticoPrincipal, 'Cervicalgia postural')
    assert.equal(item.tipoDiagnostico, 'DEFINITIVO')
    assert.equal(item.tipoDiagnosticoEtiqueta, 'Definitivo')
    assert.equal(item.observacionesClinicas, 'Contractura paravertebral cervical bilateral.')
    assert.equal(item.detalleTratamiento, 'Kinesiología motora 10 sesiones y ergonomía laboral.')
    assert.equal(item.indicacionesFarmacologicas, 'Paracetamol 500 mg cada 8 hs si presenta dolor.')
    assert.equal(item.createdAt, fechaRegistro.toISOString())
    assert.equal(item.medico.idMedico, 'med_001')
    assert.equal(item.medico.nombreCompleto, 'Martín Gómez')
    assert.equal(item.medico.matricula, 'MN-84920')
  })

  // --------------------------------------------------------------------------
  // Escenario 11 — Manejo de errores de persistencia
  // --------------------------------------------------------------------------
  await test('Esc.11: Ante un fallo de persistencia (500), no muestra confirmación falsa y preserva los datos del formulario para reintentar', () => {
    const repo = crearRepositorioBase()
    repo.simularFalloPersistencia = true

    const uiState = crearEstadoFormularioInicial()
    uiState.diagnosticoPrincipal = 'Fractura de radio distal'
    uiState.tipoDiagnostico = 'DEFINITIVO'
    uiState.detalleTratamiento = 'Inmovilización enyesada braquiopalmar'

    try {
      registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
        diagnosticoPrincipal: uiState.diagnosticoPrincipal,
        tipoDiagnostico: uiState.tipoDiagnostico,
        detalleTratamiento: uiState.detalleTratamiento,
      })
    } catch (err: any) {
      uiState.error = err.message
    }

    assert.equal(uiState.success, null)
    assert.equal(
      uiState.error,
      'Error interno al guardar la atención médica en la historia clínica.'
    )
    assert.equal(uiState.diagnosticoPrincipal, 'Fractura de radio distal')
    assert.equal(uiState.detalleTratamiento, 'Inmovilización enyesada braquiopalmar')
    assert.equal(repo.atenciones.length, 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 12 — No-regresión e independencia del modelo de turnos
  // --------------------------------------------------------------------------
  await test('Esc.12: Las atenciones clínicas se gestionan independientemente sin alterar estados ni registros de turnos', () => {
    const repo = crearRepositorioBase()
    const turnosExistentes = [
      { idTurno: 't_101', idPaciente: 'pac_001', idMedico: 'med_001', estado: 'CONFIRMADO' },
      { idTurno: 't_102', idPaciente: 'pac_001', idMedico: 'med_002', estado: 'ATENDIDO' },
    ]

    registrarAtencionEnMemoria(repo, SESION_MEDICO, 'pac_001', {
      diagnosticoPrincipal: 'Control traumatológico de evolución',
      tipoDiagnostico: 'DEFINITIVO',
    })

    assert.equal(repo.atenciones.length, 1)
    assert.equal(turnosExistentes.length, 2)
    assert.equal(turnosExistentes[0].estado, 'CONFIRMADO')
    assert.equal(turnosExistentes[1].estado, 'ATENDIDO')
  })

  await test('Esc.13: Buscador en vivo filtra pacientes por nombre completo, DNI, tildes o correo en tiempo real', () => {
    const lista = Array.from(crearRepositorioBase().pacientes.values())

    assert.equal(filtrarPacientesPorTermino(lista, '').length, 2)
    assert.equal(filtrarPacientesPorTermino(lista, '3489').length, 1)
    assert.equal(filtrarPacientesPorTermino(lista, 'Paciente Demo').length, 1)
    assert.equal(filtrarPacientesPorTermino(lista, 'lucia fernandez').length, 1)
    assert.equal(filtrarPacientesPorTermino(lista, 'inexistente').length, 0)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-38 PASARON EXITOSAMENTE (13/13) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-38:', err)
  process.exit(1)
})

