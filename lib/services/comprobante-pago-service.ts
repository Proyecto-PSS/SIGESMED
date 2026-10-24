import { prisma } from '../prisma'
import { EstadoComprobante, EstadoPago } from '../generated/prisma/enums'
import { ComprobantePdfGenerator, DatosComprobantePDF } from './comprobante-pdf-generator'

export interface ComprobanteDTO {
  idComprobante: string
  idPago: string
  numeroComprobante: string
  estado: EstadoComprobante
  nombreArchivo: string
  mimeType: string
  tamanoBytes: number | null
  fechaEmision: string
  errorGeneracion: string | null
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string }
  err.statusCode = statusCode
  if (code) err.code = code
  return err
}

function generarNumeroComprobante(idPago: string): string {
  const ahora = new Date()
  const fechaPart = ahora.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  const pagoPart = idPago.slice(-4).toUpperCase()
  return `CMP-${fechaPart}-${pagoPart}${randomPart}`
}

export class ComprobantePagoService {
  /**
   * Genera el comprobante de pago de forma persistente e idempotente para un pago confirmado.
   * RF-24.1, RF-24.2, RF-24.6.
   * La generación nunca revierte el pago confirmado si falla la creación del PDF.
   */
  static async generarComprobantePago(idPago: string): Promise<ComprobanteDTO> {
    if (!idPago || typeof idPago !== 'string') {
      throw errorConEstado('El identificador del pago es requerido.', 400, 'INVALID_PAGO_ID')
    }

    // 1. Obtener pago con todas las relaciones necesarias para el snapshot
    const pago = await prisma.pagoTurno.findUnique({
      where: { idPago },
      include: {
        comprobante: true,
        paciente: true,
        turno: {
          include: {
            medico: true,
          },
        },
      },
    })

    if (!pago) {
      throw errorConEstado('El pago especificado no existe.', 404, 'PAGO_NOT_FOUND')
    }

    // RF-24.1: No generar comprobantes definitivos para pagos no aprobados
    if (pago.estado !== EstadoPago.APROBADO) {
      throw errorConEstado(
        `No se puede emitir un comprobante para un pago en estado ${pago.estado}. Debe estar APROBADO.`,
        409,
        'PAYMENT_NOT_APPROVED'
      )
    }

    // 2. Idempotencia y prevención de duplicados
    let comprobante = pago.comprobante

    if (comprobante && comprobante.estado === EstadoComprobante.GENERADO && comprobante.archivoContenido) {
      // Ya existe y está generado; retornar sin duplicar
      return this.mapearADTO(comprobante)
    }

    // Crear registro inicial o reutilizar existente
    const numeroComprobante = comprobante?.numeroComprobante || generarNumeroComprobante(pago.idPago)
    const nombreArchivo = `comprobante-${numeroComprobante}.pdf`
    const archivoKey = `comprobantes/${pago.idPago}/${nombreArchivo}`

    if (!comprobante) {
      comprobante = await prisma.comprobantePago.create({
        data: {
          idPago: pago.idPago,
          numeroComprobante,
          estado: EstadoComprobante.GENERANDO,
          archivoKey,
          nombreArchivo,
          mimeType: 'application/pdf',
        },
      })
    } else {
      comprobante = await prisma.comprobantePago.update({
        where: { idComprobante: comprobante.idComprobante },
        data: {
          estado: EstadoComprobante.GENERANDO,
          errorGeneracion: null,
        },
      })
    }

    // 3. Preparar snapshot de datos del momento de la emisión
    const datosSnapshot: DatosComprobantePDF = {
      numeroComprobante,
      fechaEmision: new Date(),
      idTransaccion: pago.transaccionExternaId || pago.idPago,
      idTurno: pago.idTurno,
      paciente: {
        nombre: pago.paciente.nombre,
        apellido: pago.paciente.apellido,
        dni: pago.paciente.dni,
        email: pago.paciente.email,
        obraSocial: pago.paciente.obraSocial,
        numeroAfiliado: pago.paciente.numeroAfiliado,
      },
      medico: {
        nombre: pago.turno.medico.nombre,
        apellido: pago.turno.medico.apellido,
        especialidad: pago.turno.medico.especialidad,
        matricula: pago.turno.medico.matricula,
        consultorio: pago.turno.medico.consultorio,
      },
      turno: {
        fecha: pago.turno.fecha.toISOString().slice(0, 10),
        hora: pago.turno.hora,
        modalidad: pago.turno.modalidad || 'PARTICULAR',
      },
      pago: {
        monto: pago.monto.toString(),
        moneda: pago.moneda,
        proveedor: pago.proveedor,
        estado: pago.estado,
        aprobadoAt: pago.aprobadoAt ? pago.aprobadoAt.toISOString() : null,
      },
    }

    // 4. Intentar generar el PDF y persistirlo
    try {
      const pdfBytes = await ComprobantePdfGenerator.generar(datosSnapshot)

      const comprobanteGenerado = await prisma.comprobantePago.update({
        where: { idComprobante: comprobante.idComprobante },
        data: {
          estado: EstadoComprobante.GENERADO,
          archivoContenido: Buffer.from(pdfBytes),
          tamanoBytes: pdfBytes.length,
          datosSnapshot: datosSnapshot as any,
          fechaEmision: new Date(),
          errorGeneracion: null,
        },
      })

      return this.mapearADTO(comprobanteGenerado)
    } catch (error: any) {
      // Registrar falla en el comprobante sin tocar el estado del pago
      console.error('[COMPROBANTE-SERVICE] Error al generar PDF:', error)
      const comprobanteFallido = await prisma.comprobantePago.update({
        where: { idComprobante: comprobante.idComprobante },
        data: {
          estado: EstadoComprobante.ERROR,
          errorGeneracion: error.message || 'Error técnico durante la generación del PDF',
        },
      })

      // Lanzar error descriptivo para el llamador si es una invocación directa
      throw errorConEstado(
        `Fallo al generar el PDF del comprobante: ${error.message || 'Error desconocido'}`,
        500,
        'PDF_GENERATION_FAILED'
      )
    }
  }

  /**
   * Consulta el estado de un comprobante garantizando titularidad del paciente.
   * Si el pago está aprobado pero aún no tiene comprobante, inicia su generación.
   */
  static async obtenerComprobantePorPago(idPago: string, idPaciente: string): Promise<ComprobanteDTO> {
    if (!idPago) {
      throw errorConEstado('El identificador del pago es obligatorio.', 400, 'INVALID_PAGO_ID')
    }

    const pago = await prisma.pagoTurno.findUnique({
      where: { idPago },
      include: { comprobante: true },
    })

    if (!pago) {
      throw errorConEstado('No se encontró el pago solicitado.', 404, 'PAGO_NOT_FOUND')
    }

    if (pago.idPaciente !== idPaciente) {
      throw errorConEstado(
        'Acceso denegado: no tenés permiso para consultar el comprobante de este pago.',
        403,
        'FORBIDDEN_COMPROBANTE_ACCESS'
      )
    }

    if (pago.estado !== EstadoPago.APROBADO) {
      throw errorConEstado(
        'Este pago no se encuentra aprobado, por lo que no posee comprobante emitido.',
        409,
        'PAYMENT_NOT_APPROVED'
      )
    }

    if (!pago.comprobante || pago.comprobante.estado === EstadoComprobante.PENDIENTE) {
      return this.generarComprobantePago(idPago)
    }

    return this.mapearADTO(pago.comprobante)
  }

  /**
   * Recupera el archivo binario PDF para su descarga segura.
   * RF-24.3, RF-24.5.
   */
  static async descargarComprobante(
    idPago: string,
    idPaciente: string
  ): Promise<{
    buffer: Buffer
    mimeType: string
    nombreArchivo: string
    tamanoBytes: number
  }> {
    if (!idPago) {
      throw errorConEstado('El identificador del pago es requerido.', 400, 'INVALID_PAGO_ID')
    }

    const pago = await prisma.pagoTurno.findUnique({
      where: { idPago },
      include: { comprobante: true },
    })

    if (!pago) {
      throw errorConEstado('El pago solicitado no existe.', 404, 'PAGO_NOT_FOUND')
    }

    // RF-24.5: Verificación estricta de titularidad
    if (pago.idPaciente !== idPaciente) {
      throw errorConEstado(
        'Acceso denegado: el comprobante solicitado no pertenece a tu cuenta.',
        403,
        'FORBIDDEN_COMPROBANTE_ACCESS'
      )
    }

    // RF-24.1: No permitir descarga si el pago no fue aprobado
    if (pago.estado !== EstadoPago.APROBADO) {
      throw errorConEstado(
        `El pago no está aprobado (estado: ${pago.estado}). No existe comprobante disponible para descargar.`,
        409,
        'PAYMENT_NOT_APPROVED'
      )
    }

    let comprobante = pago.comprobante

    // Si aún no se generó o falló previamente, intentar generar/recuperar
    if (!comprobante || comprobante.estado === EstadoComprobante.ERROR || !comprobante.archivoContenido) {
      const dto = await this.generarComprobantePago(idPago)
      comprobante = await prisma.comprobantePago.findUnique({
        where: { idComprobante: dto.idComprobante },
      })
    }

    if (!comprobante) {
      throw errorConEstado('No se pudo localizar el comprobante de pago.', 404, 'COMPROBANTE_NOT_FOUND')
    }

    if (comprobante.estado === EstadoComprobante.GENERANDO || comprobante.estado === EstadoComprobante.PENDIENTE) {
      throw errorConEstado(
        'El comprobante se está generando actualmente. Por favor, reintentá en unos instantes.',
        409,
        'COMPROBANTE_GENERATION_IN_PROGRESS'
      )
    }

    if (comprobante.estado === EstadoComprobante.ERROR || !comprobante.archivoContenido) {
      throw errorConEstado(
        'Ocurrió un error al generar el documento. Podés reintentar la descarga para recuperar el archivo.',
        500,
        'COMPROBANTE_CONTENT_ERROR'
      )
    }

    return {
      buffer: Buffer.from(comprobante.archivoContenido),
      mimeType: comprobante.mimeType || 'application/pdf',
      nombreArchivo: comprobante.nombreArchivo || `comprobante-${comprobante.numeroComprobante}.pdf`,
      tamanoBytes: comprobante.tamanoBytes || comprobante.archivoContenido.length,
    }
  }

  private static mapearADTO(comprobante: any): ComprobanteDTO {
    return {
      idComprobante: comprobante.idComprobante,
      idPago: comprobante.idPago,
      numeroComprobante: comprobante.numeroComprobante,
      estado: comprobante.estado,
      nombreArchivo: comprobante.nombreArchivo,
      mimeType: comprobante.mimeType,
      tamanoBytes: comprobante.tamanoBytes,
      fechaEmision: comprobante.fechaEmision.toISOString(),
      errorGeneracion: comprobante.errorGeneracion,
    }
  }
}
