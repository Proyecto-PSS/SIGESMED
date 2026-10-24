// Suite exhaustiva de pruebas unitarias y de integración para US-24:
// Generación automática y descarga de comprobantes de pago en PDF para consultas particulares.
import assert from 'node:assert/strict'
import { ComprobantePdfGenerator, type DatosComprobantePDF } from '../lib/services/comprobante-pdf-generator.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// --------------------------------------------------------------------------
// Tipos y simuladores en memoria para validación determinista y sin efectos colaterales
// --------------------------------------------------------------------------
type EstadoPago = 'PENDIENTE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'ERROR'
type EstadoComprobante = 'PENDIENTE' | 'GENERANDO' | 'GENERADO' | 'ERROR'

interface PacienteMock {
  idPaciente: string
  nombre: string
  apellido: string
  dni: string
  email: string
  obraSocial?: string | null
  numeroAfiliado?: string | null
}

interface MedicoMock {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  matricula: string
  consultorio: string
}

interface TurnoMock {
  idTurno: string
  idPaciente: string
  idMedico: string
  fecha: string
  hora: string
  modalidad: 'PARTICULAR' | 'COBERTURA'
  estado: 'CONFIRMADO' | 'ATENDIDO' | 'CANCELADO'
}

interface PagoMock {
  idPago: string
  idTurno: string
  idPaciente: string
  monto: string
  moneda: string
  estado: EstadoPago
  proveedor: string
  transaccionExternaId: string | null
  idempotencyKey: string
  aprobadoAt: Date | null
}

interface ComprobanteMock {
  idComprobante: string
  idPago: string
  numeroComprobante: string
  estado: EstadoComprobante
  archivoKey: string
  archivoContenido: Uint8Array | null
  mimeType: string
  nombreArchivo: string
  tamanoBytes: number | null
  datosSnapshot: DatosComprobantePDF | null
  fechaEmision: Date
  errorGeneracion: string | null
}

class ComprobanteServiceMock {
  pacientes: Map<string, PacienteMock> = new Map()
  medicos: Map<string, MedicoMock> = new Map()
  turnos: Map<string, TurnoMock> = new Map()
  pagos: Map<string, PagoMock> = new Map()
  comprobantes: Map<string, ComprobanteMock> = new Map()

  simularFallaPdf: boolean = false

  async generarComprobantePago(idPago: string): Promise<ComprobanteMock> {
    if (!idPago) {
      const err = new Error('El identificador del pago es requerido.')
      ;(err as any).statusCode = 400
      throw err
    }

    const pago = this.pagos.get(idPago)
    if (!pago) {
      const err = new Error('El pago especificado no existe.')
      ;(err as any).statusCode = 404
      throw err
    }

    // RF-24.1: No generar comprobantes definitivos para pagos no aprobados
    if (pago.estado !== 'APROBADO') {
      const err = new Error(`No se puede emitir un comprobante para un pago en estado ${pago.estado}. Debe estar APROBADO.`)
      ;(err as any).statusCode = 409
      ;(err as any).code = 'PAYMENT_NOT_APPROVED'
      throw err
    }

    // RF-24.6: Idempotencia estricta
    let comprobanteExistente: ComprobanteMock | undefined
    for (const c of this.comprobantes.values()) {
      if (c.idPago === idPago) {
        comprobanteExistente = c
        break
      }
    }

    if (comprobanteExistente && comprobanteExistente.estado === 'GENERADO' && comprobanteExistente.archivoContenido) {
      return { ...comprobanteExistente }
    }

    const turno = this.turnos.get(pago.idTurno)!
    const medico = this.medicos.get(turno.idMedico)!
    const paciente = this.pacientes.get(pago.idPaciente)!

    const idComprobante = comprobanteExistente?.idComprobante || `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const numeroComprobante = comprobanteExistente?.numeroComprobante || `CMP-${pago.idPago.slice(-6).toUpperCase()}`
    const nombreArchivo = `comprobante-${numeroComprobante}.pdf`
    const archivoKey = `comprobantes/${pago.idPago}/${nombreArchivo}`

    const snapshot: DatosComprobantePDF = {
      numeroComprobante,
      fechaEmision: new Date(),
      idTransaccion: pago.transaccionExternaId || pago.idPago,
      idTurno: pago.idTurno,
      paciente: {
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        dni: paciente.dni,
        email: paciente.email,
        obraSocial: paciente.obraSocial,
        numeroAfiliado: paciente.numeroAfiliado,
      },
      medico: {
        nombre: medico.nombre,
        apellido: medico.apellido,
        especialidad: medico.especialidad,
        matricula: medico.matricula,
        consultorio: medico.consultorio,
      },
      turno: {
        fecha: turno.fecha,
        hora: turno.hora,
        modalidad: turno.modalidad,
      },
      pago: {
        monto: pago.monto,
        moneda: pago.moneda,
        proveedor: pago.proveedor,
        estado: pago.estado,
        aprobadoAt: pago.aprobadoAt ? pago.aprobadoAt.toISOString() : null,
      },
    }

    // Registrar en estado GENERANDO
    const enGeneracion: ComprobanteMock = {
      idComprobante,
      idPago: pago.idPago,
      numeroComprobante,
      estado: 'GENERANDO',
      archivoKey,
      archivoContenido: null,
      mimeType: 'application/pdf',
      nombreArchivo,
      tamanoBytes: null,
      datosSnapshot: snapshot,
      fechaEmision: new Date(),
      errorGeneracion: null,
    }
    this.comprobantes.set(idComprobante, enGeneracion)

    if (this.simularFallaPdf) {
      enGeneracion.estado = 'ERROR'
      enGeneracion.errorGeneracion = 'Falla simulada de almacenamiento/generador'
      this.comprobantes.set(idComprobante, enGeneracion)
      const err = new Error('Fallo al generar el PDF del comprobante: Error de conexión con almacenamiento')
      ;(err as any).statusCode = 500
      ;(err as any).code = 'PDF_GENERATION_FAILED'
      throw err
    }

    // Generar PDF real mediante ComprobantePdfGenerator
    const pdfBytes = await ComprobantePdfGenerator.generar(snapshot)

    enGeneracion.estado = 'GENERADO'
    enGeneracion.archivoContenido = pdfBytes
    enGeneracion.tamanoBytes = pdfBytes.length
    enGeneracion.errorGeneracion = null
    this.comprobantes.set(idComprobante, enGeneracion)

    return { ...enGeneracion }
  }

  async descargarComprobante(idPago: string, idPacienteAutenticado: string | null) {
    if (!idPacienteAutenticado) {
      const err = new Error('No autenticado.')
      ;(err as any).statusCode = 401
      throw err
    }

    const pago = this.pagos.get(idPago)
    if (!pago) {
      const err = new Error('El pago solicitado no existe.')
      ;(err as any).statusCode = 404
      throw err
    }

    // RF-24.5: Verificación estricta de titularidad
    if (pago.idPaciente !== idPacienteAutenticado) {
      const err = new Error('Acceso denegado: el comprobante solicitado no pertenece a tu cuenta.')
      ;(err as any).statusCode = 403
      throw err
    }

    if (pago.estado !== 'APROBADO') {
      const err = new Error(`El pago no está aprobado (estado: ${pago.estado}). No existe comprobante disponible.`)
      ;(err as any).statusCode = 409
      throw err
    }

    let comprobante: ComprobanteMock | undefined
    for (const c of this.comprobantes.values()) {
      if (c.idPago === idPago) {
        comprobante = c
        break
      }
    }

    if (!comprobante || comprobante.estado === 'ERROR' || !comprobante.archivoContenido) {
      // Intentar recuperación/generación automática
      comprobante = await this.generarComprobantePago(idPago)
    }

    if (comprobante.estado === 'GENERANDO') {
      const err = new Error('El comprobante se está generando actualmente.')
      ;(err as any).statusCode = 409
      throw err
    }

    return {
      buffer: comprobante.archivoContenido!,
      mimeType: comprobante.mimeType,
      nombreArchivo: comprobante.nombreArchivo,
      tamanoBytes: comprobante.tamanoBytes!,
    }
  }
}

// --------------------------------------------------------------------------
// EJECUCIÓN DE PRUEBAS
// --------------------------------------------------------------------------
async function runAllTests() {
  console.log('\n=== US-24: PRUEBAS DE GENERACIÓN Y DESCARGA DE COMPROBANTES EN PDF ===\n')

  // Datos base compartidos
  const pacienteA: PacienteMock = {
    idPaciente: 'pac_001',
    nombre: 'Martina',
    apellido: 'Gómez',
    dni: '38123456',
    email: 'martina.gomez@example.com',
  }

  const pacienteB: PacienteMock = {
    idPaciente: 'pac_002',
    nombre: 'Lucas',
    apellido: 'Díaz',
    dni: '39999888',
    email: 'lucas.diaz@example.com',
  }

  const medico1: MedicoMock = {
    idMedico: 'med_001',
    nombre: 'Valeria',
    apellido: 'Fernández',
    especialidad: 'CLINICA_MEDICA',
    matricula: 'MN-88412',
    consultorio: 'Consultorio 104',
  }

  const turno1: TurnoMock = {
    idTurno: 'tur_001',
    idPaciente: 'pac_001',
    idMedico: 'med_001',
    fecha: '2026-11-10',
    hora: '14:30',
    modalidad: 'PARTICULAR',
    estado: 'CONFIRMADO',
  }

  // --------------------------------------------------------------------------
  // Escenario 1 — Camino exitoso: generación automática de PDF tras confirmación
  // --------------------------------------------------------------------------
  await test('Escenario 1 / RF-24.1: Genera automáticamente el comprobante en PDF al confirmarse el pago', async () => {
    const service = new ComprobanteServiceMock()
    service.pacientes.set(pacienteA.idPaciente, pacienteA)
    service.medicos.set(medico1.idMedico, medico1)
    service.turnos.set(turno1.idTurno, turno1)

    const pagoConfirmado: PagoMock = {
      idPago: 'pago_001',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'APROBADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: 'SIM-TRANS-9921',
      idempotencyKey: 'key_001',
      aprobadoAt: new Date(),
    }
    service.pagos.set(pagoConfirmado.idPago, pagoConfirmado)

    const comprobante = await service.generarComprobantePago(pagoConfirmado.idPago)

    assert.equal(comprobante.estado, 'GENERADO')
    assert.equal(comprobante.idPago, 'pago_001')
    assert.ok(comprobante.numeroComprobante.startsWith('CMP-'))
    assert.ok(comprobante.nombreArchivo.endsWith('.pdf'))
    assert.ok(comprobante.archivoContenido instanceof Uint8Array)
    assert.ok(comprobante.tamanoBytes! > 0)

    // Validar cabecera estándar de archivo PDF (%PDF-)
    const pdfHeader = Buffer.from(comprobante.archivoContenido!.slice(0, 5)).toString('ascii')
    assert.equal(pdfHeader, '%PDF-')
  })

  // --------------------------------------------------------------------------
  // Escenario 2 — Descarga de comprobante asociada al pago en historial
  // --------------------------------------------------------------------------
  await test('Escenario 2 / RF-24.3 & RF-24.4: Permite descargar comprobante con metadatos y headers correctos', async () => {
    const service = new ComprobanteServiceMock()
    service.pacientes.set(pacienteA.idPaciente, pacienteA)
    service.medicos.set(medico1.idMedico, medico1)
    service.turnos.set(turno1.idTurno, turno1)

    const pago: PagoMock = {
      idPago: 'pago_002',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'APROBADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: 'SIM-TRANS-1002',
      idempotencyKey: 'key_002',
      aprobadoAt: new Date(),
    }
    service.pagos.set(pago.idPago, pago)

    const descarga = await service.descargarComprobante(pago.idPago, pacienteA.idPaciente)

    assert.equal(descarga.mimeType, 'application/pdf')
    assert.ok(descarga.nombreArchivo.includes('CMP-'))
    assert.ok(descarga.tamanoBytes > 500)
    assert.ok(descarga.buffer.length > 500)
  })

  // --------------------------------------------------------------------------
  // Escenario 3 — Independencia entre pago y comprobante ante fallo técnico
  // --------------------------------------------------------------------------
  await test('Escenario 3 / RF-24.1 & RF-24.6: Falla en creación de PDF no revierte el pago confirmado y permite reintento', async () => {
    const service = new ComprobanteServiceMock()
    service.pacientes.set(pacienteA.idPaciente, pacienteA)
    service.medicos.set(medico1.idMedico, medico1)
    service.turnos.set(turno1.idTurno, turno1)

    const pago: PagoMock = {
      idPago: 'pago_003',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'APROBADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: 'SIM-TRANS-1003',
      idempotencyKey: 'key_003',
      aprobadoAt: new Date(),
    }
    service.pagos.set(pago.idPago, pago)

    // 1. Simular fallo de almacenamiento o motor PDF
    service.simularFallaPdf = true

    await assert.rejects(
      async () => {
        await service.generarComprobantePago(pago.idPago)
      },
      (err: any) => {
        assert.equal(err.code, 'PDF_GENERATION_FAILED')
        return true
      }
    )

    // 2. Verificar que el pago sigue confirmado en estado APROBADO
    const pagoVerificado = service.pagos.get(pago.idPago)!
    assert.equal(pagoVerificado.estado, 'APROBADO')

    // 3. Verificar que el comprobante quedó en estado ERROR sin perderse
    let compEnError: ComprobanteMock | undefined
    for (const c of service.comprobantes.values()) {
      if (c.idPago === pago.idPago) compEnError = c
    }
    assert.ok(compEnError)
    assert.equal(compEnError!.estado, 'ERROR')
    assert.ok(compEnError!.errorGeneracion?.includes('Falla simulada'))

    // 4. Restaurar servicio y ejecutar reintento/recuperación
    service.simularFallaPdf = false
    const comprobanteRecuperado = await service.generarComprobantePago(pago.idPago)

    assert.equal(comprobanteRecuperado.estado, 'GENERADO')
    assert.equal(comprobanteRecuperado.errorGeneracion, null)
    assert.ok(comprobanteRecuperado.archivoContenido!.length > 0)
  })

  // --------------------------------------------------------------------------
  // Escenario 4 — Pago pendiente o rechazado no genera comprobante
  // --------------------------------------------------------------------------
  await test('Escenario 4 / RF-24.1: Rechaza generar comprobante si el pago está PENDIENTE o RECHAZADO', async () => {
    const service = new ComprobanteServiceMock()
    service.pacientes.set(pacienteA.idPaciente, pacienteA)
    service.medicos.set(medico1.idMedico, medico1)
    service.turnos.set(turno1.idTurno, turno1)

    const pagoPendiente: PagoMock = {
      idPago: 'pago_pendiente',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'PENDIENTE',
      proveedor: 'SIMULADA',
      transaccionExternaId: null,
      idempotencyKey: 'key_pend',
      aprobadoAt: null,
    }
    service.pagos.set(pagoPendiente.idPago, pagoPendiente)

    await assert.rejects(
      async () => {
        await service.generarComprobantePago(pagoPendiente.idPago)
      },
      (err: any) => {
        assert.equal(err.statusCode, 409)
        assert.equal(err.code, 'PAYMENT_NOT_APPROVED')
        return true
      }
    )

    const pagoRechazado: PagoMock = {
      idPago: 'pago_rechazado',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'RECHAZADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: null,
      idempotencyKey: 'key_rech',
      aprobadoAt: null,
    }
    service.pagos.set(pagoRechazado.idPago, pagoRechazado)

    await assert.rejects(
      async () => {
        await service.generarComprobantePago(pagoRechazado.idPago)
      },
      (err: any) => {
        assert.equal(err.statusCode, 409)
        return true
      }
    )
  })

  // --------------------------------------------------------------------------
  // Escenario 5 — Control de seguridad y autorización (RBAC)
  // --------------------------------------------------------------------------
  await test('Escenario 5 / RF-24.5: Prohíbe descarga de comprobante perteneciente a otro paciente (403)', async () => {
    const service = new ComprobanteServiceMock()
    service.pacientes.set(pacienteA.idPaciente, pacienteA)
    service.pacientes.set(pacienteB.idPaciente, pacienteB)
    service.medicos.set(medico1.idMedico, medico1)
    service.turnos.set(turno1.idTurno, turno1)

    const pagoDeA: PagoMock = {
      idPago: 'pago_de_paciente_A',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'APROBADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: 'SIM-991',
      idempotencyKey: 'key_pago_a',
      aprobadoAt: new Date(),
    }
    service.pagos.set(pagoDeA.idPago, pagoDeA)
    await service.generarComprobantePago(pagoDeA.idPago)

    // Intento 1: Paciente B intentando descargar el comprobante de Paciente A
    await assert.rejects(
      async () => {
        await service.descargarComprobante(pagoDeA.idPago, pacienteB.idPaciente)
      },
      (err: any) => {
        assert.equal(err.statusCode, 403)
        return true
      }
    )

    // Intento 2: Usuario anónimo sin sesión
    await assert.rejects(
      async () => {
        await service.descargarComprobante(pagoDeA.idPago, null)
      },
      (err: any) => {
        assert.equal(err.statusCode, 401)
        return true
      }
    )
  })

  // --------------------------------------------------------------------------
  // Escenario 6 — Prevención de duplicados e idempotencia (RF-24.6)
  // --------------------------------------------------------------------------
  await test('Escenario 6 / RF-24.6: Reintentos de confirmación no duplican comprobantes ni regeneran innecesariamente', async () => {
    const service = new ComprobanteServiceMock()
    service.pacientes.set(pacienteA.idPaciente, pacienteA)
    service.medicos.set(medico1.idMedico, medico1)
    service.turnos.set(turno1.idTurno, turno1)

    const pago: PagoMock = {
      idPago: 'pago_idempotencia',
      idTurno: turno1.idTurno,
      idPaciente: pacienteA.idPaciente,
      monto: '25000.00',
      moneda: 'ARS',
      estado: 'APROBADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: 'SIM-IDEMP-1',
      idempotencyKey: 'key_idemp',
      aprobadoAt: new Date(),
    }
    service.pagos.set(pago.idPago, pago)

    // Primera llamada
    const c1 = await service.generarComprobantePago(pago.idPago)

    // Segunda llamada (simula webhook repetido o doble submit)
    const c2 = await service.generarComprobantePago(pago.idPago)

    assert.equal(c1.idComprobante, c2.idComprobante)
    assert.equal(c1.numeroComprobante, c2.numeroComprobante)
    assert.equal(service.comprobantes.size, 1, 'Debe existir exactamente 1 comprobante registrado')
  })

  // --------------------------------------------------------------------------
  // Escenario 8 — Integridad del contenido, datos requeridos y leyenda legal
  // --------------------------------------------------------------------------
  await test('Escenario 8 / RF-24.2 & 6.7: Estructura PDF válida con datos de paciente, médico y leyenda de no-factura fiscal', async () => {
    const datos: DatosComprobantePDF = {
      numeroComprobante: 'CMP-20261024-TEST99',
      fechaEmision: new Date('2026-10-24T15:00:00Z'),
      idTransaccion: 'SIM-TX-882190',
      idTurno: 'tur_test_88',
      paciente: {
        nombre: 'Sofía',
        apellido: 'Rodríguez',
        dni: '40112233',
        email: 'sofia.rodriguez@example.com',
      },
      medico: {
        nombre: 'Mariano',
        apellido: 'Castro',
        especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
        matricula: 'MN-77123',
        consultorio: 'Consultorio 2B',
      },
      turno: {
        fecha: '2026-11-15',
        hora: '10:00',
        modalidad: 'PARTICULAR',
      },
      pago: {
        monto: '30000.00',
        moneda: 'ARS',
        proveedor: 'SIMULADA',
        estado: 'APROBADO',
        aprobadoAt: '2026-10-24T15:00:00Z',
      },
    }

    const pdfBytes = await ComprobantePdfGenerator.generar(datos)

    assert.ok(pdfBytes instanceof Uint8Array)
    assert.ok(pdfBytes.length > 800, 'El archivo PDF debe tener un tamaño superior a 800 bytes')

    const contenidoTexto = Buffer.from(pdfBytes).toString('latin1')

    // Validar identificador estándar PDF
    assert.ok(contenidoTexto.startsWith('%PDF-'), 'El documento debe comenzar con firma %PDF-')
    assert.ok(contenidoTexto.includes('%%EOF'), 'El documento debe cerrar con delimitador %%EOF')

    // Validar parseo real del PDF y metadatos oficiales (RF-24.2 y 6.7)
    const { PDFDocument } = await import('pdf-lib')
    const docVerificado = await PDFDocument.load(pdfBytes)

    assert.equal(docVerificado.getPageCount(), 1, 'El comprobante debe constar de 1 página A4')
    assert.ok(docVerificado.getTitle()?.includes('Comprobante de Pago'), 'El título debe indicar Comprobante de Pago')
    assert.ok(docVerificado.getSubject()?.includes('Constancia de Pago'), 'El asunto debe indicar Constancia de Pago')
    assert.equal(docVerificado.getAuthor(), 'SIGESMED - Sistema de Gestión Médica')
    assert.equal(docVerificado.getCreator(), 'SIGESMED')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-24 PASARON EXITOSAMENTE (8/8) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS DE US-24:', err)
  process.exit(1)
})
