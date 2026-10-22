// Servicio administrativo de gestión, filtrado, cancelación y notificación de turnos (US-21 y US-22).
import { prisma } from '../prisma'
import { EstadoTurno, EstadoNotificacionCancelacion } from '../generated/prisma/enums'
import { EmailService, type DatosAvisoCancelacionEmail } from './email-service'

export interface FiltrosTurnosAdmin {
  paciente?: string
  fecha?: string
  estado?: EstadoTurno
  page?: number
  pageSize?: number
}

export interface TurnoAdminDTO {
  idTurno: string
  idMedico: string
  idPaciente: string | null
  fecha: string
  hora: string
  duracionMinutos: number
  estado: EstadoTurno
  modalidad: string | null
  motivoCancelacion: string | null
  estadoNotificacionCancelacion: EstadoNotificacionCancelacion | null
  notificacionCancelacionIntentadaAt: string | null
  notificacionCancelacionEnviadaAt: string | null
  paciente: {
    idPaciente: string
    nombre: string
    apellido: string
    dni: string
    email: string
    telefono: string | null
  } | null
  medico: {
    idMedico: string
    nombre: string
    apellido: string
    especialidad: string
    matricula: string
    consultorio: string | null
  }
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string }
  err.statusCode = statusCode
  if (code) err.code = code
  return err
}

import { parseFechaFiltro, formatearFechaArgentina } from '../utils/admin-turnos-utils'
export { parseFechaFiltro, formatearFechaArgentina }

export class AdminTurnosService {
  /**
   * RF-21.1 / RF-21.2 / RF-21.3:
   * Consulta los turnos con filtros combinados por paciente (nombre, apellido, DNI, email) y fecha exacta.
   */
  static async consultarTurnos(filtros: FiltrosTurnosAdmin = {}) {
    const { paciente, fecha, estado, page = 1, pageSize = 50 } = filtros
    const validPage = Math.max(1, Number(page) || 1)
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize) || 50))
    const skip = (validPage - 1) * validPageSize

    const where: any = {}

    // 1. Filtro por fecha exacta (evitando desplazamientos de zona horaria)
    if (fecha) {
      const fechaParsed = parseFechaFiltro(fecha)
      if (!fechaParsed) {
        throw errorConEstado('El formato de fecha es inválido. Debe ser YYYY-MM-DD.', 400, 'INVALID_DATE')
      }
      where.fecha = fechaParsed
    }

    // 2. Filtro opcional por estado
    if (estado) {
      where.estado = estado
    }

    // 3. Filtro por paciente (búsqueda en nombre, apellido, DNI o email)
    if (paciente && paciente.trim()) {
      const termino = paciente.trim()
      where.paciente = {
        OR: [
          { nombre: { contains: termino, mode: 'insensitive' } },
          { apellido: { contains: termino, mode: 'insensitive' } },
          { dni: { contains: termino, mode: 'insensitive' } },
          { email: { contains: termino, mode: 'insensitive' } },
        ],
      }
    }

    const [total, rows] = await Promise.all([
      prisma.turno.count({ where }),
      prisma.turno.findMany({
        where,
        include: {
          paciente: {
            select: {
              idPaciente: true,
              nombre: true,
              apellido: true,
              dni: true,
              email: true,
              telefono: true,
            },
          },
          medico: {
            select: {
              idMedico: true,
              nombre: true,
              apellido: true,
              especialidad: true,
              matricula: true,
              consultorio: true,
            },
          },
        },
        orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],
        skip,
        take: validPageSize,
      }),
    ])

    const turnos: TurnoAdminDTO[] = rows.map((r) => ({
      idTurno: r.idTurno,
      idMedico: r.idMedico,
      idPaciente: r.idPaciente,
      fecha: r.fecha.toISOString().slice(0, 10),
      hora: r.hora,
      duracionMinutos: r.duracionMinutos,
      estado: r.estado,
      modalidad: r.modalidad,
      motivoCancelacion: r.motivoCancelacion,
      estadoNotificacionCancelacion: r.estadoNotificacionCancelacion,
      notificacionCancelacionIntentadaAt: r.notificacionCancelacionIntentadaAt?.toISOString() ?? null,
      notificacionCancelacionEnviadaAt: r.notificacionCancelacionEnviadaAt?.toISOString() ?? null,
      paciente: r.paciente,
      medico: r.medico,
    }))

    return {
      turnos,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        total,
        totalPages: Math.ceil(total / validPageSize) || 1,
      },
    }
  }

  /**
   * RF-21.4 / RF-21.6:
   * Cancelación administrativa atómica e individual de un turno confirmado.
   * Conserva el idPaciente, registra el motivo y cancela recordatorios pendientes.
   */
  static async cancelarTurnoAdministrativo(idTurno: string) {
    if (!idTurno || typeof idTurno !== 'string') {
      throw errorConEstado('El identificador del turno es requerido.', 400, 'INVALID_TURNO_ID')
    }

    return prisma.$transaction(async (tx) => {
      // 1. Verificar existencia del turno
      const turnoActual = await tx.turno.findUnique({
        where: { idTurno },
        include: {
          paciente: true,
          medico: true,
        },
      })

      if (!turnoActual) {
        throw errorConEstado('El turno solicitado no existe.', 404, 'TURNO_NOT_FOUND')
      }

      // 2. Verificar que se encuentre en estado CONFIRMADO
      if (turnoActual.estado !== 'CONFIRMADO') {
        throw errorConEstado(
          `No se puede cancelar el turno porque su estado actual es ${turnoActual.estado}. Solo se pueden cancelar turnos CONFIRMADOS.`,
          409,
          'TURNO_NOT_CONFIRMED'
        )
      }

      // 3. Verificar que conserve un paciente asignado
      if (!turnoActual.idPaciente) {
        throw errorConEstado(
          'No se puede cancelar el turno porque no posee un paciente asignado.',
          409,
          'TURNO_WITHOUT_PATIENT'
        )
      }

      const motivoCancelacion = 'Cancelación administrativa por modificación de la agenda médica'

      // 4. Actualización atómica condicional
      const res = await tx.turno.updateMany({
        where: {
          idTurno,
          estado: 'CONFIRMADO',
        },
        data: {
          estado: 'CANCELADO',
          motivoCancelacion,
          estadoNotificacionCancelacion: 'PENDIENTE',
        },
      })

      if (res.count !== 1) {
        throw errorConEstado(
          'El turno no pudo cancelarse porque su estado cambió concurrentemente.',
          409,
          'CONCURRENT_MODIFICATION'
        )
      }

      // 5. Cancelar recordatorios previos de consulta (US-15) asociados a este turno
      await tx.recordatorioTurno.updateMany({
        where: {
          idTurno,
          estado: {
            in: ['PENDIENTE', 'REINTENTO_PROGRAMADO', 'PROCESANDO'],
          },
        },
        data: {
          estado: 'CANCELADO',
          ultimoError: motivoCancelacion,
        },
      })

      const turnoActualizado = await tx.turno.findUniqueOrThrow({
        where: { idTurno },
        include: {
          paciente: true,
          medico: true,
        },
      })

      return {
        success: true,
        message: 'Turno cancelado exitosamente.',
        turno: {
          idTurno: turnoActualizado.idTurno,
          estado: turnoActualizado.estado,
          motivoCancelacion: turnoActualizado.motivoCancelacion,
          estadoNotificacionCancelacion: turnoActualizado.estadoNotificacionCancelacion,
          fecha: turnoActualizado.fecha.toISOString().slice(0, 10),
          hora: turnoActualizado.hora,
          paciente: turnoActualizado.paciente,
          medico: turnoActualizado.medico,
        },
      }
    })
  }

  /**
   * RF-22.1 a RF-22.7:
   * Envía la notificación por email al paciente del turno cancelado administrativamente.
   * Cuenta con reclamo atómico para evitar envíos duplicados por concurrencia.
   */
  static async notificarCancelacion(idTurno: string) {
    if (!idTurno || typeof idTurno !== 'string') {
      throw errorConEstado('El identificador del turno es requerido.', 400, 'INVALID_TURNO_ID')
    }

    // 1. Validar existencia y consistencia del turno
    const turno = await prisma.turno.findUnique({
      where: { idTurno },
      include: {
        paciente: true,
        medico: true,
      },
    })

    if (!turno) {
      throw errorConEstado('El turno solicitado no existe.', 404, 'TURNO_NOT_FOUND')
    }

    if (turno.estado !== 'CANCELADO') {
      throw errorConEstado(
        `Solo es posible notificar turnos cancelados. El estado actual es ${turno.estado}.`,
        409,
        'TURNO_NOT_CANCELLED'
      )
    }

    if (!turno.paciente) {
      throw errorConEstado(
        'El turno cancelado no tiene un paciente asociado para notificar.',
        409,
        'PATIENT_NOT_FOUND'
      )
    }

    if (!turno.paciente.email || !turno.paciente.email.includes('@')) {
      throw errorConEstado(
        'El paciente asociado no posee una dirección de correo electrónico válida.',
        400,
        'INVALID_PATIENT_EMAIL'
      )
    }

    if (turno.estadoNotificacionCancelacion === 'ENVIADA') {
      throw errorConEstado(
        'La notificación para este turno ya fue enviada exitosamente.',
        409,
        'NOTIFICATION_ALREADY_SENT'
      )
    }

    // 2. Reclamo atómico del turno para pasar a PROCESANDO (protección contra doble envío / concurrencia)
    const ahora = new Date()
    const tiempoExpiracionStale = new Date(ahora.getTime() - 5 * 60 * 1000) // 5 minutos para rescatar crashes

    const claimResult = await prisma.turno.updateMany({
      where: {
        idTurno,
        estado: 'CANCELADO',
        OR: [
          { estadoNotificacionCancelacion: 'PENDIENTE' },
          { estadoNotificacionCancelacion: 'FALLIDA' },
          { estadoNotificacionCancelacion: null },
          {
            estadoNotificacionCancelacion: 'PROCESANDO',
            notificacionCancelacionIntentadaAt: { lt: tiempoExpiracionStale },
          },
        ],
      },
      data: {
        estadoNotificacionCancelacion: 'PROCESANDO',
        notificacionCancelacionIntentadaAt: ahora,
      },
    })

    if (claimResult.count !== 1) {
      const turnoRefresco = await prisma.turno.findUnique({ where: { idTurno } })
      if (turnoRefresco?.estadoNotificacionCancelacion === 'ENVIADA') {
        throw errorConEstado(
          'La notificación para este turno ya fue enviada exitosamente.',
          409,
          'NOTIFICATION_ALREADY_SENT'
        )
      }
      throw errorConEstado(
        'Ya existe un proceso de notificación en curso para este turno. Por favor espere.',
        409,
        'NOTIFICATION_IN_PROGRESS'
      )
    }

    // 3. Preparación de datos para el envío de correo
    const fechaTextoLegible = formatearFechaArgentina(turno.fecha)
    const datosEmail: DatosAvisoCancelacionEmail = {
      email: turno.paciente.email,
      pacienteNombre: `${turno.paciente.nombre} ${turno.paciente.apellido}`.trim(),
      medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`.trim(),
      especialidad: turno.medico.especialidad,
      fecha: fechaTextoLegible,
      hora: turno.hora,
    }

    // 4. Invocación al servicio de correo
    const resultadoEnvio = await EmailService.enviarAvisoCancelacionAdministrativa(datosEmail)

    if (resultadoEnvio.ok) {
      const enviadoAt = new Date()
      await prisma.turno.update({
        where: { idTurno },
        data: {
          estadoNotificacionCancelacion: 'ENVIADA',
          notificacionCancelacionEnviadaAt: enviadoAt,
        },
      })

      return {
        success: true,
        message: 'Aviso de cancelación enviado al paciente exitosamente.',
        notificacion: {
          estado: 'ENVIADA',
          enviadaAt: enviadoAt.toISOString(),
          destinatario: turno.paciente.email,
        },
      }
    }

    // 5. Fallo en el envío: registrar estado FALLIDA y habilitar reintento
    await prisma.turno.update({
      where: { idTurno },
      data: {
        estadoNotificacionCancelacion: 'FALLIDA',
      },
    })

    const statusCode = resultadoEnvio.esErrorTransitorio ? 502 : 400
    throw errorConEstado(
      `No se pudo enviar el correo de notificación: ${resultadoEnvio.error || 'Fallo del servicio de correo'}.`,
      statusCode,
      'EMAIL_DELIVERY_FAILED'
    )
  }
}
