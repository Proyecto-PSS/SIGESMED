import { prisma } from '@/lib/prisma'

const seleccionResumenMedico = {
  idMedico: true,
  nombre: true,
  apellido: true,
  especialidad: true,
  consultorio: true,
  direccion: true,
} as const

export function listarMedicos() {
  return prisma.medico.findMany({
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: seleccionResumenMedico,
  })
}

export async function obtenerMedico(idMedico: string) {
  return prisma.medico.findUnique({
    where: { idMedico },
    select: seleccionResumenMedico,
  })
}
