// Consultas de médicos y turnos disponibles para el flujo de reserva del paciente.
import { prisma } from '@/lib/prisma'

export const especialidades = [
  { value: 'TODAS', label: 'Todos' },
  { value: 'PEDIATRIA', label: 'Pediatría' },
  { value: 'TRAUMATOLOGIA_ORTOPEDIA', label: 'Traumatología' },
  { value: 'CLINICA_MEDICA', label: 'Clínica Médica' },
] as const

export type EspecialidadFiltro = (typeof especialidades)[number]['value']

function limiteReserva() {
  const limite = new Date()
  limite.setUTCMonth(limite.getUTCMonth() + 12)
  return limite
}

export async function obtenerMedicosParaReserva(especialidad?: EspecialidadFiltro) {
  const medicos = await prisma.medico.findMany({
    where: especialidad && especialidad !== 'TODAS' ? { especialidad } : undefined,
    include: {
      turnos: {
        where: {
          estado: 'DISPONIBLE',
          fecha: { gte: new Date(), lt: limiteReserva() },
        },
        orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
        take: 1,
      },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })

  return medicos.map(({ turnos, ...medico }) => ({
    ...medico,
    proximoTurno: turnos[0] ?? null,
  }))
}

export async function obtenerMedicoConTurnosDisponibles(idMedico: string) {
  return prisma.medico.findUnique({
    where: { idMedico },
    include: {
      turnos: {
        where: {
          fecha: { gte: new Date(), lt: limiteReserva() },
        },
        orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
      },
    },
  })
}
