import { prisma } from '@/lib/prisma'
import { RecordatoriosService } from '@/lib/services/recordatorios-service'
import { EstadoTurno } from '@/lib/generated/prisma/enums'

const ESTADOS_HISTORIAL = [
  EstadoTurno.CONFIRMADO,
  EstadoTurno.ATENDIDO,
  EstadoTurno.AUSENTE,
  EstadoTurno.CANCELADO,
] as const

export type FiltrosHistorialTurnos = {
  estado?: string
  desde?: string
  hasta?: string
}

function parsearFechaFiltro(valor: string | undefined, etiqueta: string) {
  if (!valor) return undefined

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error(`La fecha "${etiqueta}" no es válida.`)
  }

  const fecha = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new Error(`La fecha "${etiqueta}" no es válida.`)
  }

  return fecha
}

export async function obtenerCitasPaciente(idPaciente: string) {
  return prisma.turno.findMany({
    where: {
      idPaciente,
      estado: 'CONFIRMADO',
    },
    include: {
      medico: true,
      pagos: {
        include: { comprobante: true },
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

export async function obtenerHistorialTurnosPaciente(
  idPaciente: string,
  filtros: FiltrosHistorialTurnos = {},
  ordenar: 'reciente' | 'antiguo' = 'reciente'
) {
  let estado: EstadoTurno | undefined
  if (filtros.estado) {
    if (!ESTADOS_HISTORIAL.includes(filtros.estado as (typeof ESTADOS_HISTORIAL)[number])) {
      throw new Error('El estado seleccionado no es válido.')
    }
    estado = filtros.estado as EstadoTurno
  }

  const desde = parsearFechaFiltro(filtros.desde, 'desde')
  const hasta = parsearFechaFiltro(filtros.hasta, 'hasta')
  if (desde && hasta && desde > hasta) {
    throw new Error('La fecha "desde" no puede ser posterior a la fecha "hasta".')
  }

  const fecha = desde || hasta
    ? {
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lte: hasta } : {}),
      }
    : undefined

  const limiteAntiguedad = new Date()
  limiteAntiguedad.setUTCMonth(limiteAntiguedad.getUTCMonth() - 6)
  limiteAntiguedad.setUTCHours(0, 0, 0, 0)

  return prisma.turno.findMany({
    where: {
      idPaciente,
      ...(estado ? { estado } : {}),
      fecha: { gte: fecha?.gte && fecha.gte > limiteAntiguedad ? fecha.gte : limiteAntiguedad, ...(fecha?.lte ? { lte: fecha.lte } : {}) },
    },
    include: {
      medico: {
        select: {
          nombre: true,
          apellido: true,
          especialidad: true,
        },
      },
      pagos: { where: { estado: 'APROBADO' }, include: { comprobante: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ fecha: ordenar === 'reciente' ? 'desc' : 'asc' }, { hora: ordenar === 'reciente' ? 'desc' : 'asc' }],
  })
}

export async function contarEstadosHistorialTurnos(idPaciente: string, filtros: FiltrosHistorialTurnos = {}) {
  const limite = new Date()
  limite.setUTCMonth(limite.getUTCMonth() - 6)
  limite.setUTCHours(0, 0, 0, 0)
  const desde = parsearFechaFiltro(filtros.desde, 'desde')
  const hasta = parsearFechaFiltro(filtros.hasta, 'hasta')
  if (desde && hasta && desde > hasta) throw new Error('La fecha "desde" no puede ser posterior a la fecha "hasta".')
  const fechaGte = desde && desde > limite ? desde : limite
  const grupos = await prisma.turno.groupBy({
    by: ['estado'],
    where: { idPaciente, fecha: { gte: fechaGte, ...(hasta ? { lte: hasta } : {}) } },
    _count: { _all: true },
  })
  return Object.fromEntries(
    grupos
      .filter((grupo) => ESTADOS_HISTORIAL.includes(grupo.estado as (typeof ESTADOS_HISTORIAL)[number]))
      .map((grupo) => [grupo.estado, grupo._count._all])
  ) as Partial<Record<EstadoTurno, number>>
}

export async function marcarTurnoAusente(idTurno: string, usuario: { id: string; rol: 'MEDICO' | 'ADMIN' }) {
  const turno = await prisma.turno.findUnique({ where: { idTurno } })
  if (!turno) throw Object.assign(new Error('No se encontró el turno.'), { statusCode: 404 })
  if (usuario.rol === 'MEDICO' && turno.idMedico !== usuario.id) {
    throw Object.assign(new Error('Solo puede registrar ausencias en sus propios turnos.'), { statusCode: 403 })
  }
  if (turno.estado !== 'CONFIRMADO' || !turno.idPaciente) {
    throw Object.assign(new Error('Solo se pueden marcar como ausentes los turnos reservados.'), { statusCode: 409 })
  }

  const [anio, mes, dia] = turno.fecha.toISOString().slice(0, 10).split('-').map(Number)
  const [hora, minutos] = turno.hora.split(':').map(Number)
  const finTurno = new Date(Date.UTC(anio, mes - 1, dia, hora, minutos) + (turno.duracionMinutos + 180) * 60_000)
  if (new Date() < finTurno) {
    throw Object.assign(new Error('El turno solo puede marcarse ausente después de su horario.'), { statusCode: 409 })
  }

  const actualizado = await prisma.turno.updateMany({
    where: { idTurno, estado: 'CONFIRMADO', idPaciente: turno.idPaciente },
    data: {
      estado: 'AUSENTE',
      ausenciaRegistradaPorId: usuario.id,
      ausenciaRegistradaPorRol: usuario.rol,
      ausenciaRegistradaAt: new Date(),
    },
  })
  if (!actualizado.count) throw Object.assign(new Error('El estado del turno cambió. Actualizá la agenda e intentá de nuevo.'), { statusCode: 409 })
  return prisma.turno.findUniqueOrThrow({ where: { idTurno } })
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
