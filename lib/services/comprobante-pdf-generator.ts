import { PDFDocument, StandardFonts, rgb, grayscale } from 'pdf-lib'

export interface DatosComprobantePDF {
  numeroComprobante: string
  fechaEmision: Date
  idTransaccion: string
  idTurno: string
  paciente: {
    nombre: string
    apellido: string
    dni: string
    email: string
    obraSocial?: string | null
    numeroAfiliado?: string | null
  }
  medico: {
    nombre: string
    apellido: string
    especialidad: string
    matricula?: string | null
    consultorio?: string | null
  }
  turno: {
    fecha: string
    hora: string
    modalidad: string
  }
  pago: {
    monto: string
    moneda: string
    proveedor: string
    estado: string
    aprobadoAt?: string | null
  }
}

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

/**
 * Limpia y normaliza texto para asegurar compatibilidad estricta con la codificación WinAnsi de StandardFonts.
 */
function sanitizarTexto(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .normalize('NFC')
    .replace(/[✓✔]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

function formatearFechaLegible(fechaStr: string): string {
  try {
    const [anio, mes, dia] = fechaStr.slice(0, 10).split('-').map(Number)
    const fechaObj = new Date(Date.UTC(anio, mes - 1, dia))
    return fechaObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return fechaStr
  }
}

export class ComprobantePdfGenerator {
  /**
   * Genera el documento PDF de comprobante de pago cumpliendo con RF-24.2.
   * Retorna un Uint8Array con los bytes válidos del PDF.
   */
  static async generar(datos: DatosComprobantePDF): Promise<Uint8Array> {
    const doc = await PDFDocument.create()

    // Metadatos del documento PDF
    doc.setTitle(`Comprobante de Pago ${datos.numeroComprobante}`)
    doc.setAuthor('SIGESMED - Sistema de Gestión Médica')
    doc.setSubject('Constancia de Pago de Consulta Particular')
    doc.setCreator('SIGESMED')
    doc.setProducer('SIGESMED PDF Generator')
    doc.setCreationDate(datos.fechaEmision)

    // Formato estándar A4: 595.28 x 841.89 pt
    const page = doc.addPage([595.28, 841.89])
    const { width, height } = page.getSize()

    const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

    // Paleta de colores
    const azulOscuro = rgb(0.06, 0.09, 0.16) // #0f172a
    const azulCabecera = rgb(0.12, 0.23, 0.37) // #1e3a5f
    const grisTexto = rgb(0.3, 0.35, 0.42) // #475569
    const grisClaro = rgb(0.95, 0.96, 0.98) // #f1f5f9
    const bordeGris = rgb(0.85, 0.88, 0.92) // #cbd5e1
    const verdeExito = rgb(0.02, 0.47, 0.34) // #047857
    const fondoVerde = rgb(0.92, 0.98, 0.95) // #ecfdf5
    const blanco = rgb(1, 1, 1)

    const margenX = 40
    let cursorY = height - 40

    // --------------------------------------------------------------------------
    // 1. ENCABEZADO SUPERIOR / BANNER
    // --------------------------------------------------------------------------
    page.drawRectangle({
      x: margenX,
      y: cursorY - 75,
      width: width - margenX * 2,
      height: 75,
      color: azulCabecera,
    })

    page.drawText('SIGESMED', {
      x: margenX + 20,
      y: cursorY - 32,
      size: 20,
      font: fontBold,
      color: blanco,
    })

    page.drawText('SISTEMA INTEGRAL DE GESTIÓN MÉDICA', {
      x: margenX + 20,
      y: cursorY - 48,
      size: 8,
      font: fontRegular,
      color: rgb(0.78, 0.85, 0.95),
    })

    page.drawText('COMPROBANTE DE PAGO', {
      x: width - margenX - 220,
      y: cursorY - 30,
      size: 13,
      font: fontBold,
      color: blanco,
    })

    page.drawText('CONSULTA MÉDICA PARTICULAR', {
      x: width - margenX - 220,
      y: cursorY - 46,
      size: 8,
      font: fontBold,
      color: rgb(0.85, 0.92, 1),
    })

    const emisionTexto = `Emisión: ${datos.fechaEmision.toISOString().slice(0, 10)} ${datos.fechaEmision.toISOString().slice(11, 16)} UTC`
    page.drawText(emisionTexto, {
      x: width - margenX - 220,
      y: cursorY - 60,
      size: 8,
      font: fontRegular,
      color: rgb(0.78, 0.85, 0.95),
    })

    cursorY -= 95

    // --------------------------------------------------------------------------
    // 2. NÚMERO DE COMPROBANTE Y BADGE DE ESTADO
    // --------------------------------------------------------------------------
    page.drawRectangle({
      x: margenX,
      y: cursorY - 42,
      width: width - margenX * 2,
      height: 42,
      color: grisClaro,
      borderColor: bordeGris,
      borderWidth: 1,
    })

    page.drawText('N° DE COMPROBANTE:', {
      x: margenX + 16,
      y: cursorY - 26,
      size: 9,
      font: fontBold,
      color: grisTexto,
    })

    page.drawText(sanitizarTexto(datos.numeroComprobante), {
      x: margenX + 130,
      y: cursorY - 26,
      size: 11,
      font: fontBold,
      color: azulOscuro,
    })

    // Badge de Aprobado
    const badgeWidth = 100
    const badgeHeight = 22
    const badgeX = width - margenX - badgeWidth - 16
    const badgeY = cursorY - 32

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      color: fondoVerde,
      borderColor: verdeExito,
      borderWidth: 1,
    })

    page.drawText('APROBADO', {
      x: badgeX + 22,
      y: badgeY + 6,
      size: 9,
      font: fontBold,
      color: verdeExito,
    })

    cursorY -= 60

    // --------------------------------------------------------------------------
    // 3. DATOS DEL PACIENTE
    // --------------------------------------------------------------------------
    page.drawText('DATOS DEL PACIENTE', {
      x: margenX,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: azulOscuro,
    })

    cursorY -= 8

    page.drawLine({
      start: { x: margenX, y: cursorY },
      end: { x: width - margenX, y: cursorY },
      thickness: 1,
      color: bordeGris,
    })

    cursorY -= 18

    // Fila 1 paciente: Nombre y DNI
    page.drawText('Paciente:', { x: margenX, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(`${datos.paciente.apellido}, ${datos.paciente.nombre}`), {
      x: margenX + 70,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    page.drawText('DNI:', { x: margenX + 280, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(datos.paciente.dni), {
      x: margenX + 310,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    cursorY -= 16

    // Fila 2 paciente: Email y Modalidad
    page.drawText('Email:', { x: margenX, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(datos.paciente.email), {
      x: margenX + 70,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    page.drawText('Cobertura:', { x: margenX + 280, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText('Particular (Sin obra social)', {
      x: margenX + 345,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    cursorY -= 32

    // --------------------------------------------------------------------------
    // 4. DETALLE DE LA CONSULTA MÉDICA
    // --------------------------------------------------------------------------
    page.drawText('DETALLE DE LA CONSULTA MÉDICA', {
      x: margenX,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: azulOscuro,
    })

    cursorY -= 8

    page.drawLine({
      start: { x: margenX, y: cursorY },
      end: { x: width - margenX, y: cursorY },
      thickness: 1,
      color: bordeGris,
    })

    cursorY -= 18

    const especialidadNombre =
      nombresEspecialidad[datos.medico.especialidad] || datos.medico.especialidad

    // Profesional
    page.drawText('Profesional:', { x: margenX, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    const medicoTexto = `Dr./Dra. ${datos.medico.nombre} ${datos.medico.apellido}${
      datos.medico.matricula ? ` (Mat. ${datos.medico.matricula})` : ''
    }`
    page.drawText(sanitizarTexto(medicoTexto), {
      x: margenX + 80,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    cursorY -= 16

    // Especialidad y consultorio
    page.drawText('Especialidad:', { x: margenX, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(especialidadNombre), {
      x: margenX + 80,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    page.drawText('Lugar / Consultorio:', { x: margenX + 280, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(datos.medico.consultorio || 'Consultorio Central'), {
      x: margenX + 395,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    cursorY -= 16

    // Fecha y hora del turno
    page.drawText('Fecha consulta:', { x: margenX, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(`${formatearFechaLegible(datos.turno.fecha)} a las ${datos.turno.hora} hs`), {
      x: margenX + 80,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    page.drawText('ID Turno:', { x: margenX + 280, y: cursorY, size: 9, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(datos.idTurno), {
      x: margenX + 335,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: azulOscuro,
    })

    cursorY -= 32

    // --------------------------------------------------------------------------
    // 5. DESGLOSE DEL PAGO / ARANCEL
    // --------------------------------------------------------------------------
    page.drawText('DESGLOSE DEL PAGO', {
      x: margenX,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: azulOscuro,
    })

    cursorY -= 8

    page.drawLine({
      start: { x: margenX, y: cursorY },
      end: { x: width - margenX, y: cursorY },
      thickness: 1,
      color: bordeGris,
    })

    cursorY -= 16

    // Tabla de desglose
    const tablaAncho = width - margenX * 2
    const tablaY = cursorY - 60

    // Encabezado tabla
    page.drawRectangle({
      x: margenX,
      y: cursorY - 20,
      width: tablaAncho,
      height: 20,
      color: grisClaro,
    })

    page.drawText('CONCEPTO', { x: margenX + 12, y: cursorY - 14, size: 8, font: fontBold, color: grisTexto })
    page.drawText('CANT.', { x: margenX + 340, y: cursorY - 14, size: 8, font: fontBold, color: grisTexto })
    page.drawText('IMPORTE', { x: width - margenX - 80, y: cursorY - 14, size: 8, font: fontBold, color: grisTexto })

    cursorY -= 20

    // Fila concepto
    const concepto = `Consulta médica presencial - ${especialidadNombre}`
    page.drawText(sanitizarTexto(concepto), { x: margenX + 12, y: cursorY - 16, size: 9, font: fontRegular, color: azulOscuro })
    page.drawText('1', { x: margenX + 350, y: cursorY - 16, size: 9, font: fontRegular, color: azulOscuro })

    const montoNum = Number(datos.pago.monto)
    const montoFormateado = `$${montoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    page.drawText(montoFormateado, { x: width - margenX - 90, y: cursorY - 16, size: 9, font: fontBold, color: azulOscuro })

    cursorY -= 28

    page.drawLine({
      start: { x: margenX, y: cursorY },
      end: { x: width - margenX, y: cursorY },
      thickness: 1,
      color: bordeGris,
    })

    cursorY -= 20

    // Total destacado
    page.drawRectangle({
      x: width - margenX - 220,
      y: cursorY - 26,
      width: 220,
      height: 32,
      color: grisClaro,
      borderColor: bordeGris,
      borderWidth: 1,
    })

    page.drawText('TOTAL ABONADO:', {
      x: width - margenX - 208,
      y: cursorY - 16,
      size: 10,
      font: fontBold,
      color: azulOscuro,
    })

    page.drawText(`${montoFormateado} ${datos.pago.moneda}`, {
      x: width - margenX - 105,
      y: cursorY - 16,
      size: 10,
      font: fontBold,
      color: verdeExito,
    })

    cursorY -= 45

    // Referencias de la transacción
    page.drawText('INFORMACIÓN DE LA TRANSACCIÓN', {
      x: margenX,
      y: cursorY,
      size: 9,
      font: fontBold,
      color: grisTexto,
    })

    cursorY -= 14

    page.drawText('Pasarela de pago:', { x: margenX, y: cursorY, size: 8, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(datos.pago.proveedor), {
      x: margenX + 85,
      y: cursorY,
      size: 8,
      font: fontRegular,
      color: azulOscuro,
    })

    page.drawText('ID Transacción Externa:', { x: margenX + 200, y: cursorY, size: 8, font: fontBold, color: grisTexto })
    page.drawText(sanitizarTexto(datos.idTransaccion), {
      x: margenX + 310,
      y: cursorY,
      size: 8,
      font: fontRegular,
      color: azulOscuro,
    })

    cursorY -= 14

    if (datos.pago.aprobadoAt) {
      page.drawText('Fecha/Hora Confirmación:', { x: margenX, y: cursorY, size: 8, font: fontBold, color: grisTexto })
      page.drawText(sanitizarTexto(datos.pago.aprobadoAt), {
        x: margenX + 115,
        y: cursorY,
        size: 8,
        font: fontRegular,
        color: azulOscuro,
      })
      cursorY -= 14
    }

    // --------------------------------------------------------------------------
    // 6. LEYENDA LEGAL Y FISCAL (RF-24.2 / 6.7)
    // --------------------------------------------------------------------------
    const cajaLegalY = 70
    page.drawRectangle({
      x: margenX,
      y: cajaLegalY,
      width: width - margenX * 2,
      height: 70,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: bordeGris,
      borderWidth: 1,
    })

    page.drawText('IMPORTANTE: CONSTANCIA INTERNA DE PAGO - DOCUMENTO NO VALIDO COMO FACTURA FISCAL', {
      x: margenX + 14,
      y: cajaLegalY + 52,
      size: 7.5,
      font: fontBold,
      color: rgb(0.4, 0.45, 0.52),
    })

    const lineaLegal1 =
      'El presente documento certifica la recepción del pago particular por la consulta médica individualizada.'
    const lineaLegal2 =
      'No constituye una factura fiscal electrónica ni reemplaza comprobantes impositivos regulados por la'
    const lineaLegal3 =
      'autoridad tributaria (AFIP/ARCA). Si requiere una factura fiscal con CAE, solicítela en el centro médico.'

    page.drawText(sanitizarTexto(lineaLegal1), { x: margenX + 14, y: cajaLegalY + 38, size: 7.5, font: fontRegular, color: grisTexto })
    page.drawText(sanitizarTexto(lineaLegal2), { x: margenX + 14, y: cajaLegalY + 26, size: 7.5, font: fontRegular, color: grisTexto })
    page.drawText(sanitizarTexto(lineaLegal3), { x: margenX + 14, y: cajaLegalY + 14, size: 7.5, font: fontRegular, color: grisTexto })

    // Pie de página
    page.drawText(
      sanitizarTexto(`SIGESMED - Comprobante emitido automáticamente - Identificador de verificación: ${datos.numeroComprobante}`),
      {
        x: margenX,
        y: 35,
        size: 7,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.6),
      }
    )

    return doc.save()
  }
}
