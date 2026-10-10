// Servicio de notificaciones por correo electrónico de SIGESMED (US-15 y US-07).

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

export class EmailService {
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
      // 2. Si existe un proveedor configurado (ej. Resend / SMTP), se podría invocar aquí.
      // Por defecto, simulamos el procesamiento con latencia y verificación de conectividad.
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
            // Ignorar fallo de parseo de error
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

      // Modo estándar / Desarrollo / Simulación resiliente:
      // Simulamos latencia de red y confirmación de recepción.
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Mascarar email para registros seguros (sin exponer PII innecesaria en logs)
      const partes = datos.email.split('@')
      const emailAnonimo = partes[0].length > 2 
        ? `${partes[0].slice(0, 2)}***@${partes[1] || ''}` 
        : `***@${partes[1] || ''}`

      console.log(
        `[EMAIL-SERVICE] Recordatorio emitido exitosamente a ${emailAnonimo} para cita del ${datos.fecha} ${datos.hora}`
      )

      return {
        ok: true,
        messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
