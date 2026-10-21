import { prisma } from '@/lib/prisma'
import { RecordatoriosService } from '@/lib/services/recordatorios-service'

export async function obtenerCitasPaciente(idPaciente: string) {
  return prisma.turno.findMany({
    where: {
      idPaciente,
      estado: 'CONFIRMADO',
    },
    include: {
      medico: true,
      pagos: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { fecha: 'asc' },
      { hora: 'asc' },
    ],
  })
}

export async function obtenerHistorialTurnosPaciente(idPaciente: string) {
  return prisma.turno.findMany({
    where: { idPaciente },
    include: {
      medico: {
        select: {
          nombre: true,
          apellido: true,
          especialidad: true,
        },
      },
    },
    orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],
  })
}

function obtenerFechaTurno(fecha: Date, hora: string) {
  const fechaTexto = fecha.toISOString().slice(0, 10)

  const [anio, mes, dia] = fechaTexto
    .split('-')
    .map(Number)

  const [horas, minutos] = hora
    .split(':')
    .map(Number)

  // Argentina utiliza UTC-3.
  // Convertimos la fecha/hora del turno a un instante real.
  return new Date(
    Date.UTC(anio, mes - 1, dia, horas, minutos) +
      3 * 60 * 60 * 1000
  )
}

export async function cancelarCitaPaciente(
  idTurno: string,
  idPaciente: string
) {
  const turno = await prisma.turno.findFirst({
    where: {
      idTurno,
      idPaciente,
      estado: 'CONFIRMADO',
    },
  })

  if (!turno) {
    // Si no está confirmado con idPaciente, verificar si ya fue cancelado previamente por este paciente
    const turnoExistente = await prisma.turno.findUnique({
      where: { idTurno },
    })

    if (!turnoExistente) {
      const error = new Error('No se encontró el turno')
      ;(error as Error & { statusCode?: number }).statusCode = 404
      throw error
    }

    if (
      turnoExistente.idPaciente === idPaciente &&
      turnoExistente.estado === 'CANCELADO' &&
      turnoExistente.motivoCancelacion === 'Cancelado por el paciente'
    ) {
      return turnoExistente
    }

    const error = new Error(
      'No se encontró el turno o ya no está confirmado'
    )
    ;(error as Error & { statusCode?: number }).statusCode = 404
    throw error
  }

  const fechaTurno = obtenerFechaTurno(
    turno.fecha,
    turno.hora
  )

  const ahora = new Date()

  const diferenciaMilisegundos =
    fechaTurno.getTime() - ahora.getTime()

  const horasRestantes =
    diferenciaMilisegundos / (1000 * 60 * 60)

  if (horasRestantes <= 48) {
    const error = new Error(
      'No se puede cancelar el turno porque faltan 48 horas o menos'
    )
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }

  const turnoCancelado = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.turno.updateMany({
      where: {
        idTurno,
        idPaciente,
        estado: 'CONFIRMADO',
      },
      data: {
        estado: 'CANCELADO',
        motivoCancelacion: 'Cancelado por el paciente',
        idempotencyKey: null,
      },
    })

    if (actualizado.count !== 1) {
      return null
    }

    // El turno cancelado queda como historial; una fila nueva libera el horario.
    await tx.turno.create({
      data: {
        idMedico: turno.idMedico,
        idDisponibilidadMedica: turno.idDisponibilidadMedica,
        fecha: turno.fecha,
        hora: turno.hora,
        duracionMinutos: turno.duracionMinutos,
        estado: 'DISPONIBLE',
      },
    })

    return tx.turno.findUniqueOrThrow({ where: { idTurno } })
  })

  if (turnoCancelado) {
    // US-15: Cancelar recordatorios pendientes asociados al turno cancelado
    try {
      await RecordatoriosService.cancelarRecordatoriosTurno(
        idTurno,
        'Cancelado por el paciente'
      )
    } catch (err) {
      console.error(
        '[CITAS-SERVICE] Error no bloqueante al cancelar recordatorios:',
        err
      )
    }
  }

  if (!turnoCancelado) {
    const turnoRevisado = await prisma.turno.findUnique({
      where: { idTurno },
    })

    if (
      turnoRevisado &&
      turnoRevisado.idPaciente === idPaciente &&
      turnoRevisado.estado === 'CANCELADO' &&
      turnoRevisado.motivoCancelacion === 'Cancelado por el paciente'
    ) {
      return turnoRevisado
    }

    const error = new Error(
      'No se pudo cancelar el turno porque su estado cambió'
    )
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }

  return turnoCancelado
}
