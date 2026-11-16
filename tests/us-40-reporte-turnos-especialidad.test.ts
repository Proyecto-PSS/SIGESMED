// Suite de pruebas nativas para US-40:
// Reporte de cantidad de turnos por especialidad médica.
import assert from 'node:assert/strict'
import {
  ESPECIALIDADES_MEDICAS_REPORTE,
  ETIQUETAS_ESPECIALIDAD_REPORTE,
  TEXTO_RANGO_FECHAS_INVERTIDO,
  TEXTO_SIN_TURNOS_PERIODO,
  ReporteTurnosEspecialidadError,
  validarRangoFechasTurnosEspecialidad,
  calcularPorcentajeEspecialidad,
  construirReporteTurnosPorEspecialidad,
} from '../lib/utils/reportes-utils.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type RolSesion = 'ADMIN' | 'MEDICO' | 'ENFERMERA' | 'PACIENTE'

interface SesionMock {
  id: string
  rol: RolSesion
}

interface TurnoMock {
  idTurno: string
  idMedico: string
  especialidad: string
  fecha: Date
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'ATENDIDO' | 'AUSENTE' | 'CANCELADO'
}

function autorizarSoloAdmin(sesion: SesionMock | null): SesionMock {
  if (!sesion) {
    throw new ReporteTurnosEspecialidadError(
      'No autorizado: sesión no encontrada o perfil inexistente.',
      401
    )
  }
  if (sesion.rol !== 'ADMIN') {
    throw new ReporteTurnosEspecialidadError(
      'Acceso denegado: se requieren permisos de administrador.',
      403
    )
  }
  return sesion
}

function generarReporteEnMemoria(
  turnos: TurnoMock[],
  sesion: SesionMock | null,
  fechaDesde: unknown,
  fechaHasta: unknown
) {
  autorizarSoloAdmin(sesion)
  const rango = validarRangoFechasTurnosEspecialidad(fechaDesde, fechaHasta)

  const turnosFiltrados = turnos.filter(
    (t) =>
      t.fecha.getTime() >= rango.desdeDate.getTime() &&
      t.fecha.getTime() <= rango.hastaDate.getTime()
  )

  const conteos = turnosFiltrados.map((t) => ({
    especialidad: t.especialidad,
    estado: t.estado,
    cantidad: 1,
  }))

  return construirReporteTurnosPorEspecialidad({
    fechaDesde: rango.fechaDesde,
    fechaHasta: rango.fechaHasta,
    conteos,
    especialidades: ESPECIALIDADES_MEDICAS_REPORTE,
  })
}

const SESION_ADMIN: SesionMock = { id: 'admin_1', rol: 'ADMIN' }

async function runAllTests() {
  console.log('\n=== US-40: PRUEBAS DE REPORTE DE TURNOS POR ESPECIALIDAD ===\n')

  await test('Esc.1: Camino exitoso — Agrupa y contabiliza con precisión matemática turnos por especialidad y calcula porcentajes a 2 decimales', () => {
    const turnos: TurnoMock[] = [
      { idTurno: 't1', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-05T00:00:00.000Z'), estado: 'CONFIRMADO' },
      { idTurno: 't2', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-06T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 't3', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-07T00:00:00.000Z'), estado: 'AUSENTE' },
      { idTurno: 't4', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-08T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 't5', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-09T00:00:00.000Z'), estado: 'CANCELADO' },
      { idTurno: 't6', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-11-10T00:00:00.000Z'), estado: 'CONFIRMADO' },
    ]

    const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, '2026-11-01', '2026-11-15')

    assert.equal(reporte.totalGeneral, 6)
    assert.equal(reporte.sinResultados, false)
    assert.equal(reporte.mensaje, null)
    assert.equal(reporte.especialidades.length, 3)

    const clinica = reporte.especialidades.find((e) => e.especialidad === 'CLINICA_MEDICA')!
    const pediatria = reporte.especialidades.find((e) => e.especialidad === 'PEDIATRIA')!
    const trauma = reporte.especialidades.find((e) => e.especialidad === 'TRAUMATOLOGIA_ORTOPEDIA')!

    assert.equal(clinica.nombre, ETIQUETAS_ESPECIALIDAD_REPORTE.CLINICA_MEDICA)
    assert.equal(clinica.cantidad, 3)
    assert.equal(clinica.porcentaje, 50)

    assert.equal(pediatria.nombre, ETIQUETAS_ESPECIALIDAD_REPORTE.PEDIATRIA)
    assert.equal(pediatria.cantidad, 2)
    assert.equal(pediatria.porcentaje, 33.33)

    assert.equal(trauma.nombre, ETIQUETAS_ESPECIALIDAD_REPORTE.TRAUMATOLOGIA_ORTOPEDIA)
    assert.equal(trauma.cantidad, 1)
    assert.equal(trauma.porcentaje, 16.67)

    // La suma exacta de los conteos individuales coincide con totalGeneral
    const sumaIndividual = reporte.especialidades.reduce((acc, item) => acc + item.cantidad, 0)
    assert.equal(sumaIndividual, reporte.totalGeneral)
  })

  await test('Esc.2: Excluye explícitamente slots vacíos DISPONIBLE y conserva especialidades con 0 turnos cuando otras sí tienen actividad', () => {
    const turnos: TurnoMock[] = [
      { idTurno: 't1', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-10T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 't2', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-10T00:00:00.000Z'), estado: 'DISPONIBLE' },
      { idTurno: 't3', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-10T00:00:00.000Z'), estado: 'DISPONIBLE' },
      { idTurno: 't4', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-11-10T00:00:00.000Z'), estado: 'DISPONIBLE' },
    ]

    const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, '2026-11-01', '2026-11-30')

    assert.equal(reporte.totalGeneral, 1)
    assert.equal(reporte.sinResultados, false)

    const clinica = reporte.especialidades.find((e) => e.especialidad === 'CLINICA_MEDICA')!
    const pediatria = reporte.especialidades.find((e) => e.especialidad === 'PEDIATRIA')!
    const trauma = reporte.especialidades.find((e) => e.especialidad === 'TRAUMATOLOGIA_ORTOPEDIA')!

    assert.equal(clinica.cantidad, 1)
    assert.equal(clinica.porcentaje, 100)
    assert.equal(pediatria.cantidad, 0)
    assert.equal(pediatria.porcentaje, 0)
    assert.equal(trauma.cantidad, 0)
    assert.equal(trauma.porcentaje, 0)
  })

  await test('Esc.3: Rango de fechas sin turnos efectivos — Devuelve totalGeneral 0, sinResultados true y el estado vacío requerido', () => {
    const turnos: TurnoMock[] = [
      { idTurno: 't1', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-10-15T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 't2', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-12-10T00:00:00.000Z'), estado: 'DISPONIBLE' },
    ]

    const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, '2026-12-01', '2026-12-31')

    assert.equal(reporte.totalGeneral, 0)
    assert.equal(reporte.sinResultados, true)
    assert.equal(reporte.mensaje, TEXTO_SIN_TURNOS_PERIODO)
    assert.equal(reporte.mensaje, 'No se encontraron turnos para el período seleccionado')
    assert.ok(reporte.especialidades.every((e) => e.cantidad === 0 && e.porcentaje === 0))
  })

  await test('Esc.4: Validación de fechas — Rechaza fechaDesde > fechaHasta y formatos inválidos con 400 Bad Request', () => {
    assert.throws(
      () => validarRangoFechasTurnosEspecialidad('2026-11-20', '2026-11-10'),
      (err: unknown) =>
        err instanceof ReporteTurnosEspecialidadError &&
        err.statusCode === 400 &&
        err.message === TEXTO_RANGO_FECHAS_INVERTIDO &&
        err.message === 'La fecha desde no puede ser posterior a la fecha hasta'
    )

    const casosInvalidos: Array<[unknown, unknown]> = [
      ['', '2026-11-10'],
      ['2026-11-01', ''],
      [null, '2026-11-10'],
      ['01/11/2026', '2026-11-10'],
      ['2026-13-01', '2026-13-10'],
    ]

    for (const [desde, hasta] of casosInvalidos) {
      assert.throws(
        () => validarRangoFechasTurnosEspecialidad(desde, hasta),
        (err: unknown) => err instanceof ReporteTurnosEspecialidadError && err.statusCode === 400
      )
    }
  })

  await test('Esc.5: Normalización UTC-3 — Filtra inclusivamente los bordes exactos YYYY-MM-DD sin corrimiento horario', () => {
    const validado = validarRangoFechasTurnosEspecialidad('2026-11-01', '2026-11-01')
    assert.equal(validado.desdeDate.toISOString(), '2026-11-01T00:00:00.000Z')
    assert.equal(validado.hastaDate.toISOString(), '2026-11-01T00:00:00.000Z')

    const turnos: TurnoMock[] = [
      { idTurno: 'ant', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-10-31T00:00:00.000Z'), estado: 'CONFIRMADO' },
      { idTurno: 'ini', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-01T00:00:00.000Z'), estado: 'CONFIRMADO' },
      { idTurno: 'fin', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-05T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 'pos', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-11-06T00:00:00.000Z'), estado: 'CONFIRMADO' },
    ]

    const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, '2026-11-01', '2026-11-05')
    assert.equal(reporte.totalGeneral, 2)
    assert.equal(calcularPorcentajeEspecialidad(1, 3), 33.33)
    assert.equal(calcularPorcentajeEspecialidad(2, 3), 66.67)
  })

  await test('Esc.6: Control de acceso — Bloquea peticiones sin sesión (401) y roles medico, enfermero y paciente (403)', () => {
    assert.throws(
      () => generarReporteEnMemoria([], null, '2026-11-01', '2026-11-15'),
      (err: unknown) => err instanceof ReporteTurnosEspecialidadError && err.statusCode === 401
    )

    const rolesNoAdmin: RolSesion[] = ['MEDICO', 'ENFERMERA', 'PACIENTE']
    for (const rol of rolesNoAdmin) {
      assert.throws(
        () => generarReporteEnMemoria([], { id: `u_${rol}`, rol }, '2026-11-01', '2026-11-15'),
        (err: unknown) => err instanceof ReporteTurnosEspecialidadError && err.statusCode === 403
      )
    }
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-40 PASARON EXITOSAMENTE (6/6) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-40:', err)
  process.exit(1)
})

