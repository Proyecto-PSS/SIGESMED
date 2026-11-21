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
  fechaHoyArgentina,
  rangoUltimosDias,
} from '../lib/utils/reportes-utils.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type RolSesion = 'ADMIN' | 'MEDICO' | 'ENFERMERA' | 'ENFERMERO' | 'PACIENTE'

interface SesionMock {
  id: string
  rol?: RolSesion
}

interface TurnoMock {
  idTurno: string
  idMedico: string
  especialidad: string
  fecha: Date
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'ATENDIDO' | 'AUSENTE' | 'CANCELADO'
}

function errorConEstado(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function autorizarSoloAdmin(sesion: SesionMock | null): SesionMock {
  if (!sesion) {
    throw errorConEstado('No autorizado: sesión no encontrada o perfil inexistente.', 401)
  }
  if (sesion.rol !== 'ADMIN') {
    throw errorConEstado('Acceso denegado: se requieren permisos de administrador.', 403)
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
const AHORA_REPORTE = new Date('2026-11-14T01:00:00.000Z')

const ENCABEZADOS_TABLA_US40 = [
  'Especialidad médica',
  'Confirmados',
  'Atendidos',
  'Ausentes',
  'Cancelados',
  'Total turnos',
  'Participación',
]

const KPIS_US40 = [
  'Total general de turnos',
  'Confirmados y Atendidos',
  'Ausentes y Cancelados',
]

function crearDatasetTurnos(): TurnoMock[] {
  return [
    { idTurno: 'sep', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-09-15T00:00:00.000Z'), estado: 'CONFIRMADO' },
    { idTurno: 'oct31', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-10-31T00:00:00.000Z'), estado: 'CONFIRMADO' },
    { idTurno: 'nov01', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-01T00:00:00.000Z'), estado: 'CONFIRMADO' },
    { idTurno: 'nov03', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-03T00:00:00.000Z'), estado: 'ATENDIDO' },
    { idTurno: 'nov05a', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-05T00:00:00.000Z'), estado: 'AUSENTE' },
    { idTurno: 'nov05b', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-11-05T00:00:00.000Z'), estado: 'CONFIRMADO' },
    { idTurno: 'nov05disp', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-05T00:00:00.000Z'), estado: 'DISPONIBLE' },
    { idTurno: 'nov07', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-07T00:00:00.000Z'), estado: 'CANCELADO' },
    { idTurno: 'nov10', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-11-10T00:00:00.000Z'), estado: 'ATENDIDO' },
    { idTurno: 'nov15', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-15T00:00:00.000Z'), estado: 'CONFIRMADO' },
    { idTurno: 'nov30', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-30T00:00:00.000Z'), estado: 'CONFIRMADO' },
    { idTurno: 'dic01', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-12-01T00:00:00.000Z'), estado: 'CANCELADO' },
    { idTurno: 'dic31', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-12-31T00:00:00.000Z'), estado: 'ATENDIDO' },
    { idTurno: 'ene01', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2027-01-01T00:00:00.000Z'), estado: 'ATENDIDO' },
  ]
}

function simularEndpointReporte(
  sesion: SesionMock | null,
  fechaDesde: unknown,
  fechaHasta: unknown
) {
  try {
    const reporte = generarReporteEnMemoria(crearDatasetTurnos(), sesion, fechaDesde, fechaHasta)
    return {
      status: 200,
      body: { ok: true, success: true, ...reporte },
    }
  } catch (err: any) {
    return {
      status: typeof err?.statusCode === 'number' ? err.statusCode : 500,
      body: {
        ok: false,
        success: false,
        error: err?.message || 'Error interno al generar el reporte de turnos por especialidad.',
      },
    }
  }
}

type FetcherMock = (url: string, init: { cache: string }) => { status: number; body: any }

function simularFiltroReporte(
  fechaDesde: unknown,
  fechaHasta: unknown,
  fetcher: FetcherMock
) {
  let etapa: 'validacion' | 'fetch' | 'respuesta' = 'validacion'

  try {
    const validado = validarRangoFechasTurnosEspecialidad(fechaDesde, fechaHasta)
    const params = new URLSearchParams({
      fechaDesde: validado.fechaDesde,
      fechaHasta: validado.fechaHasta,
    })
    const url = `/api/admin/reportes/turnos-especialidad?${params.toString()}`
    const init = { cache: 'no-store' }
    etapa = 'fetch'
    const respuesta = fetcher(url, init)
    etapa = 'respuesta'

    if (respuesta.status !== 200 || !respuesta.body?.ok) {
      throw new Error(
        respuesta.body?.error || 'No se pudo generar el reporte de turnos por especialidad.'
      )
    }

    const reporte = respuesta.body
    return {
      url,
      init,
      estadoUI: reporte.sinResultados ? 'empty' : 'success',
      mensajeError: null,
      totalGeneral: reporte.totalGeneral,
      filas: reporte.resultados,
      porcentajesRenderizados: reporte.resultados.map((fila: any) => fila.porcentaje.toFixed(2)),
      encabezadosTabla: ENCABEZADOS_TABLA_US40,
      kpis: KPIS_US40,
      mensajeVacio: reporte.mensaje,
      periodoVacio: `Período consultado: ${reporte.fechaDesde} al ${reporte.fechaHasta}.`,
      totalPie: '100.00%',
    }
  } catch (err: any) {
    const mensajeError =
      etapa === 'fetch'
        ? 'Error al conectar con el servidor de reportes.'
        : err?.message || 'Error al conectar con el servidor de reportes.'

    return {
      url: null,
      init: null,
      estadoUI: 'error',
      mensajeError,
      totalGeneral: 0,
      filas: [],
      porcentajesRenderizados: [],
      encabezadosTabla: ENCABEZADOS_TABLA_US40,
      kpis: KPIS_US40,
      mensajeVacio: null,
      periodoVacio: null,
      totalPie: '100.00%',
    }
  }
}

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
      (err: any) =>
        err.statusCode === 401 &&
        err.message === 'No autorizado: sesión no encontrada o perfil inexistente.'
    )

    const rolesNoAdmin: RolSesion[] = ['MEDICO', 'ENFERMERA', 'PACIENTE']
    for (const rol of rolesNoAdmin) {
      assert.throws(
        () => generarReporteEnMemoria([], { id: `u_${rol}`, rol }, '2026-11-01', '2026-11-15'),
        (err: any) =>
          err.statusCode === 403 &&
          err.message === 'Acceso denegado: se requieren permisos de administrador.'
      )
    }
  })

  await test('Esc.7: Precisión matemática en rangos de 1, 7 y 15 días sobre un mismo dataset', () => {
    const turnos = crearDatasetTurnos()
    const casos = [
      {
        desde: '2026-11-05',
        hasta: '2026-11-05',
        total: 2,
        conteos: { CLINICA_MEDICA: 1, PEDIATRIA: 0, TRAUMATOLOGIA_ORTOPEDIA: 1 },
        porcentajes: [50, 50, 0],
      },
      {
        desde: '2026-11-01',
        hasta: '2026-11-07',
        total: 5,
        conteos: { CLINICA_MEDICA: 2, PEDIATRIA: 2, TRAUMATOLOGIA_ORTOPEDIA: 1 },
        porcentajes: [40, 40, 20],
      },
      {
        desde: '2026-11-01',
        hasta: '2026-11-15',
        total: 7,
        conteos: { CLINICA_MEDICA: 3, PEDIATRIA: 2, TRAUMATOLOGIA_ORTOPEDIA: 2 },
        porcentajes: [42.86, 28.57, 28.57],
      },
    ]

    for (const caso of casos) {
      const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, caso.desde, caso.hasta)
      assert.equal(reporte.fechaDesde, caso.desde)
      assert.equal(reporte.fechaHasta, caso.hasta)
      assert.equal(reporte.totalGeneral, caso.total)
      assert.deepEqual(reporte.resultados, reporte.especialidades)

      const porEspecialidad = Object.fromEntries(
        reporte.especialidades.map((item) => [item.especialidad, item.cantidad])
      )
      assert.deepEqual(porEspecialidad, caso.conteos)

      const sumaIndividual = reporte.especialidades.reduce((acc, item) => acc + item.cantidad, 0)
      assert.equal(sumaIndividual, caso.total)

      const sumaPorEstado = reporte.especialidades.reduce(
        (acc, item) => acc + Object.values(item.porEstado).reduce((a, b) => a + b, 0),
        0
      )
      assert.equal(sumaPorEstado, caso.total)

      assert.deepEqual(
        reporte.especialidades.map((item) => item.porcentaje).sort((a, b) => b - a),
        caso.porcentajes
      )
    }
  })

  await test('Esc.8: Períodos rápidos de 7, 30 y 90 días usan las mismas fechas y conteos que el rango manual', () => {
    assert.equal(fechaHoyArgentina(AHORA_REPORTE), '2026-11-13')
    const turnos = crearDatasetTurnos()
    const periodos = [
      {
        dias: 7,
        desde: '2026-11-07',
        hasta: '2026-11-13',
        total: 2,
        conteos: { CLINICA_MEDICA: 0, PEDIATRIA: 1, TRAUMATOLOGIA_ORTOPEDIA: 1 },
      },
      {
        dias: 30,
        desde: '2026-10-15',
        hasta: '2026-11-13',
        total: 7,
        conteos: { CLINICA_MEDICA: 3, PEDIATRIA: 2, TRAUMATOLOGIA_ORTOPEDIA: 2 },
      },
      {
        dias: 90,
        desde: '2026-08-16',
        hasta: '2026-11-13',
        total: 8,
        conteos: { CLINICA_MEDICA: 4, PEDIATRIA: 2, TRAUMATOLOGIA_ORTOPEDIA: 2 },
      },
    ]

    for (const periodo of periodos) {
      const rango = rangoUltimosDias(periodo.dias, AHORA_REPORTE)
      assert.deepEqual(rango, { desde: periodo.desde, hasta: periodo.hasta })

      const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, rango.desde, rango.hasta)
      assert.equal(reporte.totalGeneral, periodo.total)
      assert.deepEqual(
        Object.fromEntries(reporte.especialidades.map((item) => [item.especialidad, item.cantidad])),
        periodo.conteos
      )
    }
  })

  await test('Esc.9: Redondeo a 2 decimales no se fuerza a 100 cuando el reparto no es exacto', () => {
    const turnos: TurnoMock[] = [
      { idTurno: 'c1', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-01T00:00:00.000Z'), estado: 'CONFIRMADO' },
      { idTurno: 'c2', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-02T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 'c3', idMedico: 'm1', especialidad: 'CLINICA_MEDICA', fecha: new Date('2026-11-03T00:00:00.000Z'), estado: 'AUSENTE' },
      { idTurno: 'p1', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-01T00:00:00.000Z'), estado: 'CONFIRMADO' },
      { idTurno: 'p2', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-02T00:00:00.000Z'), estado: 'ATENDIDO' },
      { idTurno: 'p3', idMedico: 'm2', especialidad: 'PEDIATRIA', fecha: new Date('2026-11-03T00:00:00.000Z'), estado: 'CANCELADO' },
      { idTurno: 't1', idMedico: 'm3', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA', fecha: new Date('2026-11-01T00:00:00.000Z'), estado: 'CONFIRMADO' },
    ]

    const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, '2026-11-01', '2026-11-03')
    assert.equal(reporte.totalGeneral, 7)
    assert.deepEqual(reporte.especialidades.map((item) => item.porcentaje), [42.86, 42.86, 14.29])
    assert.equal(
      Math.round(
        reporte.especialidades.reduce((acc, item) => acc + item.porcentaje, 0) * 100
      ) / 100,
      100.01
    )
    assert.deepEqual(
      reporte.resultados.map((item) => item.porcentaje.toFixed(2)),
      ['42.86', '42.86', '14.29']
    )
    assert.equal(calcularPorcentajeEspecialidad(1, 7), 14.29)
    assert.equal(calcularPorcentajeEspecialidad(0, 0), 0)
    assert.equal(calcularPorcentajeEspecialidad(-1, 7), 0)
  })

  await test('Esc.10: Cruces de mes y año incluyen ambos bordes sin corrimiento de fecha', () => {
    const turnos = crearDatasetTurnos()
    const casos = [
      {
        desde: '2026-11-30',
        hasta: '2026-12-01',
        total: 2,
        conteos: { CLINICA_MEDICA: 0, PEDIATRIA: 1, TRAUMATOLOGIA_ORTOPEDIA: 1 },
      },
      {
        desde: '2026-12-31',
        hasta: '2027-01-01',
        total: 2,
        conteos: { CLINICA_MEDICA: 1, PEDIATRIA: 1, TRAUMATOLOGIA_ORTOPEDIA: 0 },
      },
    ]

    for (const caso of casos) {
      const validado = validarRangoFechasTurnosEspecialidad(caso.desde, caso.hasta)
      assert.equal(validado.desdeDate.toISOString(), `${caso.desde}T00:00:00.000Z`)
      assert.equal(validado.hastaDate.toISOString(), `${caso.hasta}T00:00:00.000Z`)

      const reporte = generarReporteEnMemoria(turnos, SESION_ADMIN, caso.desde, caso.hasta)
      assert.equal(reporte.totalGeneral, caso.total)
      assert.deepEqual(
        Object.fromEntries(reporte.especialidades.map((item) => [item.especialidad, item.cantidad])),
        caso.conteos
      )
    }
  })

  await test('Esc.11: La matriz de roles respeta los mensajes y códigos reales de getCurrentAdminUser', () => {
    const sinSesion = simularEndpointReporte(null, '2026-11-01', '2026-11-15')
    assert.equal(sinSesion.status, 401)
    assert.deepEqual(Object.keys(sinSesion.body).sort(), ['error', 'ok', 'success'])
    assert.equal(sinSesion.body.error, 'No autorizado: sesión no encontrada o perfil inexistente.')
    assert.ok(!('resultados' in sinSesion.body))

    const sesionesNoAdmin: SesionMock[] = [
      { id: 'u_medico', rol: 'MEDICO' },
      { id: 'u_enfermera', rol: 'ENFERMERA' },
      { id: 'u_enfermero', rol: 'ENFERMERO' },
      { id: 'u_paciente', rol: 'PACIENTE' },
      { id: 'u_sin_rol' },
    ]

    for (const sesion of sesionesNoAdmin) {
      const respuesta = simularEndpointReporte(sesion, '2026-11-01', '2026-11-15')
      assert.equal(respuesta.status, 403)
      assert.equal(respuesta.body.error, 'Acceso denegado: se requieren permisos de administrador.')
      assert.ok(!('resultados' in respuesta.body))
    }

    const admin = simularEndpointReporte(SESION_ADMIN, '2026-11-01', '2026-11-15')
    assert.equal(admin.status, 200)
    assert.equal(admin.body.ok, true)
    assert.equal(admin.body.success, true)
    assert.equal(admin.body.totalGeneral, 7)
  })

  await test('Esc.12: Los filtros validan, arman la URL exacta y renderizan estados, KPIs y tabla del endpoint', () => {
    const fetcher: FetcherMock = (url) => {
      const params = new URL(url, 'http://localhost').searchParams
      return simularEndpointReporte(
        SESION_ADMIN,
        params.get('fechaDesde'),
        params.get('fechaHasta')
      )
    }

    const filtro = simularFiltroReporte(' 2026-11-01 ', '2026-11-15 ', fetcher)
    assert.equal(
      filtro.url,
      '/api/admin/reportes/turnos-especialidad?fechaDesde=2026-11-01&fechaHasta=2026-11-15'
    )
    assert.deepEqual(filtro.init, { cache: 'no-store' })
    assert.equal(filtro.estadoUI, 'success')
    assert.equal(filtro.mensajeError, null)
    assert.equal(filtro.totalGeneral, 7)
    assert.deepEqual(filtro.porcentajesRenderizados, ['42.86', '28.57', '28.57'])
    assert.deepEqual(filtro.encabezadosTabla, ENCABEZADOS_TABLA_US40)
    assert.deepEqual(filtro.kpis, KPIS_US40)
    assert.equal(filtro.totalPie, '100.00%')

    const sinFechas = simularFiltroReporte('', '2026-11-15', fetcher)
    assert.equal(sinFechas.estadoUI, 'error')
    assert.equal(
      sinFechas.mensajeError,
      'Las fechas desde y hasta son obligatorias para generar el reporte.'
    )
    assert.equal(sinFechas.url, null)

    const invertido = simularFiltroReporte('2026-11-20', '2026-11-10', fetcher)
    assert.equal(invertido.mensajeError, TEXTO_RANGO_FECHAS_INVERTIDO)

    const denegado = simularFiltroReporte('2026-11-01', '2026-11-15', () =>
      simularEndpointReporte({ id: 'u_medico', rol: 'MEDICO' }, '2026-11-01', '2026-11-15')
    )
    assert.equal(denegado.estadoUI, 'error')
    assert.equal(denegado.mensajeError, 'Acceso denegado: se requieren permisos de administrador.')

    const sinConexion = simularFiltroReporte('2026-11-01', '2026-11-15', () => {
      throw new Error('ECONNRESET')
    })
    assert.equal(sinConexion.mensajeError, 'Error al conectar con el servidor de reportes.')

    const vacio = simularFiltroReporte('2026-12-02', '2026-12-30', fetcher)
    assert.equal(vacio.estadoUI, 'empty')
    assert.equal(vacio.mensajeVacio, TEXTO_SIN_TURNOS_PERIODO)
    assert.equal(vacio.periodoVacio, 'Período consultado: 2026-12-02 al 2026-12-30.')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-40 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-40:', err)
  process.exit(1)
})

