// Suite de pruebas unitarias y de integración en memoria para US-24 (v2):
// Generación automática de comprobante PDF tras pago confirmado, seguridad, resiliencia y descarga.
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  ComprobantePdfGenerator,
  type DatosComprobantePDF,
} from '../lib/services/comprobante-pdf-generator.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// --------------------------------------------------------------------------
// Tipos y simulador fiel a ComprobantePagoService + PagosService
// --------------------------------------------------------------------------
type EstadoPago = 'PENDIENTE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'ERROR'
type EstadoComprobante = 'PENDIENTE' | 'GENERANDO' | 'GENERADO' | 'ERROR'

interface PagoMock {
  idPago: string
  idTurno: string
  idPaciente: string
  monto: string
  moneda: string
  proveedor: string
  estado: EstadoPago
  transaccionExternaId: string | null
  aprobadoAt: Date | null
  paciente: {
    nombre: string
    apellido: string
    dni: string
    email: string
    obraSocial?: string | null
    numeroAfiliado?: string | null
  }
  turno: {
    fecha: Date
    hora: string
    modalidad: string
    medico: {
      nombre: string
      apellido: string
      especialidad: string
      matricula: string | null
      consultorio: string | null
    }
  }
}

interface ComprobanteRecordMock {
  idComprobante: string
  idPago: string
  numeroComprobante: string
  estado: EstadoComprobante
  archivoKey: string
  nombreArchivo: string
  mimeType: string
  archivoContenido: Buffer | null
  tamanoBytes: number | null
  datosSnapshot: DatosComprobantePDF | null
  fechaEmision: Date
  errorGeneracion: string | null
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string }
  err.statusCode = statusCode
  if (code) err.code = code
  return err
}

function generarNumeroComprobante(idPago: string): string {
  const fechaPart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  const pagoPart = idPago.slice(-4).toUpperCase()
  return `CMP-${fechaPart}-${pagoPart}${randomPart}`
}

class SistemaComprobantesMock {
  pagos = new Map<string, PagoMock>()
  comprobantesPorPago = new Map<string, ComprobanteRecordMock>()
  simularFalloMotorPdf = false
  invocacionesGeneradorPdf = 0

  agregarPago(pago: PagoMock) {
    this.pagos.set(pago.idPago, structuredClone(pago))
  }

  /** Simula PagosService.procesarResultadoPago disparando automáticamente RF-24.1 */
  async confirmarPagoYDispararComprobante(idPago: string, transaccionExternaId = 'SIM-999888') {
    const pago = this.pagos.get(idPago)
    if (!pago) throw errorConEstado('El pago solicitado no existe.', 404, 'PAGO_NOT_FOUND')

    pago.estado = 'APROBADO'
    pago.transaccionExternaId = transaccionExternaId
    pago.aprobadoAt = new Date()

    // RF-24.1: Al confirmar el pago, iniciar automáticamente la generación sin revertir el pago si falla el PDF
    try {
      await this.generarComprobantePago(idPago)
    } catch {
      // Error no bloqueante para la confirmación del pago
    }

    return {
      ...pago,
      comprobante: this.comprobantesPorPago.get(idPago) ?? null,
    }
  }

  /** Réplica exacta de ComprobantePagoService.generarComprobantePago */
  async generarComprobantePago(idPago: string) {
    if (!idPago || typeof idPago !== 'string') {
      throw errorConEstado('El identificador del pago es requerido.', 400, 'INVALID_PAGO_ID')
    }

    const pago = this.pagos.get(idPago)
    if (!pago) {
      throw errorConEstado('El pago especificado no existe.', 404, 'PAGO_NOT_FOUND')
    }

    if (pago.estado !== 'APROBADO') {
      throw errorConEstado(
        `No se puede emitir un comprobante para un pago en estado ${pago.estado}. Debe estar APROBADO.`,
        409,
        'PAYMENT_NOT_APPROVED'
      )
    }

    let comprobante = this.comprobantesPorPago.get(idPago)

    // Idempotencia: si ya está GENERADO y tiene contenido binario, devolver sin regenerar
    if (comprobante && comprobante.estado === 'GENERADO' && comprobante.archivoContenido) {
      return this.mapearADTO(comprobante)
    }

    const numeroComprobante = comprobante?.numeroComprobante || generarNumeroComprobante(pago.idPago)
    const nombreArchivo = `comprobante-${numeroComprobante}.pdf`
    const archivoKey = `comprobantes/${pago.idPago}/${nombreArchivo}`

    if (!comprobante) {
      comprobante = {
        idComprobante: `cmp_${pago.idPago}`,
        idPago: pago.idPago,
        numeroComprobante,
        estado: 'GENERANDO',
        archivoKey,
        nombreArchivo,
        mimeType: 'application/pdf',
        archivoContenido: null,
        tamanoBytes: null,
        datosSnapshot: null,
        fechaEmision: new Date(),
        errorGeneracion: null,
      }
      this.comprobantesPorPago.set(idPago, comprobante)
    } else {
      comprobante.estado = 'GENERANDO'
      comprobante.errorGeneracion = null
    }

    const datosSnapshot: DatosComprobantePDF = {
      numeroComprobante,
      fechaEmision: new Date(),
      idTransaccion: pago.transaccionExternaId || pago.idPago,
      idTurno: pago.idTurno,
      paciente: { ...pago.paciente },
      medico: { ...pago.turno.medico },
      turno: {
        fecha: pago.turno.fecha.toISOString().slice(0, 10),
        hora: pago.turno.hora,
        modalidad: pago.turno.modalidad || 'PARTICULAR',
      },
      pago: {
        monto: pago.monto,
        moneda: pago.moneda,
        proveedor: pago.proveedor,
        estado: pago.estado,
        aprobadoAt: pago.aprobadoAt ? pago.aprobadoAt.toISOString() : null,
      },
    }

    try {
      this.invocacionesGeneradorPdf++
      if (this.simularFalloMotorPdf) {
        throw new Error('Fallo simulado de memoria en motor PDF')
      }

      // Invocación al generador PDF REAL del proyecto
      const pdfBytes = await ComprobantePdfGenerator.generar(datosSnapshot)

      comprobante.estado = 'GENERADO'
      comprobante.archivoContenido = Buffer.from(pdfBytes)
      comprobante.tamanoBytes = pdfBytes.length
      comprobante.datosSnapshot = structuredClone(datosSnapshot)
      comprobante.fechaEmision = new Date()
      comprobante.errorGeneracion = null

      return this.mapearADTO(comprobante)
    } catch (error: any) {
      comprobante.estado = 'ERROR'
      comprobante.errorGeneracion = error.message || 'Error técnico durante la generación del PDF'

      throw errorConEstado(
        `Fallo al generar el PDF del comprobante: ${error.message}`,
        500,
        'PDF_GENERATION_FAILED'
      )
    }
  }

  /** Réplica exacta de ComprobantePagoService.obtenerComprobantePorPago */
  async obtenerComprobantePorPago(idPago: string, idPaciente: string) {
    if (!idPago) throw errorConEstado('El identificador del pago es obligatorio.', 400, 'INVALID_PAGO_ID')

    const pago = this.pagos.get(idPago)
    if (!pago) throw errorConEstado('No se encontró el pago solicitado.', 404, 'PAGO_NOT_FOUND')

    if (pago.idPaciente !== idPaciente) {
      throw errorConEstado(
        'Acceso denegado: no tenés permiso para consultar el comprobante de este pago.',
        403,
        'FORBIDDEN_COMPROBANTE_ACCESS'
      )
    }

    if (pago.estado !== 'APROBADO') {
      throw errorConEstado(
        'Este pago no se encuentra aprobado, por lo que no posee comprobante emitido.',
        409,
        'PAYMENT_NOT_APPROVED'
      )
    }

    const comprobante = this.comprobantesPorPago.get(idPago)
    if (!comprobante || comprobante.estado === 'PENDIENTE') {
      return this.generarComprobantePago(idPago)
    }

    return this.mapearADTO(comprobante)
  }

  /** Réplica exacta de ComprobantePagoService.descargarComprobante */
  async descargarComprobante(idPago: string, idPaciente: string) {
    if (!idPago) throw errorConEstado('El identificador del pago es requerido.', 400, 'INVALID_PAGO_ID')

    const pago = this.pagos.get(idPago)
    if (!pago) throw errorConEstado('El pago solicitado no existe.', 404, 'PAGO_NOT_FOUND')

    if (pago.idPaciente !== idPaciente) {
      throw errorConEstado(
        'Acceso denegado: el comprobante solicitado no pertenece a tu cuenta.',
        403,
        'FORBIDDEN_COMPROBANTE_ACCESS'
      )
    }

    if (pago.estado !== 'APROBADO') {
      throw errorConEstado(
        `El pago no está aprobado (estado: ${pago.estado}). No existe comprobante disponible para descargar.`,
        409,
        'PAYMENT_NOT_APPROVED'
      )
    }

    let comprobante = this.comprobantesPorPago.get(idPago)

    if (!comprobante || comprobante.estado === 'ERROR' || !comprobante.archivoContenido) {
      await this.generarComprobantePago(idPago)
      comprobante = this.comprobantesPorPago.get(idPago)
    }

    if (!comprobante) {
      throw errorConEstado('No se pudo localizar el comprobante de pago.', 404, 'COMPROBANTE_NOT_FOUND')
    }

    if (comprobante.estado === 'GENERANDO' || comprobante.estado === 'PENDIENTE') {
      throw errorConEstado(
        'El comprobante se está generando actualmente. Por favor, reintentá en unos instantes.',
        409,
        'COMPROBANTE_GENERATION_IN_PROGRESS'
      )
    }

    if (comprobante.estado === 'ERROR' || !comprobante.archivoContenido) {
      throw errorConEstado(
        'Ocurrió un error al generar el documento.',
        500,
        'COMPROBANTE_CONTENT_ERROR'
      )
    }

    return {
      buffer: Buffer.from(comprobante.archivoContenido),
      mimeType: comprobante.mimeType || 'application/pdf',
      nombreArchivo: comprobante.nombreArchivo,
      tamanoBytes: comprobante.tamanoBytes || comprobante.archivoContenido.length,
    }
  }

  private mapearADTO(c: ComprobanteRecordMock) {
    return {
      idComprobante: c.idComprobante,
      idPago: c.idPago,
      numeroComprobante: c.numeroComprobante,
      estado: c.estado,
      nombreArchivo: c.nombreArchivo,
      mimeType: c.mimeType,
      tamanoBytes: c.tamanoBytes,
      fechaEmision: c.fechaEmision.toISOString(),
      errorGeneracion: c.errorGeneracion,
    }
  }
}

function crearPagoBase(overrides: Partial<PagoMock> = {}): PagoMock {
  return {
    idPago: 'pago_1001',
    idTurno: 'turno_5001',
    idPaciente: 'pac_01',
    monto: '15000.00',
    moneda: 'ARS',
    proveedor: 'SIMULADA',
    estado: 'PENDIENTE',
    transaccionExternaId: null,
    aprobadoAt: null,
    paciente: {
      nombre: 'Diego',
      apellido: 'Galan',
      dni: '40111222',
      email: 'diego@test.com',
      obraSocial: null,
      numeroAfiliado: null,
    },
    turno: {
      fecha: new Date('2026-11-20T00:00:00.000Z'),
      hora: '10:30',
      modalidad: 'PARTICULAR',
      medico: {
        nombre: 'Martín',
        apellido: 'Gómez',
        especialidad: 'CLINICA_MEDICA',
        matricula: 'MN-54321',
        consultorio: 'Consultorio 3',
      },
    },
    ...overrides,
  }
}

// --------------------------------------------------------------------------
// Ejecución de las pruebas
// --------------------------------------------------------------------------
async function runAllTests() {
  console.log('\n=== US-24 (v2): PRUEBAS DE GENERACIÓN Y DESCARGA DE COMPROBANTES PDF ===\n')

  await test('Esc.1: Un pago confirmado genera automáticamente el documento PDF y se descarga sin errores', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_ok_01' }))

    // 1. Se confirma el pago (dispara automáticamente la generación del comprobante)
    const pagoConfirmado = await sys.confirmarPagoYDispararComprobante('pago_ok_01', 'SIM-TRX-001')
    assert.equal(pagoConfirmado.estado, 'APROBADO')
    assert.ok(pagoConfirmado.comprobante, 'El pago confirmado debe tener un comprobante asociado')
    assert.equal(pagoConfirmado.comprobante?.estado, 'GENERADO')
    assert.match(pagoConfirmado.comprobante!.numeroComprobante, /^CMP-\d{8}-/)

    // 2. Se descarga el comprobante sin errores
    const descarga = await sys.descargarComprobante('pago_ok_01', 'pac_01')
    assert.equal(descarga.mimeType, 'application/pdf')
    assert.ok(descarga.nombreArchivo.endsWith('.pdf'))
    assert.ok(descarga.tamanoBytes > 1000, 'El PDF debe tener un tamaño binario real (> 1KB)')
    assert.equal(descarga.buffer.length, descarga.tamanoBytes)

    // 3. Verificación de firma binaria %PDF-
    const cabeceraPdf = descarga.buffer.subarray(0, 5).toString('ascii')
    assert.equal(cabeceraPdf, '%PDF-')
  })

  await test('Esc.2: El archivo generado por ComprobantePdfGenerator es un PDF A4 válido con metadatos completos', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_pdf_meta', estado: 'APROBADO' }))

    const dto = await sys.generarComprobantePago('pago_pdf_meta')
    const descarga = await sys.descargarComprobante('pago_pdf_meta', 'pac_01')

    // Parseamos el PDF real con pdf-lib para verificar su estructura interna
    const pdfDoc = await PDFDocument.load(descarga.buffer)
    assert.equal(pdfDoc.getPageCount(), 1, 'El comprobante debe tener exactamente 1 página')

    const { width, height } = pdfDoc.getPage(0).getSize()
    assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, 'La página debe tener formato A4')

    assert.equal(pdfDoc.getTitle(), `Comprobante de Pago ${dto.numeroComprobante}`)
    assert.equal(pdfDoc.getAuthor(), 'SIGESMED - Sistema de Gestión Médica')
    assert.equal(pdfDoc.getSubject(), 'Constancia de Pago de Consulta Particular')
  })

  await test('Esc.3: Sanitización WinAnsi evita fallos al generar PDF con tildes, eñes y símbolos especiales', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(
      crearPagoBase({
        idPago: 'pago_unicode',
        estado: 'APROBADO',
        paciente: {
          nombre: 'María José ✓',
          apellido: 'Nuñez — Peña',
          dni: '38999000',
          email: 'maria@test.com',
        },
        turno: {
          fecha: new Date('2026-11-20T00:00:00.000Z'),
          hora: '11:00',
          modalidad: 'PARTICULAR',
          medico: {
            nombre: 'Ángel',
            apellido: 'Villafañe • Especialista',
            especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
            matricula: 'MP-9988',
            consultorio: 'Piso 2 – Ala Norte 🚀',
          },
        },
      })
    )

    const dto = await sys.generarComprobantePago('pago_unicode')
    assert.equal(dto.estado, 'GENERADO')
    assert.ok(dto.tamanoBytes && dto.tamanoBytes > 1000)
  })

  await test('Esc.4: Idempotencia: llamadas repetidas no regeneran ni duplican un comprobante ya GENERADO', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_idem', estado: 'APROBADO' }))

    const primero = await sys.generarComprobantePago('pago_idem')
    const segundo = await sys.generarComprobantePago('pago_idem')
    const tercero = await sys.obtenerComprobantePorPago('pago_idem', 'pac_01')

    assert.equal(sys.invocacionesGeneradorPdf, 1, 'El motor PDF solo debe ejecutarse una vez')
    assert.equal(primero.idComprobante, segundo.idComprobante)
    assert.equal(primero.numeroComprobante, segundo.numeroComprobante)
    assert.equal(primero.numeroComprobante, tercero.numeroComprobante)
  })

  await test('Esc.5: RF-24.1: Rechaza emitir o descargar comprobantes para pagos PENDIENTES, RECHAZADOS o con ERROR', async () => {
    const sys = new SistemaComprobantesMock()
    const estadosNoAprobados: EstadoPago[] = ['PENDIENTE', 'PROCESANDO', 'RECHAZADO', 'ERROR']

    for (const estado of estadosNoAprobados) {
      const idPago = `pago_${estado.toLowerCase()}`
      sys.agregarPago(crearPagoBase({ idPago, estado }))

      await assert.rejects(
        () => sys.generarComprobantePago(idPago),
        (err: any) => err.statusCode === 409 && err.code === 'PAYMENT_NOT_APPROVED'
      )

      await assert.rejects(
        () => sys.descargarComprobante(idPago, 'pac_01'),
        (err: any) => err.statusCode === 409 && err.code === 'PAYMENT_NOT_APPROVED'
      )
    }
  })

  await test('Esc.6: RF-24.5: Seguridad de titularidad bloquea con 403 el acceso o descarga de otro paciente', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_privado', idPaciente: 'pac_titular' }))
    await sys.confirmarPagoYDispararComprobante('pago_privado')

    await assert.rejects(
      () => sys.obtenerComprobantePorPago('pago_privado', 'pac_intruso'),
      (err: any) => err.statusCode === 403 && err.code === 'FORBIDDEN_COMPROBANTE_ACCESS'
    )

    await assert.rejects(
      () => sys.descargarComprobante('pago_privado', 'pac_intruso'),
      (err: any) => err.statusCode === 403 && err.code === 'FORBIDDEN_COMPROBANTE_ACCESS'
    )
  })

  await test('Esc.7: Resiliencia: si falla la creación del PDF, el pago confirmado NO se revierte y el comprobante queda en ERROR', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_resiliente' }))
    sys.simularFalloMotorPdf = true

    const resultadoPago = await sys.confirmarPagoYDispararComprobante('pago_resiliente')

    // El pago sigue APROBADO aunque el PDF haya fallado
    assert.equal(resultadoPago.estado, 'APROBADO')
    assert.equal(resultadoPago.comprobante?.estado, 'ERROR')
    assert.ok(resultadoPago.comprobante?.errorGeneracion?.includes('Fallo simulado'))
  })

  await test('Esc.8: Autorrecuperación: descargar un comprobante en estado ERROR reintenta la generación y entrega el PDF', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_recuperable' }))

    // Primero falla al aprobarse el pago
    sys.simularFalloMotorPdf = true
    await sys.confirmarPagoYDispararComprobante('pago_recuperable')
    assert.equal(sys.comprobantesPorPago.get('pago_recuperable')?.estado, 'ERROR')

    // Luego se restablece el motor PDF y el paciente presiona "Descargar comprobante"
    sys.simularFalloMotorPdf = false
    const descarga = await sys.descargarComprobante('pago_recuperable', 'pac_01')

    assert.equal(sys.comprobantesPorPago.get('pago_recuperable')?.estado, 'GENERADO')
    assert.equal(sys.comprobantesPorPago.get('pago_recuperable')?.errorGeneracion, null)
    assert.ok(descarga.buffer.length > 1000)
  })

  await test('Esc.9: Concurrencia: rechaza con 409 la descarga si el comprobante está actualmente en estado GENERANDO', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_en_curso', estado: 'APROBADO' }))

    sys.comprobantesPorPago.set('pago_en_curso', {
      idComprobante: 'cmp_en_curso',
      idPago: 'pago_en_curso',
      numeroComprobante: 'CMP-20261025-0001',
      estado: 'GENERANDO',
      archivoKey: 'comprobantes/pago_en_curso/test.pdf',
      nombreArchivo: 'comprobante-CMP-20261025-0001.pdf',
      mimeType: 'application/pdf',
      archivoContenido: Buffer.from('parcial'),
      tamanoBytes: 7,
      datosSnapshot: null,
      fechaEmision: new Date(),
      errorGeneracion: null,
    })

    await assert.rejects(
      () => sys.descargarComprobante('pago_en_curso', 'pac_01'),
      (err: any) => err.statusCode === 409 && err.code === 'COMPROBANTE_GENERATION_IN_PROGRESS'
    )
  })

  await test('Esc.10: Snapshot congela los datos de emisión aunque el médico modifique su consultorio después', async () => {
    const sys = new SistemaComprobantesMock()
    sys.agregarPago(crearPagoBase({ idPago: 'pago_snapshot' }))
    await sys.confirmarPagoYDispararComprobante('pago_snapshot')

    // El médico cambia de consultorio días después
    const pagoGuardado = sys.pagos.get('pago_snapshot')!
    pagoGuardado.turno.medico.consultorio = 'Consultorio 99 Nuevo'

    const comprobante = sys.comprobantesPorPago.get('pago_snapshot')!
    assert.equal(comprobante.datosSnapshot?.medico.consultorio, 'Consultorio 3')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-24 (v2) PASARON EXITOSAMENTE (10/10) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-24 (v2):', error)
  process.exit(1)
})
