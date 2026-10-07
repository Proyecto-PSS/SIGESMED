// Confirma un turno disponible asociándolo al paciente autenticado.
import { prisma } from '@/lib/prisma'

export async function confirmarTurno(idTurno: string, idPaciente: string) {
  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.turno.updateMany({
      where: {
        idTurno,
        estado: 'DISPONIBLE',
        idPaciente: null,
      },
      data: {
        idPaciente,
        estado: 'CONFIRMADO',
        modalidad: 'PARTICULAR',
      },
    })

    if (actualizado.count !== 1) {
      const error = new Error('El turno ya no está disponible')
      ;(error as Error & { statusCode?: number }).statusCode = 409
      throw error
    }

    return tx.turno.findUniqueOrThrow({
      where: { idTurno },
      include: { medico: true, paciente: true },
    })
  })
}
