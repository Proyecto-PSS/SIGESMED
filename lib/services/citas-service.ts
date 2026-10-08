import { prisma } from '@/lib/prisma'

export async function obtenerCitasPaciente(idPaciente: string) {
  return prisma.turno.findMany({
    where: {
      idPaciente,
      estado: 'CONFIRMADO',
    },
    include: {
      medico: true,
    },
    orderBy: [
      { fecha: 'asc' },
      { hora: 'asc' },
    ],
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

  const actualizado = await prisma.turno.updateMany({
    where: {
      idTurno,
      idPaciente,
      estado: 'CONFIRMADO',
    },
    data: {
      idPaciente: null,
      estado: 'DISPONIBLE',
      modalidad: null,
      motivoCancelacion: 'Cancelado por el paciente',
    },
  })

  if (actualizado.count !== 1) {
    const error = new Error(
      'No se pudo cancelar el turno porque su estado cambió'
    )

    ;(error as Error & { statusCode?: number }).statusCode = 409

    throw error
  }

  return prisma.turno.findUniqueOrThrow({
    where: {
      idTurno,
    },
  })
}