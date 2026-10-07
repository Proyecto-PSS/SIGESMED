import { prisma } from '@/lib/prisma'

const FORMATO_MES = /^(\d{4})-(\d{2})$/
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

function fechaHoyArgentina(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function fechaUTC(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`)
}

function validarMes(mes?: string): string | undefined {
  if (!mes) return undefined
  const coincidencia = FORMATO_MES.exec(mes)
  if (!coincidencia) return undefined
  const numeroMes = Number(coincidencia[2])
  return numeroMes >= 1 && numeroMes <= 12 ? mes : undefined
}

export type DiaConDisponibilidad = {
  fecha: string
  disponibles: number
}

export async function obtenerHorariosDisponibles(
  idMedico: string,
  mesSolicitado?: string,
  fechaSolicitada?: string
) {
  const hoy = fechaHoyArgentina()
  const mes = validarMes(mesSolicitado) ?? hoy.slice(0, 7)
  const [year, month] = mes.split('-').map(Number)
  const inicioMes = new Date(Date.UTC(year, month - 1, 1))
  const finMes = new Date(Date.UTC(year, month, 1))
  const inicioHoy = fechaUTC(hoy)
  const inicioConsulta = inicioHoy > inicioMes ? inicioHoy : inicioMes

  const turnos = inicioConsulta < finMes
    ? await prisma.turno.findMany({
        where: { idMedico, fecha: { gte: inicioConsulta, lt: finMes } },
        select: { idTurno: true, fecha: true, hora: true, duracionMinutos: true, estado: true },
        orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
      })
    : []

  const turnosPorFecha = new Map<string, typeof turnos>()
  for (const turno of turnos) {
    const fecha = turno.fecha.toISOString().slice(0, 10)
    const turnosDelDia = turnosPorFecha.get(fecha) ?? []
    turnosDelDia.push(turno)
    turnosPorFecha.set(fecha, turnosDelDia)
  }

  const dias: DiaConDisponibilidad[] = [...turnosPorFecha].map(([fecha, turnosDelDia]) => ({
    fecha,
    disponibles: turnosDelDia.filter((turno) => turno.estado === 'DISPONIBLE').length,
  }))

  const fecha = fechaSolicitada && FORMATO_FECHA.test(fechaSolicitada) && fechaSolicitada.startsWith(`${mes}-`)
    ? fechaSolicitada
    : undefined
  const turnosDelDia = fecha ? turnosPorFecha.get(fecha) ?? [] : []
  const horariosDisponibles = turnosDelDia.filter((turno) => turno.estado === 'DISPONIBLE')

  return {
    mes,
    fecha,
    dias,
    horariosManana: horariosDisponibles.filter((turno) => Number(turno.hora.slice(0, 2)) < 12),
    horariosTarde: horariosDisponibles.filter((turno) => Number(turno.hora.slice(0, 2)) >= 12),
    duracionTurno: horariosDisponibles[0]?.duracionMinutos,
    hayTurnosEnDia: Boolean(fecha && turnosPorFecha.has(fecha)),
  }
}
