import nodemailer from 'nodemailer'

export interface DatosRecordatorioEmail {
  email: string
  pacienteNombre: string
  medicoNombre: string
  especialidad?: string | null
  fecha: string
  hora: string
  consultorio?: string | null
  direccion?: string | null
}

export interface DatosAvisoCancelacionEmail {
  email: string
  pacienteNombre: string
  medicoNombre: string
  especialidad?: string | null
  fecha: string
  hora: string
}

export interface DatosConfirmacionTurnoEmail {
  email: string
  pacienteNombre: string
  medicoNombre: string
  especialidad: string
  fecha: string
  hora: string
  consultorio?: string | null
}

export interface ResultadoEnvioEmail {
  ok: boolean
  messageId?: string
  error?: string
  esErrorTransitorio: boolean
}

export class EmailDeliveryError extends Error {
  readonly esErrorTransitorio: boolean

  constructor(message: string, esErrorTransitorio: boolean = true) {
    super(message)
    this.name = 'EmailDeliveryError'
    this.esErrorTransitorio = esErrorTransitorio
  }
}

function formatearEspecialidad(especialidad?: string | null): string {
  if (!especialidad) return ''
  switch (especialidad) {
    case 'CLINICA_MEDICA':
      return 'Clínica Médica'
    case 'PEDIATRIA':
      return 'Pediatría'
    case 'TRAUMATOLOGIA_ORTOPEDIA':
      return 'Traumatología y Ortopedia'
    default:
      return especialidad.replace(/_/g, ' ')
  }
}

export function construirPlantillaRecordatorio(datos: DatosRecordatorioEmail): {
  asunto: string
  html: string
  textoPlano: string
} {
  const asunto = 'Recordatorio de tu turno médico'
  const especialidadTexto = formatearEspecialidad(datos.especialidad)

  const lineasUbicacionHtml = []
  const lineasUbicacionTexto = []

  if (datos.consultorio?.trim()) {
    lineasUbicacionHtml.push(`<tr><td style="padding: 8px 0; color: #4b5563; font-weight: 500;">Consultorio:</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${escapeHtml(datos.consultorio.trim())}</td></tr>`)
    lineasUbicacionTexto.push(`Consultorio: ${datos.consultorio.trim()}`)
  }

  if (datos.direccion?.trim()) {
    lineasUbicacionHtml.push(`<tr><td style="padding: 8px 0; color: #4b5563; font-weight: 500;">Dirección:</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${escapeHtml(datos.direccion.trim())}</td></tr>`)
    lineasUbicacionTexto.push(`Dirección: ${datos.direccion.trim()}`)
  }

  const filaEspecialidadHtml = especialidadTexto
    ? `<tr><td style="padding: 8px 0; color: #4b5563; font-weight: 500;">Especialidad:</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${escapeHtml(especialidadTexto)}</td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${asunto}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0284c7; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">SIGESMED</h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: #e0f2fe;">Sistema de Gestión Médica</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #111827;">
                Hola <strong>${escapeHtml(datos.pacienteNombre)}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #374151;">
                Te recordamos que tenés un turno médico programado. A continuación te detallamos la información de tu cita:
              </p>
              
              <table role="presentation" width="100%" style="border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px;">
                <tr>
                  <td style="padding: 16px;">
                    <table role="presentation" width="100%" style="border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #4b5563; font-weight: 500;">Profesional:</td>
                        <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">Dr./Dra. ${escapeHtml(datos.medicoNombre)}</td>
                      </tr>
                      ${filaEspecialidadHtml}
                      <tr>
                        <td style="padding: 8px 0; color: #4b5563; font-weight: 500;">Fecha:</td>
                        <td style="padding: 8px 0; color: #0284c7; font-weight: 700; text-align: right;">${escapeHtml(datos.fecha)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #4b5563; font-weight: 500;">Horario:</td>
                        <td style="padding: 8px 0; color: #0284c7; font-weight: 700; text-align: right;">${escapeHtml(datos.hora)} hs</td>
                      </tr>
                      ${lineasUbicacionHtml.join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                  <strong>Importante:</strong> Te recomendamos presentarte 10 minutos antes con tu credencial y documento de identidad. En caso de no poder asistir, recordá que podés cancelar tu turno desde la plataforma con al menos 48 horas de anticipación.
                </p>
              </div>

              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6b7280; text-align: center;">
                Podés consultar o gestionar tus citas ingresando a tu cuenta en <strong>SIGESMED</strong>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Este es un correo automático generado por SIGESMED. Por favor, no respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textoPlano = `SIGESMED - Recordatorio de tu turno médico

Hola ${datos.pacienteNombre},

Te recordamos los datos de tu turno médico programado:
- Profesional: Dr./Dra. ${datos.medicoNombre}${especialidadTexto ? `\n- Especialidad: ${especialidadTexto}` : ''}
- Fecha: ${datos.fecha}
- Horario: ${datos.hora} hs
${lineasUbicacionTexto.length > 0 ? lineasUbicacionTexto.map((l) => `- ${l}`).join('\n') + '\n' : ''}
Importante: Te recomendamos presentarte 10 minutos antes con tu credencial y documento. Si necesitás cancelar, recordá hacerlo desde el sistema con al menos 48 horas de anticipación.

Podés ingresar a SIGESMED para revisar el estado de tus citas.`

  return { asunto, html, textoPlano }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function construirPlantillaConfirmacionTurno(datos: DatosConfirmacionTurnoEmail): {
  asunto: string
  html: string
  textoPlano: string
} {
  const asunto = 'Confirmación de tu turno médico - SIGESMED'
  const consultorioHtml = datos.consultorio?.trim()
    ? `<tr><td style="padding: 8px 0; color: #4b5563;">Consultorio:</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${escapeHtml(datos.consultorio.trim())}</td></tr>`
    : ''
  const consultorioTexto = datos.consultorio?.trim()
    ? `\n- Consultorio: ${datos.consultorio.trim()}`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${asunto}</title></head>
<body style="margin:0;padding:24px 12px;font-family:Arial,sans-serif;background:#f3f4f6;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0284c7;padding:24px;text-align:center;color:#fff;"><h1 style="margin:0;font-size:20px;">SIGESMED</h1><p style="margin:6px 0 0;">Confirmación de turno</p></td></tr>
      <tr><td style="padding:28px 24px;">
        <p>Hola <strong>${escapeHtml(datos.pacienteNombre)}</strong>,</p>
        <p>Tu turno quedó confirmado. Estos son los datos de la consulta:</p>
        <table role="presentation" width="100%" style="border-collapse:collapse;background:#f8fafc;padding:16px;">
          <tr><td style="padding:8px 0;color:#4b5563;">Profesional:</td><td style="padding:8px 0;font-weight:600;text-align:right;">Dr./Dra. ${escapeHtml(datos.medicoNombre)}</td></tr>
          <tr><td style="padding:8px 0;color:#4b5563;">Especialidad:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${escapeHtml(datos.especialidad)}</td></tr>
          <tr><td style="padding:8px 0;color:#4b5563;">Fecha:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${escapeHtml(datos.fecha)}</td></tr>
          <tr><td style="padding:8px 0;color:#4b5563;">Horario:</td><td style="padding:8px 0;font-weight:600;text-align:right;">${escapeHtml(datos.hora)} hs</td></tr>
          ${consultorioHtml}
        </table>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">Este es un correo automático de SIGESMED. No respondas a este mensaje.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`

  const textoPlano = `SIGESMED - Confirmación de tu turno médico

Hola ${datos.pacienteNombre},

Tu turno quedó confirmado:
- Profesional: Dr./Dra. ${datos.medicoNombre}
- Especialidad: ${datos.especialidad}
- Fecha: ${datos.fecha}
- Horario: ${datos.hora} hs${consultorioTexto}

Este es un correo automático de SIGESMED. No respondas a este mensaje.`

  return { asunto, html, textoPlano }
}

export function construirPlantillaAvisoCancelacion(datos: DatosAvisoCancelacionEmail): {
  asunto: string
  html: string
  textoPlano: string
} {
  const asunto = 'Importante: cancelación de su turno médico - SIGESMED'
  const especialidadTexto = formatearEspecialidad(datos.especialidad)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${asunto}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color: #dc2626; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">SIGESMED</h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: #fee2e2;">Aviso Oficial de Cancelación de Turno</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5; color: #0f172a;">
                Estimado/a <strong>${escapeHtml(datos.pacienteNombre)}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
                Le informamos que su turno médico ha debido ser cancelado debido a modificaciones en los días y horarios de atención del profesional.
              </p>

              <table role="presentation" width="100%" style="border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; color: #64748b; font-weight: 500; font-size: 14px;">Profesional:</td>
                  <td style="padding: 8px 12px; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">Dr./Dra. ${escapeHtml(datos.medicoNombre)}</td>
                </tr>
                ${especialidadTexto ? `<tr>
                  <td style="padding: 8px 12px; color: #64748b; font-weight: 500; font-size: 14px;">Especialidad:</td>
                  <td style="padding: 8px 12px; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${escapeHtml(especialidadTexto)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 12px; color: #64748b; font-weight: 500; font-size: 14px;">Fecha original:</td>
                  <td style="padding: 8px 12px; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${escapeHtml(datos.fecha)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #64748b; font-weight: 500; font-size: 14px;">Horario original:</td>
                  <td style="padding: 8px 12px; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${escapeHtml(datos.hora)} hs</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #64748b; font-weight: 500; font-size: 14px;">Motivo:</td>
                  <td style="padding: 8px 12px; color: #b91c1c; font-weight: 600; font-size: 14px; text-align: right;">Modificación de agenda médica</td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
                Lamentamos sinceramente los inconvenientes que esta situación pueda ocasionarle en su organización personal.
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #475569;">
                Para coordinar una nueva atención, le solicitamos ingresar nuevamente al sistema SIGESMED para consultar los turnos disponibles y seleccionar la fecha y horario que mejor se adapte a sus necesidades.
              </p>

              <div style="text-align: center; margin: 28px 0 12px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://sigesmed.com'}/dashboard/paciente/reservar-turno" 
                   style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                  Consultar nuevos turnos disponibles
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Este es un mensaje institucional automático del Sistema de Gestión Médica (SIGESMED). Por favor no responda a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textoPlano = `Importante: cancelación de su turno médico - SIGESMED

Estimado/a ${datos.pacienteNombre},

Le informamos que su turno médico ha debido ser cancelado debido a modificaciones en los días y horarios de atención del profesional.

Datos del turno cancelado:
- Profesional: Dr./Dra. ${datos.medicoNombre}${especialidadTexto ? `\n- Especialidad: ${especialidadTexto}` : ''}
- Fecha original: ${datos.fecha}
- Horario original: ${datos.hora} hs
- Motivo: Modificación de agenda médica

Lamentamos sinceramente los inconvenientes ocasionados.

Para coordinar una nueva cita, le solicitamos ingresar a SIGESMED para consultar la disponibilidad y reservar un nuevo turno que resulte de su conveniencia.

Atentamente,
Equipo de Administración de SIGESMED`

  return { asunto, html, textoPlano }
}

export class EmailService {
  /** Envía el comprobante de una reserva confirmada usando Resend. */
  static async enviarConfirmacionTurno(
    datos: DatosConfirmacionTurnoEmail
  ): Promise<ResultadoEnvioEmail> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!datos.email || !emailRegex.test(datos.email.trim())) {
      return {
        ok: false,
        error: 'Dirección de correo electrónico inválida o ausente',
        esErrorTransitorio: false,
      }
    }

    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const password = process.env.SMTP_PASSWORD
    const from = process.env.EMAIL_FROM || user
    if (!host || !from || ((user && !password) || (!user && password))) {
      return {
        ok: false,
        error: 'Configuración SMTP incompleta: revisá SMTP_HOST, SMTP_USER, SMTP_PASSWORD y EMAIL_FROM',
        esErrorTransitorio: false,
      }
    }

    const { asunto, html, textoPlano } = construirPlantillaConfirmacionTurno(datos)

    try {
      const port = Number(process.env.SMTP_PORT || 587)
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        ...(user && password ? { auth: { user, pass: password } } : {}),
      })
      const info = await transporter.sendMail({
        from,
        to: datos.email.trim(),
        subject: asunto,
        html,
        text: textoPlano,
      })
      return { ok: true, messageId: info.messageId, esErrorTransitorio: false }
    } catch (error) {
      const err = error as Error
      const smtpError = error as Error & { responseCode?: number }
      const esTransitorio =
        err.name === 'AbortError' ||
        (smtpError.responseCode !== undefined && smtpError.responseCode >= 400 && smtpError.responseCode < 500) ||
        /network|timeout|ECONNRESET|ETIMEDOUT|ECONNECTION|ESOCKET|EDNS/i.test(err.message)
      return {
        ok: false,
        error: err.message || 'Fallo de comunicación con el proveedor de correo',
        esErrorTransitorio: esTransitorio,
      }
    }
  }

  /**
   * Envía un recordatorio de turno médico al correo registrado del paciente.
   * Maneja errores transitorios (red/timeouts/5xx) y permanentes (formato de correo inválido).
   */
  static async enviarRecordatorioTurno(
    datos: DatosRecordatorioEmail
  ): Promise<ResultadoEnvioEmail> {
    // 1. Validación de dirección de correo electrónico (error permanente si es inválida)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!datos.email || !emailRegex.test(datos.email.trim())) {
      return {
        ok: false,
        error: 'Dirección de correo electrónico inválida o ausente',
        esErrorTransitorio: false,
      }
    }

    const { asunto, html, textoPlano } = construirPlantillaRecordatorio(datos)

    try {
      const host = process.env.SMTP_HOST
      const user = process.env.SMTP_USER
      const password = process.env.SMTP_PASSWORD
      const from = process.env.EMAIL_FROM || user
      if (!host || !from || ((user && !password) || (!user && password))) {
        return {
          ok: false,
          error: 'Configuración SMTP incompleta para enviar el recordatorio',
          esErrorTransitorio: false,
        }
      }

      const port = Number(process.env.SMTP_PORT || 587)
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        ...(user && password ? { auth: { user, pass: password } } : {}),
      })
      const info = await transporter.sendMail({
        from,
        to: datos.email.trim(),
        subject: asunto,
        html,
        text: textoPlano,
      })

      return {
        ok: true,
        messageId: info.messageId,
        esErrorTransitorio: false,
      }
    } catch (error) {
      const err = error as Error
      const smtpError = error as Error & { responseCode?: number }
      const esTransitorio =
        err.name === 'AbortError' ||
        (smtpError.responseCode !== undefined && smtpError.responseCode >= 400 && smtpError.responseCode < 500) ||
        /network|timeout|ECONNRESET|ETIMEDOUT|ECONNECTION|ESOCKET|EDNS/i.test(err.message)

      return {
        ok: false,
        error: err.message || 'Fallo de comunicación con el proveedor de correo',
        esErrorTransitorio: esTransitorio,
      }
    }
  }

  /**
   * Envía el aviso formal de cancelación administrativa de un turno al correo del paciente (US-22).
   */
  static async enviarAvisoCancelacionAdministrativa(
    datos: DatosAvisoCancelacionEmail
  ): Promise<ResultadoEnvioEmail> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!datos.email || !emailRegex.test(datos.email.trim())) {
      return {
        ok: false,
        error: 'Dirección de correo electrónico inválida o ausente',
        esErrorTransitorio: false,
      }
    }

    const { asunto, html, textoPlano } = construirPlantillaAvisoCancelacion(datos)

    try {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'SIGESMED <turnos@sigesmed.com>',
            to: [datos.email.trim()],
            subject: asunto,
            html,
            text: textoPlano,
          }),
        })

        if (!response.ok) {
          const status = response.status
          const esTransitorio = status === 429 || status >= 500
          let errorDetalle = `Error HTTP ${status} del proveedor de correo`
          try {
            const errorJson = await response.json()
            if (errorJson?.message) errorDetalle = `${errorDetalle}: ${errorJson.message}`
          } catch {
            // Ignorar fallo de parseo
          }

          return {
            ok: false,
            error: errorDetalle,
            esErrorTransitorio: esTransitorio,
          }
        }

        const data = await response.json()
        return {
          ok: true,
          messageId: data?.id ?? `resend_${Date.now()}`,
          esErrorTransitorio: false,
        }
      }

      // Modo desarrollo / simulación
      await new Promise((resolve) => setTimeout(resolve, 60))
      const partes = datos.email.split('@')
      const emailAnonimo = partes[0].length > 2
        ? `${partes[0].slice(0, 2)}***@${partes[1] || ''}`
        : `***@${partes[1] || ''}`

      console.log(
        `[EMAIL-SERVICE] Aviso de cancelación emitido exitosamente a ${emailAnonimo} para turno del ${datos.fecha} ${datos.hora}`
      )

      return {
        ok: true,
        messageId: `sim_cancel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        esErrorTransitorio: false,
      }
    } catch (error) {
      const err = error as Error
      const esTransitorio =
        err.name === 'AbortError' ||
        err.message.includes('fetch') ||
        err.message.includes('network') ||
        err.message.includes('timeout') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('ETIMEDOUT')

      return {
        ok: false,
        error: err.message || 'Fallo de comunicación con el proveedor de correo',
        esErrorTransitorio: esTransitorio,
      }
    }
  }

  /**
   * Simula el envío de un correo de notificación de cancelación a un paciente (US-07).
   */
  static async enviarNotificacionCancelacion(
    email: string,
    paciente: string,
    fecha_hora: string,
    medico: string,
    motivo: string
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    console.log(`[EMAIL] A: ${email}`)
    console.log(`[EMAIL] Asunto: Cancelación de turno - SIGESMED`)
    console.log(
      `[EMAIL] Mensaje: Hola ${paciente},\nTu turno del ${fecha_hora} con el Dr./Dra. ${medico} ha sido cancelado.\nMotivo: ${motivo}\nPor favor, ingresa al sistema para solicitar un nuevo turno.`
    )
  }
}
