// Suite exhaustiva de pruebas unitarias para US-43:
// Reporte de asistencia de pacientes, actualización proporcional ante cambios de estado,
// exclusión de turnos no finalizados, formateo, RBAC del endpoint y cliente HTTP.
import assert from 'node:assert/strict'
import {
  CATEGORIA_POR_ESTADO_FINAL,
  ENDPOINT_REPORTE_ASISTENCIA,
  ESTADOS_CONSULTADOS_ASISTENCIA,
  ESTADOS_FINALES_ASISTENCIA,
  ESTADOS_NO_FINALIZADOS_ASISTENCIA,
  TEXTO_ERROR_REPORTE_ASISTENCIA,
  TEXTO_SIN_TURNOS_FINALIZADOS,
  calcularMetricasAsistencia,
  calcularPorcentajeAsistencia,
  construirReporteAsistencia,
  ejecutarReporteAsistencia,
  formatearPorcentajeAsistencia,
  solicitarReporteAsistencia,
  validarRangoFechasAsistencia,
} from '../lib/utils/reportes-asistencia-utils.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

async function runAllTests() {
  console.log('\n=== US-43: PRUEBAS DE REPORTE DE ASISTENCIA DE PACIENTES ===\n')

  // --------------------------------------------------------------------------
  // 1. Consistencia de constantes de estados
  // --------------------------------------------------------------------------
  await test('Esc.1: Catálogo de estados finales, no finalizados y consultados excluye DISPONIBLE', () => {
    assert.deepEqual(ESTADOS_FINALES_ASISTENCIA, ['ATENDIDO', 'AUSENTE', 'CANCELADO'])
    assert.deepEqual(ESTADOS_NO_FINALIZADOS_ASISTENCIA, ['CONFIRMADO'])
    assert.deepEqual(ESTADOS_CONSULTADOS_ASISTENCIA, ['ATENDIDO', 'AUSENTE', 'CANCELADO', 'CONFIRMADO'])
    assert.equal(
      (ESTADOS_CONSULTADOS_ASISTENCIA as readonly string[]).includes('DISPONIBLE'),
      false,
      'DISPONIBLE nunca debe entrar en la consulta de asistencia'
    )
    assert.equal(CATEGORIA_POR_ESTADO_FINAL.ATENDIDO, 'atendidos')
    assert.equal(CATEGORIA_POR_ESTADO_FINAL.AUSENTE, 'ausentes')
    assert.equal(CATEGORIA_POR_ESTADO_FINAL.CANCELADO, 'cancelados')
  })

  // --------------------------------------------------------------------------
  // 2. Cálculo base de métricas y porcentajes exactos
  // --------------------------------------------------------------------------
  await test('Esc.2: Calcula cantidades, denominador único y porcentajes exactos que suman 100%', () => {
    const metricas = calcularMetricasAsistencia([
      { estado: 'ATENDIDO', cantidad: 6 },
      { estado: 'AUSENTE', cantidad: 2 },
      { estado: 'CANCELADO', cantidad: 2 },
    ])

    assert.equal(metricas.totalTurnosFinalizados, 10)
    assert.deepEqual(metricas.atendidos, { cantidad: 6, porcentaje: 60 })
    assert.deepEqual(metricas.ausentes, { cantidad: 2, porcentaje: 20 })
    assert.deepEqual(metricas.cancelados, { cantidad: 2, porcentaje: 20 })
    assert.equal(metricas.turnosNoFinalizados, 0)

    const sumaPorcentajes =
      metricas.atendidos.porcentaje + metricas.ausentes.porcentaje + metricas.cancelados.porcentaje
    assert.equal(sumaPorcentajes, 100)
  })

  // --------------------------------------------------------------------------
  // 3. Exclusión de CONFIRMADO, DISPONIBLE y estados inválidos / prototype
  // --------------------------------------------------------------------------
  await test('Esc.3: Excluye CONFIRMADO del denominador y descarta DISPONIBLE, desconocidos y claves de Object.prototype', () => {
    const metricas = calcularMetricasAsistencia([
      { estado: 'ATENDIDO', cantidad: 3 },
      { estado: 'AUSENTE', cantidad: 1 },
      { estado: 'CONFIRMADO', cantidad: 5 },
      { estado: 'DISPONIBLE', cantidad: 20 },
      { estado: 'PENDIENTE', cantidad: 4 },
      { estado: 'toString', cantidad: 9 },
      { estado: 'constructor', cantidad: 9 },
      { estado: '__proto__', cantidad: 9 },
    ])

    // Denominador = 3 + 1 = 4 (CONFIRMADO suma solo a turnosNoFinalizados)
    assert.equal(metricas.totalTurnosFinalizados, 4)
    assert.equal(metricas.turnosNoFinalizados, 5)
    assert.deepEqual(metricas.atendidos, { cantidad: 3, porcentaje: 75 })
    assert.deepEqual(metricas.ausentes, { cantidad: 1, porcentaje: 25 })
    assert.deepEqual(metricas.cancelados, { cantidad: 0, porcentaje: 0 })
  })

  // --------------------------------------------------------------------------
  // 4. Actualización proporcional exacta al modificar estados de turnos
  // --------------------------------------------------------------------------
  await test('Esc.4: Simulación de cambios de estado en turnos recalcula proporciones de forma exacta', () => {
    // Foto inicial: 2 ATENDIDO, 1 AUSENTE, 1 CANCELADO, 2 CONFIRMADO (denominador = 4)
    const foto1 = construirReporteAsistencia({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      conteos: [
        { estado: 'ATENDIDO', cantidad: 2 },
        { estado: 'AUSENTE', cantidad: 1 },
        { estado: 'CANCELADO', cantidad: 1 },
        { estado: 'CONFIRMADO', cantidad: 2 },
      ],
    })
    assert.equal(foto1.totalTurnosFinalizados, 4)
    assert.equal(foto1.turnosNoFinalizados, 2)
    assert.equal(foto1.atendidos.porcentaje, 50)
    assert.equal(foto1.ausentes.porcentaje, 25)
    assert.equal(foto1.cancelados.porcentaje, 25)
    assert.equal(foto1.sinResultados, false)
    assert.equal(foto1.mensaje, null)

    // Cambio 1: un turno CONFIRMADO pasa a ATENDIDO (denominador = 5)
    const foto2 = construirReporteAsistencia({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      conteos: [
        { estado: 'ATENDIDO', cantidad: 3 },
        { estado: 'AUSENTE', cantidad: 1 },
        { estado: 'CANCELADO', cantidad: 1 },
        { estado: 'CONFIRMADO', cantidad: 1 },
      ],
    })
    assert.equal(foto2.totalTurnosFinalizados, 5)
    assert.equal(foto2.turnosNoFinalizados, 1)
    assert.equal(foto2.atendidos.porcentaje, 60)
    assert.equal(foto2.ausentes.porcentaje, 20)
    assert.equal(foto2.cancelados.porcentaje, 20)

    // Cambio 2: un turno ATENDIDO se corrige a AUSENTE (denominador sigue en 5)
    const foto3 = construirReporteAsistencia({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      conteos: [
        { estado: 'ATENDIDO', cantidad: 2 },
        { estado: 'AUSENTE', cantidad: 2 },
        { estado: 'CANCELADO', cantidad: 1 },
        { estado: 'CONFIRMADO', cantidad: 1 },
      ],
    })
    assert.equal(foto3.totalTurnosFinalizados, 5)
    assert.equal(foto3.atendidos.porcentaje, 40)
    assert.equal(foto3.ausentes.porcentaje, 40)
    assert.equal(foto3.cancelados.porcentaje, 20)

    // Cambio 3: el último CONFIRMADO se cancela (denominador = 6, tercios exactos)
    const foto4 = construirReporteAsistencia({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      conteos: [
        { estado: 'ATENDIDO', cantidad: 2 },
        { estado: 'AUSENTE', cantidad: 2 },
        { estado: 'CANCELADO', cantidad: 2 },
      ],
    })
    assert.equal(foto4.totalTurnosFinalizados, 6)
    assert.equal(foto4.turnosNoFinalizados, 0)
    assert.ok(Math.abs(foto4.atendidos.porcentaje - 100 / 3) < 1e-12)
    assert.ok(Math.abs(foto4.ausentes.porcentaje - 100 / 3) < 1e-12)
    assert.ok(Math.abs(foto4.cancelados.porcentaje - 100 / 3) < 1e-12)
  })

  // --------------------------------------------------------------------------
  // 5. Denominador cero (sin turnos o solo CONFIRMADO) sin división por cero
  // --------------------------------------------------------------------------
  await test('Esc.5: Sin turnos finalizados (vacío o solo CONFIRMADO) evita NaN/Infinity e informa estado vacío', () => {
    const vacio = construirReporteAsistencia({
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      conteos: [],
    })
    assert.equal(vacio.totalTurnosFinalizados, 0)
    assert.equal(vacio.turnosNoFinalizados, 0)
    assert.equal(vacio.sinResultados, true)
    assert.equal(vacio.mensaje, TEXTO_SIN_TURNOS_FINALIZADOS)
    assert.deepEqual(vacio.atendidos, { cantidad: 0, porcentaje: 0 })
    assert.deepEqual(vacio.ausentes, { cantidad: 0, porcentaje: 0 })
    assert.deepEqual(vacio.cancelados, { cantidad: 0, porcentaje: 0 })

    // Solo turnos CONFIRMADO: sigue siendo sinResultados = true, pero informa cuántos hay sin resolver
    const soloConfirmados = construirReporteAsistencia({
      fechaDesde: '2026-12-01',
      fechaHasta: '2026-12-31',
      conteos: [{ estado: 'CONFIRMADO', cantidad: 7 }],
    })
    assert.equal(soloConfirmados.totalTurnosFinalizados, 0)
    assert.equal(soloConfirmados.turnosNoFinalizados, 7)
    assert.equal(soloConfirmados.sinResultados, true)
    assert.equal(soloConfirmados.mensaje, TEXTO_SIN_TURNOS_FINALIZADOS)
    assert.equal(Number.isNaN(soloConfirmados.atendidos.porcentaje), false)

    // Protección directa en calcularPorcentajeAsistencia
    assert.equal(calcularPorcentajeAsistencia(0, 0), 0)
    assert.equal(calcularPorcentajeAsistencia(5, 0), 0)
    assert.equal(calcularPorcentajeAsistencia(-2, 10), 0)
    assert.equal(calcularPorcentajeAsistencia(2, -10), 0)
  })

  // --------------------------------------------------------------------------
  // 6. Entradas duplicadas y cantidades inválidas
  // --------------------------------------------------------------------------
  await test('Esc.6: Acumula entradas repetidas del mismo estado e ignora cantidades cero, negativas o no finitas', () => {
    const metricas = calcularMetricasAsistencia([
      { estado: 'ATENDIDO', cantidad: 2 },
      { estado: 'ATENDIDO', cantidad: 3 },
      { estado: 'AUSENTE', cantidad: 0 },
      { estado: 'AUSENTE', cantidad: -4 },
      { estado: 'CANCELADO', cantidad: Number.NaN },
      { estado: 'CANCELADO', cantidad: Number.POSITIVE_INFINITY },
      { estado: 'CONFIRMADO', cantidad: 1 },
      { estado: 'CONFIRMADO', cantidad: 2 },
    ])

    assert.equal(metricas.totalTurnosFinalizados, 5)
    assert.deepEqual(metricas.atendidos, { cantidad: 5, porcentaje: 100 })
    assert.deepEqual(metricas.ausentes, { cantidad: 0, porcentaje: 0 })
    assert.deepEqual(metricas.cancelados, { cantidad: 0, porcentaje: 0 })
    assert.equal(metricas.turnosNoFinalizados, 3)
  })

  // --------------------------------------------------------------------------
  // 7. Formateo visual en español argentino (1 decimal máximo)
  // --------------------------------------------------------------------------
  await test('Esc.7: formatearPorcentajeAsistencia redondea a 1 decimal en es-AR y sanitiza valores no finitos', () => {
    assert.equal(formatearPorcentajeAsistencia(0), '0 %')
    assert.equal(formatearPorcentajeAsistencia(100), '100 %')
    assert.equal(formatearPorcentajeAsistencia(25), '25 %')
    assert.equal(formatearPorcentajeAsistencia(12.5), '12,5 %')
    assert.equal(formatearPorcentajeAsistencia(100 / 3), '33,3 %')
    assert.equal(formatearPorcentajeAsistencia(200 / 3), '66,7 %')
    assert.equal(formatearPorcentajeAsistencia(Number.NaN), '0 %')
    assert.equal(formatearPorcentajeAsistencia(Number.POSITIVE_INFINITY), '0 %')
  })

  // --------------------------------------------------------------------------
  // 8. Validación de rangos de fechas
  // --------------------------------------------------------------------------
  await test('Esc.8: validarRangoFechasAsistencia valida formato estricto, fechas inexistentes y orden cronológico', () => {
    assert.deepEqual(validarRangoFechasAsistencia(' 2026-11-01 ', ' 2026-11-22 '), {
      ok: true,
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-22',
    })
    assert.equal(validarRangoFechasAsistencia('2026-11-22', '2026-11-22').ok, true)

    const faltante = validarRangoFechasAsistencia('', '2026-11-22')
    assert.equal(faltante.ok, false)
    if (!faltante.ok) assert.equal(faltante.code, 'FECHAS_REQUERIDAS')

    const inexistente = validarRangoFechasAsistencia('2026-02-29', '2026-03-01')
    assert.equal(inexistente.ok, false)
    if (!inexistente.ok) assert.equal(inexistente.code, 'FORMATO_FECHA_INVALIDO')

    const invertido = validarRangoFechasAsistencia('2026-11-30', '2026-11-01')
    assert.equal(invertido.ok, false)
    if (!invertido.ok) assert.equal(invertido.code, 'RANGO_FECHAS_INVALIDO')
  })

  // --------------------------------------------------------------------------
  // 9. Orquestación del endpoint: control de acceso RBAC (401 / 403 / 500)
  // --------------------------------------------------------------------------
  await test('Esc.9: Control de acceso en endpoint rechaza sin sesión (401) y no-admin (403) antes de consultar BD', async () => {
    let consultoBD = false
    const obtenerReporteEspia = async () => {
      consultoBD = true
      throw new Error('No debe consultar la BD sin autorización')
    }

    // Sin sesión -> 401 (incluso con rango inválido, primero autoriza)
    const res401 = await ejecutarReporteAsistencia({
      autorizar: async () => {
        throw Object.assign(new Error('Sin sesión'), { statusCode: 401 })
      },
      obtenerReporte: obtenerReporteEspia,
      fechaDesde: 'invalida',
      fechaHasta: '',
    })
    assert.equal(res401.status, 401)
    assert.equal(res401.body.ok, false)
    assert.equal('atendidos' in res401.body, false)
    assert.equal('totalTurnosFinalizados' in res401.body, false)
    assert.equal(consultoBD, false)

    // Roles PACIENTE, MEDICO, ENFERMERA -> 403 sin filtrar métricas
    const res403 = await ejecutarReporteAsistencia({
      autorizar: async () => {
        throw Object.assign(new Error('Prohibido'), { statusCode: 403 })
      },
      obtenerReporte: obtenerReporteEspia,
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
    })
    assert.equal(res403.status, 403)
    assert.equal(res403.body.ok, false)
    assert.match(String(res403.body.error), /administrador/i)
    assert.equal('atendidos' in res403.body, false)
    assert.equal(consultoBD, false)

    // Error inesperado en proveedor de auth (Clerk caído) -> 500 seguro
    let errorLogueado: unknown = null
    const resAuth500 = await ejecutarReporteAsistencia({
      autorizar: async () => {
        throw new Error('Clerk upstream timeout')
      },
      obtenerReporte: obtenerReporteEspia,
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      registrarError: (err) => {
        errorLogueado = err
      },
    })
    assert.equal(resAuth500.status, 500)
    assert.equal(resAuth500.body.error, TEXTO_ERROR_REPORTE_ASISTENCIA)
    assert.ok(errorLogueado instanceof Error)
    assert.equal(consultoBD, false)
  })

  // --------------------------------------------------------------------------
  // 10. Orquestación del endpoint: 400 rango inválido, 200 éxito y 500 seguro
  // --------------------------------------------------------------------------
  await test('Esc.10: Endpoint devuelve 400 ante rango inválido, 200 con métricas y 500 sin exponer detalles de BD', async () => {
    let consultoBD = false

    const res400 = await ejecutarReporteAsistencia({
      autorizar: async () => ({ id: 'admin_1', rol: 'ADMIN' }),
      obtenerReporte: async () => {
        consultoBD = true
        throw new Error('No debe ejecutarse')
      },
      fechaDesde: '2026-11-25',
      fechaHasta: '2026-11-01',
    })
    assert.equal(res400.status, 400)
    assert.equal(res400.body.code, 'RANGO_FECHAS_INVALIDO')
    assert.equal(consultoBD, false)

    const reporteEsperado = construirReporteAsistencia({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      conteos: [
        { estado: 'ATENDIDO', cantidad: 8 },
        { estado: 'AUSENTE', cantidad: 1 },
        { estado: 'CANCELADO', cantidad: 1 },
        { estado: 'CONFIRMADO', cantidad: 3 },
      ],
    })

    const res200 = await ejecutarReporteAsistencia({
      autorizar: async () => ({ id: 'admin_1', rol: 'ADMIN' }),
      obtenerReporte: async (d, h) => {
        assert.equal(d, '2026-11-01')
        assert.equal(h, '2026-11-30')
        return reporteEsperado
      },
      fechaDesde: ' 2026-11-01 ',
      fechaHasta: ' 2026-11-30 ',
    })
    assert.equal(res200.status, 200)
    assert.equal(res200.body.ok, true)
    assert.equal(res200.body.totalTurnosFinalizados, 10)
    assert.equal(res200.body.turnosNoFinalizados, 3)

    let errorBD: unknown = null
    const res500 = await ejecutarReporteAsistencia({
      autorizar: async () => ({ id: 'admin_1', rol: 'ADMIN' }),
      obtenerReporte: async () => {
        throw new Error('PrismaClientKnownRequestError: relation "turnos" locked')
      },
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      registrarError: (err) => {
        errorBD = err
      },
    })
    assert.equal(res500.status, 500)
    assert.equal(res500.body.error, TEXTO_ERROR_REPORTE_ASISTENCIA)
    assert.equal(String(res500.body.error).includes('Prisma'), false)
    assert.ok(errorBD instanceof Error)
  })

  // --------------------------------------------------------------------------
  // 11. Cliente HTTP del frontend (solicitarReporteAsistencia)
  // --------------------------------------------------------------------------
  await test('Esc.11: Cliente frena rangos inválidos antes de llamar a fetch y valida respuestas y errores de red', async () => {
    let llamadas = 0
    const invalido = await solicitarReporteAsistencia('2026-11-30', '2026-11-01', async () => {
      llamadas++
      throw new Error('No debe llamar a fetch')
    })
    assert.equal(invalido.estado, 'rango_invalido')
    assert.equal(llamadas, 0)

    let urlUsada = ''
    const reporteMock = construirReporteAsistencia({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      conteos: [{ estado: 'ATENDIDO', cantidad: 4 }],
    })
    const exito = await solicitarReporteAsistencia('2026-11-01', '2026-11-30', async (url) => {
      urlUsada = url
      return { ok: true, json: async () => reporteMock }
    })
    assert.equal(urlUsada, `${ENDPOINT_REPORTE_ASISTENCIA}?fechaDesde=2026-11-01&fechaHasta=2026-11-30`)
    assert.equal(exito.estado, 'exito')
    if (exito.estado === 'exito') {
      assert.equal(exito.reporte.atendidos.porcentaje, 100)
    }

    // Error HTTP con mensaje del servidor
    const errHttp = await solicitarReporteAsistencia('2026-11-01', '2026-11-30', async () => ({
      ok: false,
      json: async () => ({ error: 'Acceso denegado: se requieren permisos de administrador.' }),
    }))
    assert.deepEqual(errHttp, {
      estado: 'error',
      error: 'Acceso denegado: se requieren permisos de administrador.',
    })

    // Respuesta 200 malformada (faltan categorías o valores no finitos)
    const errMalformado = await solicitarReporteAsistencia('2026-11-01', '2026-11-30', async () => ({
      ok: true,
      json: async () => ({
        fechaDesde: '2026-11-01',
        fechaHasta: '2026-11-30',
        totalTurnosFinalizados: 5,
        atendidos: { cantidad: 5, porcentaje: '100' },
      }),
    }))
    assert.deepEqual(errMalformado, { estado: 'error', error: TEXTO_ERROR_REPORTE_ASISTENCIA })

    // Fallo de red
    const errRed = await solicitarReporteAsistencia('2026-11-01', '2026-11-30', async () => {
      throw new TypeError('Failed to fetch')
    })
    assert.deepEqual(errRed, { estado: 'error', error: TEXTO_ERROR_REPORTE_ASISTENCIA })
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-43 PASARON EXITOSAMENTE (11/11) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-43:', err)
  process.exit(1)
})