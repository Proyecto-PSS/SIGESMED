// Suite exhaustiva de pruebas unitarias para US-42:
// Reporte de pagos realizados, sumatoria exacta en centavos, filtros UTC-3,
// consistencia detalle vs agregado, orquestación RBAC del endpoint y cliente HTTP.
import assert from 'node:assert/strict'
import {
  ENDPOINT_REPORTE_PAGOS_REALIZADOS,
  ESTADO_PAGO_EXITOSO,
  TEXTO_ERROR_REPORTE_PAGOS,
  TEXTO_FECHAS_PAGOS_OBLIGATORIAS,
  TEXTO_FORMATO_FECHA_PAGOS_INVALIDO,
  TEXTO_RANGO_FECHAS_PAGOS_INVALIDO,
  TEXTO_SIN_PAGOS_PERIODO,
  ReportePagosRealizadosError,
  centavosAMonto,
  construirFiltroPagosRealizados,
  construirReportePagosRealizados,
  ejecutarReportePagosRealizados,
  formatearMontoARS,
  montoACentavos,
  normalizarMonto,
  solicitarReportePagosRealizados,
  sumarMontos,
  validarRangoFechasPagos,
  type RegistroPagoRealizado,
} from '../lib/utils/reportes-pagos-utils.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

function crearRegistroPago(
  overrides: Partial<RegistroPagoRealizado> = {}
): RegistroPagoRealizado {
  return {
    idPago: 'pago_01',
    monto: '15000.00',
    moneda: 'ARS',
    proveedor: 'SIMULADA',
    aprobadoAt: new Date('2026-11-15T14:30:00.000Z'),
    paciente: { nombre: 'Diego', apellido: 'Galan' },
    turno: {
      fecha: new Date('2026-11-20T00:00:00.000Z'),
      hora: '10:00',
      medico: {
        nombre: 'Martín',
        apellido: 'Gómez',
        especialidad: 'CLINICA_MEDICA',
      },
    },
    comprobante: { numeroComprobante: 'CMP-20261115-0001' },
    ...overrides,
  }
}

async function runAllTests() {
  console.log('\n=== US-42: PRUEBAS DE REPORTE DE PAGOS REALIZADOS ===\n')

  // --------------------------------------------------------------------------
  // 1. Validación estricta de rangos de fechas
  // --------------------------------------------------------------------------
  await test('Esc.1: validarRangoFechasPagos acepta rangos válidos, mismo día, años bisiestos y hace trim', () => {
    assert.deepEqual(validarRangoFechasPagos(' 2026-11-01 ', ' 2026-11-30 '), {
      ok: true,
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
    })
    assert.deepEqual(validarRangoFechasPagos('2026-11-22', '2026-11-22'), {
      ok: true,
      fechaDesde: '2026-11-22',
      fechaHasta: '2026-11-22',
    })
    assert.deepEqual(validarRangoFechasPagos('2024-02-29', '2024-03-01'), {
      ok: true,
      fechaDesde: '2024-02-29',
      fechaHasta: '2024-03-01',
    })
  })

  await test('Esc.2: validarRangoFechasPagos rechaza fechas faltantes, inexistentes, mal formateadas o invertidas', () => {
    // Faltantes o no string
    for (const [d, h] of [
      ['', '2026-11-10'],
      ['2026-11-01', '   '],
      [null, '2026-11-10'],
      [undefined, undefined],
      [20261101, '2026-11-10'],
    ]) {
      const res = validarRangoFechasPagos(d, h)
      assert.equal(res.ok, false)
      if (!res.ok) {
        assert.equal(res.code, 'FECHAS_REQUERIDAS')
        assert.equal(res.error, TEXTO_FECHAS_PAGOS_OBLIGATORIAS)
      }
    }

    // Formato inválido o fechas imposibles en calendario (2026 no es bisiesto)
    for (const [d, h] of [
      ['01-11-2026', '2026-11-10'],
      ['2026/11/01', '2026-11-10'],
      ['2026-02-29', '2026-03-01'],
      ['2026-02-31', '2026-03-01'],
      ['2026-11-01', '2026-04-31'],
    ]) {
      const res = validarRangoFechasPagos(d, h)
      assert.equal(res.ok, false)
      if (!res.ok) {
        assert.equal(res.code, 'FORMATO_FECHA_INVALIDO')
        assert.equal(res.error, TEXTO_FORMATO_FECHA_PAGOS_INVALIDO)
      }
    }

    // Rango invertido (fechaDesde > fechaHasta)
    const invertido = validarRangoFechasPagos('2026-11-25', '2026-11-10')
    assert.equal(invertido.ok, false)
    if (!invertido.ok) {
      assert.equal(invertido.code, 'RANGO_FECHAS_INVALIDO')
      assert.equal(invertido.error, TEXTO_RANGO_FECHAS_PAGOS_INVALIDO)
    }
  })

  // --------------------------------------------------------------------------
  // 2. Filtro de inclusión por estado APROBADO y límites exactos en hora Argentina (UTC-3)
  // --------------------------------------------------------------------------
  await test('Esc.3: construirFiltroPagosRealizados incluye solo APROBADO y cubre días completos en UTC-3 [inicio, fin)', () => {
    const where = construirFiltroPagosRealizados('2026-11-22', '2026-11-22')

    assert.equal(where.estado, ESTADO_PAGO_EXITOSO)
    assert.equal(where.estado, 'APROBADO')
    // 00:00:00 ART del 22/11 = 03:00:00 UTC del 22/11
    assert.equal(where.aprobadoAt.gte.toISOString(), '2026-11-22T03:00:00.000Z')
    // 00:00:00 ART del 23/11 = 03:00:00 UTC del 23/11 (exclusivo)
    assert.equal(where.aprobadoAt.lt.toISOString(), '2026-11-23T03:00:00.000Z')

    // Simulación de bordes horarios reales contra transacciones ficticias
    const enRango = (fecha: Date) => fecha >= where.aprobadoAt.gte && fecha < where.aprobadoAt.lt
    assert.equal(enRango(new Date('2026-11-22T02:59:59.999Z')), false, '23:59:59.999 ART del día anterior queda fuera')
    assert.equal(enRango(new Date('2026-11-22T03:00:00.000Z')), true, '00:00:00.000 ART del día inicio entra')
    assert.equal(enRango(new Date('2026-11-23T02:59:59.999Z')), true, '23:59:59.999 ART del día fin entra')
    assert.equal(enRango(new Date('2026-11-23T03:00:00.000Z')), false, '00:00:00.000 ART del día siguiente queda fuera')
  })

  // --------------------------------------------------------------------------
  // 3. Aritmética monetaria exacta en centavos (sin errores de punto flotante)
  // --------------------------------------------------------------------------
  await test('Esc.4: Aritmética monetaria en BigInt evita errores de punto flotante y maneja montos grandes', () => {
    // Clásico bug de IEEE-754: 0.1 + 0.2 !== 0.3
    assert.equal(sumarMontos(['0.10', '0.20']), '0.30')
    assert.equal(sumarMontos(['15000.00', '18000.50', '20000.25', '1234.99']), '54235.74')
    assert.equal(sumarMontos([]), '0.00')

    // Precisión más allá de Number.MAX_SAFE_INTEGER en centavos
    assert.equal(sumarMontos(['90071992547409.91', '0.09']), '90071992547410.00')

    assert.equal(montoACentavos('15000.5'), BigInt(1500050))
    assert.equal(centavosAMonto(BigInt(1500050)), '15000.50')
    assert.equal(normalizarMonto('15000'), '15000.00')
    assert.equal(normalizarMonto('-0.00'), '0.00')

    assert.equal(formatearMontoARS('0'), '$ 0,00')
    assert.equal(formatearMontoARS('15000.00'), '$ 15.000,00')
    assert.equal(formatearMontoARS('125450.5'), '$ 125.450,50')
    assert.equal(formatearMontoARS('1234567.89'), '$ 1.234.567,89')
    assert.equal(formatearMontoARS('-500.25'), '-$ 500,25')
  })

  await test('Esc.5: Rechaza importes malformados o con más de 2 decimales con MONTO_INVALIDO', () => {
    for (const montoInvalido of ['', 'abc', '10.123', '15000,50', '$15000', 'NaN', '1e5']) {
      assert.throws(
        () => montoACentavos(montoInvalido),
        (err: unknown) =>
          err instanceof ReportePagosRealizadosError &&
          err.statusCode === 500 &&
          err.code === 'MONTO_INVALIDO'
      )
    }
  })

  // --------------------------------------------------------------------------
  // 4. Transacciones ficticias: sumatoria exacta, mapeo DTO y privacidad
  // --------------------------------------------------------------------------
  await test('Esc.6: Transacciones ficticias devuelven sumatoria exacta, etiquetas correctas y sin datos sensibles', () => {
    const registros: RegistroPagoRealizado[] = [
      crearRegistroPago({
        idPago: 'p_1',
        monto: '15000.00',
        proveedor: 'SIMULADA',
        turno: {
          fecha: new Date('2026-11-10T00:00:00.000Z'),
          hora: '09:00',
          medico: { nombre: 'Ana', apellido: 'López', especialidad: 'CLINICA_MEDICA' },
        },
      }),
      crearRegistroPago({
        idPago: 'p_2',
        monto: '18000.5',
        proveedor: 'MERCADOPAGO',
        comprobante: null,
        turno: {
          fecha: new Date('2026-11-12T00:00:00.000Z'),
          hora: '11:30',
          medico: { nombre: 'Luis', apellido: 'Pérez', especialidad: 'PEDIATRIA' },
        },
      }),
      crearRegistroPago({
        idPago: 'p_3',
        monto: '20000.25',
        proveedor: 'OTRO_PROVEEDOR',
        turno: {
          fecha: new Date('2026-11-14T00:00:00.000Z'),
          hora: '16:00',
          medico: { nombre: 'Sofía', apellido: 'Ruiz', especialidad: 'TRAUMATOLOGIA_ORTOPEDIA' },
        },
      }),
      crearRegistroPago({
        idPago: 'p_4',
        monto: '15000.15',
        turno: {
          fecha: new Date('2026-11-15T00:00:00.000Z'),
          hora: '18:00',
          medico: { nombre: 'Carlos', apellido: 'Díaz', especialidad: 'CARDIOLOGIA' },
        },
      }),
    ]

    const reporte = construirReportePagosRealizados({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      registros,
      totalAgregado: '68000.90',
      cantidadAgregada: 4,
    })

    assert.equal(reporte.cantidadPagos, 4)
    assert.equal(reporte.totalIngresos, '68000.90')
    assert.equal(reporte.moneda, 'ARS')
    assert.equal(reporte.sinResultados, false)
    assert.equal(reporte.mensaje, null)

    // Mapeo de etiquetas y fallbacks
    assert.equal(reporte.pagos[0].profesional, 'López, Ana')
    assert.equal(reporte.pagos[0].especialidad, 'Clínica Médica')
    assert.equal(reporte.pagos[0].medioPago, 'Pasarela simulada')
    assert.equal(reporte.pagos[1].monto, '18000.50')
    assert.equal(reporte.pagos[1].medioPago, 'Mercado Pago')
    assert.equal(reporte.pagos[1].numeroComprobante, null)
    assert.equal(reporte.pagos[2].medioPago, 'OTRO_PROVEEDOR')
    assert.equal(reporte.pagos[3].especialidad, 'CARDIOLOGIA')

    // Privacidad: el DTO no debe exponer campos sensibles
    const clavesFila = Object.keys(reporte.pagos[0])
    for (const sensible of ['transaccionExternaId', 'idempotencyKey', 'dni', 'email', 'tarjeta']) {
      assert.equal(clavesFila.includes(sensible), false, `No debe exponer el campo ${sensible}`)
    }
  })

  await test('Esc.7: Período sin transacciones devuelve total 0.00, sinResultados = true y mensaje descriptivo', () => {
    const reporte = construirReportePagosRealizados({
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      registros: [],
      totalAgregado: null,
      cantidadAgregada: 0,
    })

    assert.equal(reporte.cantidadPagos, 0)
    assert.equal(reporte.totalIngresos, '0.00')
    assert.equal(reporte.moneda, 'ARS')
    assert.equal(reporte.sinResultados, true)
    assert.equal(reporte.mensaje, TEXTO_SIN_PAGOS_PERIODO)
    assert.deepEqual(reporte.pagos, [])
  })

  await test('Esc.8: Detecta inconsistencias entre el detalle de pagos y el total/cantidad agregada de la BD', () => {
    const registros = [
      crearRegistroPago({ idPago: 'p_1', monto: '15000.00' }),
      crearRegistroPago({ idPago: 'p_2', monto: '20000.00' }),
    ]

    // Total agregado no coincide (ej. diferencia de 1 centavo)
    assert.throws(
      () =>
        construirReportePagosRealizados({
          fechaDesde: '2026-11-01',
          fechaHasta: '2026-11-30',
          registros,
          totalAgregado: '35000.01',
          cantidadAgregada: 2,
        }),
      (err: unknown) =>
        err instanceof ReportePagosRealizadosError &&
        err.statusCode === 500 &&
        err.code === 'TOTAL_INCONSISTENTE'
    )

    // Cantidad agregada no coincide con registros.length
    assert.throws(
      () =>
        construirReportePagosRealizados({
          fechaDesde: '2026-11-01',
          fechaHasta: '2026-11-30',
          registros,
          totalAgregado: '35000.00',
          cantidadAgregada: 3,
        }),
      (err: unknown) =>
        err instanceof ReportePagosRealizadosError &&
        err.statusCode === 500 &&
        err.code === 'TOTAL_INCONSISTENTE'
    )
  })

  // --------------------------------------------------------------------------
  // 5. Orquestación del endpoint: control de acceso de roles y orden de validación
  // --------------------------------------------------------------------------
  await test('Esc.9: Control de acceso en endpoint bloquea sin sesión (401) y roles no-admin (403) antes de tocar BD', async () => {
    let consultoBD = false
    const obtenerReporteEspia = async () => {
      consultoBD = true
      throw new Error('No debería ejecutarse')
    }

    // 1. Sin sesión -> 401 (incluso si las fechas son inválidas, primero autoriza)
    const res401 = await ejecutarReportePagosRealizados({
      autorizar: async () => {
        throw Object.assign(new Error('No autorizado'), { statusCode: 401 })
      },
      obtenerReporte: obtenerReporteEspia,
      fechaDesde: 'invalida',
      fechaHasta: '',
    })
    assert.equal(res401.status, 401)
    assert.equal(res401.body.ok, false)
    assert.equal('pagos' in res401.body, false)
    assert.equal('totalIngresos' in res401.body, false)
    assert.equal(consultoBD, false)

    // 2. Roles PACIENTE, MEDICO, ENFERMERA -> 403 sin filtrar datos financieros
    const res403 = await ejecutarReportePagosRealizados({
      autorizar: async () => {
        throw Object.assign(new Error('Acceso denegado'), { statusCode: 403 })
      },
      obtenerReporte: obtenerReporteEspia,
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
    })
    assert.equal(res403.status, 403)
    assert.equal(res403.body.ok, false)
    assert.match(String(res403.body.error), /administrador/i)
    assert.equal('pagos' in res403.body, false)
    assert.equal(consultoBD, false)
  })

  await test('Esc.10: Endpoint devuelve 400 ante rango inválido, 200 ante éxito y 500 seguro sin filtrar stack interno', async () => {
    let consultoBD = false
    let errorRegistrado: unknown = null

    // 1. ADMIN con rango invertido -> 400 sin consultar BD
    const res400 = await ejecutarReportePagosRealizados({
      autorizar: async () => ({ id: 'admin_1', rol: 'ADMIN' }),
      obtenerReporte: async () => {
        consultoBD = true
        throw new Error('No debe llamarse')
      },
      fechaDesde: '2026-11-20',
      fechaHasta: '2026-11-10',
    })
    assert.equal(res400.status, 400)
    assert.equal(res400.body.code, 'RANGO_FECHAS_INVALIDO')
    assert.equal(consultoBD, false)

    // 2. ADMIN con rango válido -> 200 con reporte completo
    const reporteEsperado = construirReportePagosRealizados({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      registros: [crearRegistroPago({ monto: '15000.00' })],
      totalAgregado: '15000.00',
      cantidadAgregada: 1,
    })

    const res200 = await ejecutarReportePagosRealizados({
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
    assert.equal(res200.body.totalIngresos, '15000.00')
    assert.equal(res200.body.cantidadPagos, 1)

    // 3. Fallo de BD o inconsistencia -> 500 con mensaje genérico (no expone detalles de Prisma)
    const res500 = await ejecutarReportePagosRealizados({
      autorizar: async () => ({ id: 'admin_1', rol: 'ADMIN' }),
      obtenerReporte: async () => {
        throw new Error('Connection terminated unexpectedly on PostgreSQL 16')
      },
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-30',
      registrarError: (err) => {
        errorRegistrado = err
      },
    })
    assert.equal(res500.status, 500)
    assert.equal(res500.body.error, TEXTO_ERROR_REPORTE_PAGOS)
    assert.equal(String(res500.body.error).includes('PostgreSQL'), false)
    assert.ok(errorRegistrado instanceof Error)
  })

  // --------------------------------------------------------------------------
  // 6. Cliente HTTP del frontend (solicitarReportePagosRealizados)
  // --------------------------------------------------------------------------
  await test('Esc.11: Cliente valida rango antes de hacer fetch (RF-42.5) y arma correctamente la query string', async () => {
    let llamadas = 0
    const rangoInvalido = await solicitarReportePagosRealizados(
      '2026-11-30',
      '2026-11-01',
      async () => {
        llamadas++
        throw new Error('No debe llamar a fetch')
      }
    )
    assert.equal(rangoInvalido.estado, 'rango_invalido')
    assert.equal(llamadas, 0)

    let urlInvocada = ''
    const exito = await solicitarReportePagosRealizados(
      '2026-11-01',
      '2026-11-30',
      async (url) => {
        urlInvocada = url
        return {
          ok: true,
          json: async () => ({
            fechaDesde: '2026-11-01',
            fechaHasta: '2026-11-30',
            pagos: [],
            cantidadPagos: 0,
            totalIngresos: '0.00',
            moneda: 'ARS',
            sinResultados: true,
            mensaje: TEXTO_SIN_PAGOS_PERIODO,
          }),
        }
      }
    )
    assert.equal(
      urlInvocada,
      `${ENDPOINT_REPORTE_PAGOS_REALIZADOS}?fechaDesde=2026-11-01&fechaHasta=2026-11-30`
    )
    assert.equal(exito.estado, 'exito')
    if (exito.estado === 'exito') {
      assert.equal(exito.reporte.totalIngresos, '0.00')
    }
  })

  await test('Esc.12: Cliente maneja respuestas HTTP con error, JSON malformado, payload incompleto y caída de red', async () => {
    // Error HTTP con mensaje del backend
    const errBackend = await solicitarReportePagosRealizados('2026-11-01', '2026-11-30', async () => ({
      ok: false,
      json: async () => ({ error: 'Acceso denegado: se requieren permisos de administrador.' }),
    }))
    assert.deepEqual(errBackend, {
      estado: 'error',
      error: 'Acceso denegado: se requieren permisos de administrador.',
    })

    // Respuesta 200 con payload corrupto (sin totalIngresos válido)
    const errCorrupto = await solicitarReportePagosRealizados('2026-11-01', '2026-11-30', async () => ({
      ok: true,
      json: async () => ({ pagos: [], totalIngresos: 'INVALIDO', cantidadPagos: 0 }),
    }))
    assert.deepEqual(errCorrupto, { estado: 'error', error: TEXTO_ERROR_REPORTE_PAGOS })

    // Fallo de red (fetch rechaza la promesa)
    const errRed = await solicitarReportePagosRealizados('2026-11-01', '2026-11-30', async () => {
      throw new TypeError('Failed to fetch')
    })
    assert.deepEqual(errRed, { estado: 'error', error: TEXTO_ERROR_REPORTE_PAGOS })
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-42 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-42:', err)
  process.exit(1)
})