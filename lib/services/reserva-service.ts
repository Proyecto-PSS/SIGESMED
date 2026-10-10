// Confirma un turno disponible asociándolo al paciente autenticado con soporte de idempotencia y concurrencia (US-09 y US-18).
import { prisma } from '@/lib/prisma'

export interface OpcionesConfirmacion {
  idempotencyKey?: string
  modalidad?: 'PARTICULAR' | 'COBERTURA'
}

export interface ResultadoConfirmacion {
  turno: any
  idempotent: boolean
}

export type EstadoConsultaReserva = 'CONFIRMADO' | 'PENDIENTE' | 'RECHAZADO' | 'NO_ENCONTRADO'

export interface ResultadoConsultaEstado {
  status: EstadoConsultaReserva
  turnoId: string
  turno?: any
  message?: string
}

export async function confirmarTurno(
  idTurno: string,
  idPaciente: string,
  opciones?: OpcionesConfirmacion
): Promise<ResultadoConfirmacion> {
  const { idempotencyKey, modalidad = 'PARTICULAR' } = opciones ?? {}

  return prisma.$transaction(async (tx) => {
    // 1. Si se envía idempotencyKey, verificar si ya existe una reserva confirmada con dicha clave
    if (idempotencyKey) {
      const turnoConKey = await tx.turno.findFirst({
        where: { idempotencyKey },
        include: { medico: true, paciente: true },
      })

      if (turnoConKey) {
        // Misma operación lógica y mismo paciente -> devolver reserva existente sin duplicar
        if (turnoConKey.idTurno === idTurno && turnoConKey.idPaciente === idPaciente) {
          return {
            turno: turnoConKey,
            idempotent: true,
          }
        }

        // Si la clave de idempotencia fue reutilizada para otro turno o paciente, es un conflicto
        const err = new Error('La clave de idempotencia ya fue utilizada para otra operación')
        ;(err as Error & { statusCode?: number; code?: string }).statusCode = 409
        ;(err as Error & { statusCode?: number; code?: string }).code = 'IDEMPOTENCY_KEY_REUSED'
        throw err
      }
    }

    // 2. Verificar existencia del turno
    const turnoExistente = await tx.turno.findUnique({
      where: { idTurno },
      include: { medico: true, paciente: true },
    })

    if (!turnoExistente) {
      const err = new Error('El turno solicitado no existe')
      ;(err as Error & { statusCode?: number; code?: string }).statusCode = 404
      ;(err as Error & { statusCode?: number; code?: string }).code = 'TURN_NOT_FOUND'
      throw err
    }

    // 3. Concurrencia atómica (US-09 y US-18): actualizar el turno solo si sigue DISPONIBLE
    const actualizado = await tx.turno.updateMany({
      where: {
        idTurno,
        estado: 'DISPONIBLE',
        idPaciente: null,
      },
      data: {
        idPaciente,
        estado: 'CONFIRMADO',
        modalidad,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    })

    if (actualizado.count !== 1) {
      // 4. Si no se actualizó, verificar si fue por una condición de carrera donde otra solicitud
      // concurrente con la misma idempotencyKey y mismo paciente se confirmó un instante antes
      if (idempotencyKey) {
        const yaConfirmado = await tx.turno.findFirst({
          where: {
            idTurno,
            idPaciente,
            idempotencyKey,
          },
          include: { medico: true, paciente: true },
        })

        if (yaConfirmado) {
          return {
            turno: yaConfirmado,
            idempotent: true,
          }
        }
      }

      // Si el turno ya está confirmado por este mismo paciente pero con otra key o sin key
      if (turnoExistente.estado === 'CONFIRMADO' && turnoExistente.idPaciente === idPaciente) {
        return {
          turno: turnoExistente,
          idempotent: true,
        }
      }

      // Si no fue esta misma operación, el turno fue tomado por otro paciente o ya no está disponible
      const error = new Error('El turno ya no está disponible')
      ;(error as Error & { statusCode?: number; code?: string }).statusCode = 409
      ;(error as Error & { statusCode?: number; code?: string }).code = 'TURN_ALREADY_RESERVED'
      throw error
    }

    // 5. Reserva confirmada exitosamente
    const turno = await tx.turno.findUniqueOrThrow({
      where: { idTurno },
      include: { medico: true, paciente: true },
    })

    return {
      turno,
      idempotent: false,
    }
  })
}

export async function consultarEstadoReserva(
  idTurno: string,
  idPaciente: string,
  idempotencyKey?: string
): Promise<ResultadoConsultaEstado> {
  // 1. Si se provee idempotencyKey, buscar si existe un turno confirmado con dicha key
  if (idempotencyKey) {
    const turnoConKey = await prisma.turno.findFirst({
      where: { idempotencyKey },
      include: { medico: true, paciente: true },
    })

    if (turnoConKey) {
      if (turnoConKey.idPaciente !== idPaciente) {
        const err = new Error('No autorizado para consultar la operación de otro paciente')
        ;(err as Error & { statusCode?: number; code?: string }).statusCode = 403
        ;(err as Error & { statusCode?: number; code?: string }).code = 'FORBIDDEN'
        throw err
      }

      if (turnoConKey.idTurno === idTurno) {
        return {
          status: 'CONFIRMADO',
          turnoId: idTurno,
          turno: turnoConKey,
        }
      } else {
        return {
          status: 'RECHAZADO',
          turnoId: idTurno,
          message: 'La clave de idempotencia fue utilizada para otro turno.',
        }
      }
    }
  }

  // 2. Si no se encontró por idempotencyKey o no se proveyó, consultar directamente el estado del turno
  const turno = await prisma.turno.findUnique({
    where: { idTurno },
    include: { medico: true, paciente: true },
  })

  if (!turno) {
    return {
      status: 'NO_ENCONTRADO',
      turnoId: idTurno,
    }
  }

  if (turno.estado === 'CONFIRMADO') {
    if (turno.idPaciente === idPaciente) {
      // Si se envió idempotencyKey y no coincidió con este turno, no es esta operación lógica
      if (idempotencyKey && turno.idempotencyKey && turno.idempotencyKey !== idempotencyKey) {
        return {
          status: 'NO_ENCONTRADO',
          turnoId: idTurno,
        }
      }

      return {
        status: 'CONFIRMADO',
        turnoId: idTurno,
        turno,
      }
    } else {
      // Turno tomado por otro paciente: no exponer los datos del otro paciente
      return {
        status: 'RECHAZADO',
        turnoId: idTurno,
        message: 'El turno ya no está disponible.',
      }
    }
  }

  if (turno.estado === 'DISPONIBLE') {
    return {
      status: 'NO_ENCONTRADO',
      turnoId: idTurno,
    }
  }

  return {
    status: 'NO_ENCONTRADO',
    turnoId: idTurno,
  }
}

export async function consultarEstadoReservaPorKey(
  idempotencyKey: string,
  idPaciente: string
): Promise<ResultadoConsultaEstado> {
  const turnoConKey = await prisma.turno.findFirst({
    where: { idempotencyKey },
    include: { medico: true, paciente: true },
  })

  if (!turnoConKey) {
    return {
      status: 'NO_ENCONTRADO',
      turnoId: '',
    }
  }

  if (turnoConKey.idPaciente !== idPaciente) {
    const err = new Error('No autorizado para consultar la operación de otro paciente')
    ;(err as Error & { statusCode?: number; code?: string }).statusCode = 403
    ;(err as Error & { statusCode?: number; code?: string }).code = 'FORBIDDEN'
    throw err
  }

  if (turnoConKey.estado === 'CONFIRMADO') {
    return {
      status: 'CONFIRMADO',
      turnoId: turnoConKey.idTurno,
      turno: turnoConKey,
    }
  }

  return {
    status: 'NO_ENCONTRADO',
    turnoId: turnoConKey.idTurno,
  }
}
