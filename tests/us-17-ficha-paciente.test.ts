// Suite de pruebas nativas para US-17:
// Búsqueda por DNI y acceso a la ficha clínica del paciente.
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
  medico: {
    idMedico: string
    nombre: string
    apellido: string
    especialidad: string
    matricula: string
  }
}

interface ContextoRepositorioUS17 {
  pacientes: PacienteMock[]
  atenciones: AtencionMock[]
  lecturasBaseDatos: number
}

function crearRepositorioUS17(): ContextoRepositorioUS17 {
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
        medico: {
          idMedico: 'med_1',
          nombre: 'Martín',
          apellido: 'Gómez',
          especialidad: 'CLINICA_MEDICA',
          matricula: 'MN-84920',
        },
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
        medico: {
          idMedico: 'med_1',
          nombre: 'Martín',
          apellido: 'Gómez',
          especialidad: 'CLINICA_MEDICA',
          matricula: 'MN-84920',
        },
      },
    ],
  }
}

function autorizarSoloMedico(sesion: SesionMock | null): SesionMock {
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

function buscarPacientePorDniEnMemoria(
  repo: ContextoRepositorioUS17,
  sesion: SesionMock | null,
  dniInput: unknown
) {
  autorizarSoloMedico(sesion)
  // Validación previa a consultar la base de datos (RF-17.2)
  const dniLimpio = validarDniBusqueda(dniInput)

  repo.lecturasBaseDatos += 1
  const encontrado = repo.pacientes.find((p) => p.dni === dniLimpio)

  if (!encontrado) {
    throw new HistoriaClinicaError(TEXTO_DNI_NO_ENCONTRADO, 404)
  }

  const cantidadAtenciones = repo.atenciones.filter(
    (a) => a.idPaciente === encontrado.idPaciente
  ).length

  return {
    status: 200,
    body: {
      ok: true,
      success: true,
      paciente: {
        ...encontrado,
        cantidadAtenciones,
      },
    },
  }
}

function obtenerDetalleFichaEnMemoria(
  repo: ContextoRepositorioUS17,
  sesion: SesionMock | null,
  idPaciente: string
) {
  autorizarSoloMedico(sesion)
  const idLimpio = idPaciente?.trim()
  if (!idLimpio) {
    throw new HistoriaClinicaError('El identificador del paciente es obligatorio.', 400)
  }

  repo.lecturasBaseDatos += 1
  const paciente = repo.pacientes.find((p) => p.idPaciente === idLimpio)
  if (!paciente) {
    throw new HistoriaClinicaError('No se encontró el paciente solicitado.', 404)
  }

  const atenciones = repo.atenciones
    .filter((a) => a.idPaciente === paciente.idPaciente)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((a) => ({
      ...a,
      tipoDiagnosticoEtiqueta: ETIQUETAS_TIPO_DIAGNOSTICO[a.tipoDiagnostico],
      createdAt: a.createdAt.toISOString(),
      fechaFormateadaArgentina: formatearFechaHoraAtencionArgentina(a.createdAt),
    }))

  const sinRegistrosClinicos = atenciones.length === 0

  return {
    status: 200,
    body: {
      ok: true,
      success: true,
      paciente: {
        ...paciente,
        cantidadAtenciones: atenciones.length,
      },
      atenciones,
      sinRegistrosClinicos,
      mensajeHistorialVacio: sinRegistrosClinicos
        ? TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS
        : null,
    },
  }
}

const SESION_MEDICO: SesionMock = {
  id: 'med_1',
  nombre: 'Martín',
  apellido: 'Gómez',
  rol: 'MEDICO',
}

async function runAllTests() {
  console.log('\n=== US-17: PRUEBAS DE BÚSQUEDA POR DNI Y ACCESO A FICHA CLÍNICA ===\n')

  await test('Esc.1: Camino exitoso — Búsqueda por DNI (con o sin puntos/espacios) localiza al paciente y abre su ficha clínica con historial US-38', () => {
    const repo = crearRepositorioUS17()

    // Búsqueda con puntos y espacios se sanea correctamente
    const resBusqueda = buscarPacientePorDniEnMemoria(repo, SESION_MEDICO, ' 35.123.456 ')
    assert.equal(resBusqueda.status, 200)
    assert.equal(resBusqueda.body.paciente.idPaciente, 'pac_con_historial')
    assert.equal(resBusqueda.body.paciente.nombre, 'Juan')
    assert.equal(resBusqueda.body.paciente.apellido, 'Pérez')
    assert.equal(resBusqueda.body.paciente.dni, '35123456')
    assert.equal(resBusqueda.body.paciente.obraSocial, 'OSDE')
    assert.equal(resBusqueda.body.paciente.numeroAfiliado, '123456789')
    assert.equal(resBusqueda.body.paciente.cantidadAtenciones, 2)

    // Acceso al detalle de la ficha clínica
    const resFicha = obtenerDetalleFichaEnMemoria(
      repo,
      SESION_MEDICO,
      resBusqueda.body.paciente.idPaciente
    )
    assert.equal(resFicha.status, 200)
    assert.equal(resFicha.body.sinRegistrosClinicos, false)
    assert.equal(resFicha.body.mensajeHistorialVacio, null)
    assert.equal(resFicha.body.atenciones.length, 2)
    // Ordenado del más reciente al más antiguo
    assert.equal(
      resFicha.body.atenciones[0].diagnosticoPrincipal,
      'Control evolutivo cardiovascular'
    )
    assert.equal(
      resFicha.body.atenciones[1].diagnosticoPrincipal,
      'Hipertensión arterial esencial controlada'
    )
  })

  await test('Esc.2: Búsqueda sin resultados — DNI con formato válido inexistente devuelve 404 con el mensaje exacto requerido', () => {
    const repo = crearRepositorioUS17()

    assert.throws(
      () => buscarPacientePorDniEnMemoria(repo, SESION_MEDICO, '99887766'),
      (err: unknown) =>
        err instanceof HistoriaClinicaError &&
        err.statusCode === 404 &&
        err.message === 'No se encontraron pacientes con el DNI ingresado'
    )
    assert.equal(repo.lecturasBaseDatos, 1)
  })

  await test('Esc.3: Validación de formato de DNI — Rechaza DNI vacío, alfanumérico o fuera de 7-8 dígitos con 400 antes de consultar la BD', () => {
    const repo = crearRepositorioUS17()

    assert.equal(sanearDniBusqueda(' 34.891.204 '), '34891204')
    assert.equal(esDniValido('34891204'), true)
    assert.equal(esDniValido('7654321'), true)

    const dnisInvalidos: unknown[] = [
      '',
      '   ',
      '123456', // 6 dígitos
      '123456789', // 9 dígitos
      '3512345A', // contiene letra
      '-35123456', // negativo
      '35-123-456', // guiones
      null,
      undefined,
    ]

    for (const invalido of dnisInvalidos) {
      assert.throws(
        () => buscarPacientePorDniEnMemoria(repo, SESION_MEDICO, invalido),
        (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 400
      )
    }

    // Ninguna consulta inválida debe golpear la base de datos
    assert.equal(repo.lecturasBaseDatos, 0)
  })

  await test('Esc.4: Paciente sin registros clínicos previos — Abre la ficha con sus datos personales y el mensaje explícito requerido', () => {
    const repo = crearRepositorioUS17()

    const resBusqueda = buscarPacientePorDniEnMemoria(repo, SESION_MEDICO, '40222333')
    assert.equal(resBusqueda.status, 200)
    assert.equal(resBusqueda.body.paciente.idPaciente, 'pac_sin_historial')
    assert.equal(resBusqueda.body.paciente.cantidadAtenciones, 0)

    const resFicha = obtenerDetalleFichaEnMemoria(repo, SESION_MEDICO, 'pac_sin_historial')
    assert.equal(resFicha.status, 200)
    assert.equal(resFicha.body.paciente.nombre, 'María')
    assert.equal(resFicha.body.paciente.apellido, 'González')
    assert.equal(resFicha.body.paciente.dni, '40222333')
    assert.equal(resFicha.body.paciente.obraSocial, 'Swiss Medical')
    assert.equal(resFicha.body.atenciones.length, 0)
    assert.equal(resFicha.body.sinRegistrosClinicos, true)
    assert.equal(
      resFicha.body.mensajeHistorialVacio,
      'Este paciente aún no posee registros clínicos cargados'
    )
  })

  await test('Esc.5: Bloqueo de seguridad por rol no autorizado — Rechaza sin sesión (401) y roles enfermero, paciente y admin (403) sin consultar la BD', () => {
    const repo = crearRepositorioUS17()

    // Sin sesión -> 401
    assert.throws(
      () => buscarPacientePorDniEnMemoria(repo, null, '35123456'),
      (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 401
    )
    assert.throws(
      () => obtenerDetalleFichaEnMemoria(repo, null, 'pac_con_historial'),
      (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 401
    )

    // Roles no médicos -> 403
    const rolesBloqueados: RolSesion[] = ['ENFERMERA', 'PACIENTE', 'ADMIN']
    for (const rol of rolesBloqueados) {
      const sesionNoMedica: SesionMock = {
        id: `usr_${rol.toLowerCase()}`,
        nombre: 'Usuario',
        apellido: rol,
        rol,
      }
      assert.throws(
        () => buscarPacientePorDniEnMemoria(repo, sesionNoMedica, '35123456'),
        (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 403
      )
      assert.throws(
        () => obtenerDetalleFichaEnMemoria(repo, sesionNoMedica, 'pac_con_historial'),
        (err: unknown) => err instanceof HistoriaClinicaError && err.statusCode === 403
      )
    }

    assert.equal(repo.lecturasBaseDatos, 0)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-17 PASARON EXITOSAMENTE (5/5) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-17:', err)
  process.exit(1)
})

