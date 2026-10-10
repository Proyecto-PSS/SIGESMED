import { prisma } from '../prisma'
import { EmailService } from './email-service'
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
  getMesActual,
  esMesPasado,
} from '../utils/agenda-utils'

export {
  NOMBRES_DIAS,
  DIAS_ABREVIADOS,
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  validarFormatoMes,
  getMesActual,
  esMesPasado,
}

function pastMonthError() {
  const err = new Error('No se puede configurar disponibilidad para meses anteriores al actual.') as any
  err.statusCode = 400
  err.code = 'PAST_MONTH_NOT_ALLOWED'
  return err
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

  private static verificarAnticipacion48hs(fechas: string[], horaDesde: string) {
    const ahora = new Date()
    const limite = new Date(ahora.getTime() + 48 * 60 * 60 * 1000)

    for (const fecha of fechas) {
      const instanteStr = `${fecha}T${horaDesde}:00-03:00`
      const instante = new Date(instanteStr)
      
      // Ignorar fechas que ya pasaron
      if (instante < ahora) {
        continue
      }
      
      // Si la fecha es en el futuro pero menor a 48 horas
      if (instante < limite) {
        const err = new Error('No se pueden modificar los horarios de atención con menos de 48 horas de anticipación') as any
        err.statusCode = 409
        throw err
      }
    }
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
    if (esMesPasado(mes_vigencia)) throw pastMonthError()
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

      let turnosCanceladosInfo: { pacienteEmail: string, pacienteNombre: string, fechaHora: string, medicoNombre: string }[] = []

      if (existente) {
        // Reconciliación de turnos (RF-05)
        const turnosExistentes = await tx.turno.findMany({
          where: { idDisponibilidadMedica: existente.idDisponibilidadMedica },
          include: { paciente: true, medico: true }
        })

        const turnosProyectados = validarYGenerarTurnos(
          id_medico,
          existente.idDisponibilidadMedica,
          mes_vigencia,
          dia_semana,
          hora_desde,
          hora_hasta,
          duracion_turno_minutos
        )

        const fechaAStringLocal = (d: Date) => d.toISOString().slice(0, 10)
        const setProyectados = new Set(turnosProyectados.map(t => `${fechaAStringLocal(t.fecha)}_${t.hora}`))
        const setExistentes = new Set(turnosExistentes.map(t => `${fechaAStringLocal(t.fecha)}_${t.hora}`))

        const turnosARemover = turnosExistentes.filter(t => !setProyectados.has(`${fechaAStringLocal(t.fecha)}_${t.hora}`))
        const turnosAAgregar = turnosProyectados.filter(t => !setExistentes.has(`${fechaAStringLocal(t.fecha)}_${t.hora}`))

        const ahora = new Date()
        const limite = new Date(ahora.getTime() + 48 * 60 * 60 * 1000)

        // Validar 48hs solo en los que cambian (RF-04)
        const validar48hs = (fecha: Date, hora: string) => {
          const instanteStr = `${fechaAStringLocal(fecha)}T${hora}:00-03:00`
          const instante = new Date(instanteStr)
          if (instante > ahora && instante < limite) {
            const err = new Error('No se pueden modificar los horarios de atención con menos de 48 horas de anticipación') as any
            err.statusCode = 409
            throw err
          }
        }

        for (const t of turnosARemover) validar48hs(t.fecha, t.hora)
        for (const t of turnosAAgregar) validar48hs(t.fecha, t.hora)

        // Aplicar cambios a turnos existentes (RF-06)
        for (const t of turnosARemover) {
          if (t.estado === 'CONFIRMADO') {
            await tx.turno.update({
              where: { idTurno: t.idTurno },
              data: { estado: 'CANCELADO', motivoCancelacion: 'Modificación de horario de atención' }
            })
            if (t.paciente) {
              turnosCanceladosInfo.push({
                pacienteEmail: t.paciente.email,
                pacienteNombre: `${t.paciente.nombre} ${t.paciente.apellido}`,
                fechaHora: `${fechaAStringLocal(t.fecha)} ${t.hora}`,
                medicoNombre: `${t.medico.nombre} ${t.medico.apellido}`
              })
            }
          } else if (t.estado === 'DISPONIBLE') {
            await tx.turno.delete({ where: { idTurno: t.idTurno } })
          }
          // Turnos CANCELADO o ATENDIDO se mantienen por historial
        }

        const disponibilidad = await tx.disponibilidadMedica.update({
          where: { idDisponibilidadMedica: existente.idDisponibilidadMedica },
          data: { horaDesde: hora_desde, horaHasta: hora_hasta, duracionTurnoMinutos: duracion_turno_minutos },
        })

        if (turnosAAgregar.length > 0) {
          await tx.turno.createMany({ data: turnosAAgregar, skipDuplicates: true })
        }

        return {
          disponibilidad: mapDisponibilidad(disponibilidad),
          esNueva: false,
          turnosGenerados: turnosAAgregar.length,
          turnosCanceladosInfo
        }

      } else {
        // Disponibilidad nueva
        const fechasNuevas = obtenerFechasDelMesParaDia(mes_vigencia, dia_semana)
        AgendaService.verificarAnticipacion48hs(fechasNuevas, hora_desde)
        
        const disponibilidad = await tx.disponibilidadMedica.create({
          data: { idMedico: id_medico, mesVigencia: mes, diaSemana: dia_semana, horaDesde: hora_desde, horaHasta: hora_hasta, duracionTurnoMinutos: duracion_turno_minutos },
        })
        
        const nuevosTurnos = validarYGenerarTurnos(id_medico, disponibilidad.idDisponibilidadMedica, mes_vigencia, dia_semana, hora_desde, hora_hasta, duracion_turno_minutos)
        if (nuevosTurnos.length > 0) await tx.turno.createMany({ data: nuevosTurnos, skipDuplicates: true })

        return {
          disponibilidad: mapDisponibilidad(disponibilidad),
          esNueva: true,
          turnosGenerados: nuevosTurnos.length,
          turnosCanceladosInfo: []
        }
      }
    })
  }

  static async guardarDisponibilidadConEmails(
    id_medico: string,
    data: any
  ) {
    const resultado = await this.guardarDisponibilidad(id_medico, data)
    
    // Simular el envío de correos de manera asíncrona pero esperando a que terminen para no ser abortados por Next.js
    if (resultado.turnosCanceladosInfo && resultado.turnosCanceladosInfo.length > 0) {
      await Promise.all(resultado.turnosCanceladosInfo.map(info => 
        EmailService.enviarNotificacionCancelacion(
          info.pacienteEmail,
          info.pacienteNombre,
          info.fechaHora,
          info.medicoNombre,
          'Modificación de horario de atención'
        ).catch(err => console.error('Error al enviar email', err))
      ))
    }
    
    return {
      disponibilidad: resultado.disponibilidad,
      esNueva: resultado.esNueva,
      turnosGenerados: resultado.turnosGenerados,
      turnosCancelados: resultado.turnosCanceladosInfo ? resultado.turnosCanceladosInfo.length : 0
    }
  }

  static async eliminarDisponibilidad(id_medico: string, id: string): Promise<{ turnosCancelados: number }> {
    const turnosCanceladosInfo: { pacienteEmail: string, pacienteNombre: string, fechaHora: string, medicoNombre: string }[] = []
    
    await prisma.$transaction(async (tx) => {
      const row = await tx.disponibilidadMedica.findFirst({
        where: { idDisponibilidadMedica: id, idMedico: id_medico },
      })
      if (!row) {
        // Si no existe, es probable que ya se haya eliminado en una petición concurrente. Ignoramos silenciosamente.
        return
      }

      const mesVigenciaStr = row.mesVigencia.toISOString().slice(0, 7)
      if (esMesPasado(mesVigenciaStr)) {
        throw pastMonthError()
      }

      const fechas = obtenerFechasDelMesParaDia(mesVigenciaStr, row.diaSemana as DiaSemana)
      AgendaService.verificarAnticipacion48hs(fechas, row.horaDesde)

      const turnosConfirmados = await tx.turno.findMany({
        where: { idDisponibilidadMedica: id, estado: 'CONFIRMADO' },
        include: { paciente: true, medico: true }
      })

      for (const t of turnosConfirmados) {
        if (t.paciente) {
          turnosCanceladosInfo.push({
            pacienteEmail: t.paciente.email,
            pacienteNombre: `${t.paciente.nombre} ${t.paciente.apellido}`,
            fechaHora: `${fechaAString(t.fecha)} ${t.hora}`,
            medicoNombre: `${t.medico.nombre} ${t.medico.apellido}`
          })
        }
      }

      await tx.turno.deleteMany({ where: { idDisponibilidadMedica: id } })
      await tx.disponibilidadMedica.deleteMany({ where: { idDisponibilidadMedica: id } })
    })

    if (turnosCanceladosInfo.length > 0) {
      await Promise.all(turnosCanceladosInfo.map(info => 
        EmailService.enviarNotificacionCancelacion(
          info.pacienteEmail,
          info.pacienteNombre,
          info.fechaHora,
          info.medicoNombre,
          'Baja de horario de atención'
        ).catch(err => console.error('Error al enviar email', err))
      ))
    }

    return { turnosCancelados: turnosCanceladosInfo.length }
  }

  static async obtenerResumenPublicacion(
    id_medico: string,
    mes_vigencia: string
  ): Promise<ResumenPublicacion> {
    if (!validarFormatoMes(mes_vigencia)) throw new Error('Formato de mes inválido. Debe ser YYYY-MM')
    if (esMesPasado(mes_vigencia)) throw pastMonthError()

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
    if (!validarFormatoMes(mes_vigencia)) throw new Error('Formato de mes inválido. Debe ser YYYY-MM')
    if (esMesPasado(mes_vigencia)) throw pastMonthError()
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
