import { prisma } from '../prisma'
import {
  DiaSemana,
  DuracionTurno,
  DisponibilidadMedica,
  Turno,
  ResumenPublicacion,
} from '../types/agenda'
import {
  NOMBRES_DIAS,
  DIAS_ABREVIADOS,
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  validarFormatoMes,
} from '../utils/agenda-utils'

export {
  NOMBRES_DIAS,
  DIAS_ABREVIADOS,
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  validarFormatoMes,
}

function mesAFecha(mes: string): Date {
  const [year, month] = mes.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

function fechaAString(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

function mapDisponibilidad(row: {
  idDisponibilidadMedica: string
  idMedico: string
  mesVigencia: Date
  diaSemana: number
  horaDesde: string
  horaHasta: string
  duracionTurnoMinutos: number
  createdAt: Date
  updatedAt: Date
}): DisponibilidadMedica {
  const duracion = row.duracionTurnoMinutos as DuracionTurno
  return {
    id: row.idDisponibilidadMedica,
    id_medico: row.idMedico,
    mes_vigencia: row.mesVigencia.toISOString().slice(0, 7),
    dia_semana: row.diaSemana as DiaSemana,
    hora_desde: row.horaDesde,
    hora_hasta: row.horaHasta,
    duracion_turno_minutos: duracion,
    cantidad_turnos: calcularTurnosPosibles(row.horaDesde, row.horaHasta, duracion).total,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

function mapTurno(row: {
  idTurno: string
  idMedico: string
  idPaciente: string | null
  fecha: Date
  hora: string
  duracionMinutos: number
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'ATENDIDO'
  modalidad: 'PARTICULAR' | 'COBERTURA' | null
  motivoCancelacion: string | null
  createdAt: Date
}): Turno {
  return {
    id: row.idTurno,
    id_medico: row.idMedico,
    id_paciente: row.idPaciente,
    fecha_hora: `${fechaAString(row.fecha)}T${row.hora}:00`,
    duracion_minutos: row.duracionMinutos,
    estado: row.estado,
    modalidad: row.modalidad,
    motivo_cancelacion: row.motivoCancelacion,
    created_at: row.createdAt.toISOString(),
  }
}

function validarYGenerarTurnos(
  idMedico: string,
  idDisponibilidadMedica: string,
  mes: string,
  diaSemana: DiaSemana,
  horaDesde: string,
  horaHasta: string,
  duracion: DuracionTurno
) {
  const { slots } = calcularTurnosPosibles(horaDesde, horaHasta, duracion)
  return obtenerFechasDelMesParaDia(mes, diaSemana).flatMap((fecha) =>
    slots.map((hora) => ({
      idMedico,
      idDisponibilidadMedica,
      fecha: new Date(`${fecha}T00:00:00.000Z`),
      hora,
      duracionMinutos: duracion,
      estado: 'DISPONIBLE' as const,
    }))
  )
}

/** Servicio de disponibilidad y agenda mensual, persistido en Neon mediante Prisma. */
export class AgendaService {
  static async obtenerDisponibilidades(
    id_medico: string,
    mes_vigencia: string
  ): Promise<DisponibilidadMedica[]> {
    if (!validarFormatoMes(mes_vigencia)) {
      throw new Error('Formato de mes inválido. Debe ser YYYY-MM (ej: 2024-11)')
    }

    const rows = await prisma.disponibilidadMedica.findMany({
      where: { idMedico: id_medico, mesVigencia: mesAFecha(mes_vigencia) },
      orderBy: { diaSemana: 'asc' },
    })
    return rows.map(mapDisponibilidad)
  }

  /** Guarda la regla y genera sus turnos disponibles en la misma operación. */
  static async guardarDisponibilidad(
    id_medico: string,
    data: {
      mes_vigencia: string
      dia_semana: DiaSemana
      hora_desde: string
      hora_hasta: string
      duracion_turno_minutos: DuracionTurno
    }
  ): Promise<{ disponibilidad: DisponibilidadMedica; esNueva: boolean; turnosGenerados: number }> {
    const { mes_vigencia, dia_semana, hora_desde, hora_hasta, duracion_turno_minutos } = data

    if (!validarFormatoMes(mes_vigencia)) throw new Error('Formato de mes inválido. Debe ser YYYY-MM')
    if (![1, 2, 3, 4, 5, 6].includes(dia_semana)) {
      throw new Error('Día de la semana inválido. Debe ser de Lunes (1) a Sábado (6)')
    }
    if (![20, 30, 45].includes(duracion_turno_minutos)) {
      throw new Error('Duración de turno inválida. Solo se permite 20, 30 o 45 minutos')
    }

    const { total } = calcularTurnosPosibles(hora_desde, hora_hasta, duracion_turno_minutos)
    if (total <= 0) {
      throw new Error('El horario debe permitir al menos un turno y la hora de inicio debe ser menor a la hora de fin')
    }

    const mes = mesAFecha(mes_vigencia)
    return prisma.$transaction(async (tx) => {
      const existentesMes = await tx.disponibilidadMedica.findMany({
        where: { idMedico: id_medico, mesVigencia: mes },
      })
      const existente = existentesMes.find((row) => row.diaSemana === dia_semana)

      if (!existente && existentesMes.length >= 2) {
        throw new Error('Regla de negocio: Un médico puede configurar un máximo de 2 días de atención por semana.')
      }

      if (existente) {
        const turnoReservado = await tx.turno.findFirst({
          where: {
            idDisponibilidadMedica: existente.idDisponibilidadMedica,
            estado: { not: 'DISPONIBLE' },
          },
          select: { idTurno: true },
        })
        if (turnoReservado) {
          throw new Error('No se puede modificar la franja porque ya tiene turnos reservados o atendidos.')
        }

        await tx.turno.deleteMany({ where: { idDisponibilidadMedica: existente.idDisponibilidadMedica } })
      }

      const disponibilidad = existente
        ? await tx.disponibilidadMedica.update({
            where: { idDisponibilidadMedica: existente.idDisponibilidadMedica },
            data: {
              horaDesde: hora_desde,
              horaHasta: hora_hasta,
              duracionTurnoMinutos: duracion_turno_minutos,
            },
          })
        : await tx.disponibilidadMedica.create({
            data: {
              idMedico: id_medico,
              mesVigencia: mes,
              diaSemana: dia_semana,
              horaDesde: hora_desde,
              horaHasta: hora_hasta,
              duracionTurnoMinutos: duracion_turno_minutos,
            },
          })

      const nuevosTurnos = validarYGenerarTurnos(
        id_medico,
        disponibilidad.idDisponibilidadMedica,
        mes_vigencia,
        dia_semana,
        hora_desde,
        hora_hasta,
        duracion_turno_minutos
      )
      if (nuevosTurnos.length) await tx.turno.createMany({ data: nuevosTurnos, skipDuplicates: true })

      return {
        disponibilidad: mapDisponibilidad(disponibilidad),
        esNueva: !existente,
        turnosGenerados: nuevosTurnos.length,
      }
    })
  }

  static async eliminarDisponibilidad(id_medico: string, id: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.disponibilidadMedica.findFirst({
        where: { idDisponibilidadMedica: id, idMedico: id_medico },
      })
      if (!row) throw new Error('Configuración de disponibilidad no encontrada')

      const turnoReservado = await tx.turno.findFirst({
        where: { idDisponibilidadMedica: id, estado: { not: 'DISPONIBLE' } },
        select: { idTurno: true },
      })
      if (turnoReservado) {
        throw new Error('No se puede eliminar la franja porque ya tiene turnos reservados o atendidos.')
      }

      await tx.turno.deleteMany({ where: { idDisponibilidadMedica: id } })
      await tx.disponibilidadMedica.delete({ where: { idDisponibilidadMedica: id } })
      return true
    })
  }

  static async obtenerResumenPublicacion(
    id_medico: string,
    mes_vigencia: string
  ): Promise<ResumenPublicacion> {
    if (!validarFormatoMes(mes_vigencia)) throw new Error('Formato de mes inválido. Debe ser YYYY-MM')

    const disponibilidades = await prisma.disponibilidadMedica.findMany({
      where: { idMedico: id_medico, mesVigencia: mesAFecha(mes_vigencia) },
      orderBy: { diaSemana: 'asc' },
    })
    if (disponibilidades.length === 0) throw new Error('No hay disponibilidades configuradas para este mes.')

    let totalJornadas = 0
    let totalTurnos = 0
    const jornadasDetalle = disponibilidades.map((row) => {
      const diaSemana = row.diaSemana as DiaSemana
      const duracion = row.duracionTurnoMinutos as DuracionTurno
      const fechas = obtenerFechasDelMesParaDia(mes_vigencia, diaSemana)
      const turnosPorDia = calcularTurnosPosibles(row.horaDesde, row.horaHasta, duracion).total
      const subtotalTurnos = turnosPorDia * fechas.length
      totalJornadas += fechas.length
      totalTurnos += subtotalTurnos
      return {
        dia_semana: diaSemana,
        dia_nombre: NOMBRES_DIAS[diaSemana],
        hora_desde: row.horaDesde,
        hora_hasta: row.horaHasta,
        duracion_minutos: duracion,
        turnos_por_dia: turnosPorDia,
        ocurrencias_en_mes: fechas.length,
        subtotal_turnos: subtotalTurnos,
      }
    })

    return { mes_vigencia, total_jornadas: totalJornadas, total_turnos: totalTurnos, jornadas_detalle: jornadasDetalle }
  }

  /** Compatibilidad con el endpoint de publicación: reintenta generar cupos faltantes. */
  static async publicarAgenda(
    id_medico: string,
    mes_vigencia: string
  ): Promise<{ success: boolean; mes: string; total_jornadas: number; total_turnos: number }> {
    const resumen = await this.obtenerResumenPublicacion(id_medico, mes_vigencia)
    const mes = mesAFecha(mes_vigencia)

    return prisma.$transaction(async (tx) => {
      const disponibilidades = await tx.disponibilidadMedica.findMany({
        where: { idMedico: id_medico, mesVigencia: mes },
      })
      let turnosGenerados = 0
      for (const disponibilidad of disponibilidades) {
        const nuevos = validarYGenerarTurnos(
          id_medico,
          disponibilidad.idDisponibilidadMedica,
          mes_vigencia,
          disponibilidad.diaSemana as DiaSemana,
          disponibilidad.horaDesde,
          disponibilidad.horaHasta,
          disponibilidad.duracionTurnoMinutos as DuracionTurno
        )
        if (nuevos.length) {
          turnosGenerados += (await tx.turno.createMany({ data: nuevos, skipDuplicates: true })).count
        }
      }
      return {
        success: true,
        mes: mes_vigencia,
        total_jornadas: resumen.total_jornadas,
        total_turnos: turnosGenerados,
      }
    })
  }

  static async obtenerAgendaTurnos(
    id_medico: string,
    mes_vigencia: string,
    vista: 'mensual' | 'semanal' = 'mensual',
    fecha_referencia?: string
  ): Promise<Turno[]> {
    if (!validarFormatoMes(mes_vigencia)) throw new Error('Formato de mes inválido')

    const [year, month] = mes_vigencia.split('-').map(Number)
    const inicioMes = new Date(Date.UTC(year, month - 1, 1))
    const inicioMesSiguiente = new Date(Date.UTC(year, month, 1))
    const rows = await prisma.turno.findMany({
      where: {
        idMedico: id_medico,
        fecha: { gte: inicioMes, lt: inicioMesSiguiente },
      },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
    })

    let filtrados = rows
    if (vista === 'semanal' && fecha_referencia && /^\d{4}-\d{2}-\d{2}$/.test(fecha_referencia)) {
      const [refYear, refMonth, refDay] = fecha_referencia.split('-').map(Number)
      const referencia = new Date(Date.UTC(refYear, refMonth - 1, refDay))
      const dia = referencia.getUTCDay()
      const diferenciaAlLunes = dia === 0 ? -6 : 1 - dia
      const lunes = new Date(Date.UTC(refYear, refMonth - 1, refDay + diferenciaAlLunes))
      const lunesSiguiente = new Date(lunes)
      lunesSiguiente.setUTCDate(lunes.getUTCDate() + 7)
      filtrados = rows.filter((row) => row.fecha >= lunes && row.fecha < lunesSiguiente)
    }

    return filtrados.map(mapTurno)
  }
}
