import { readDb, writeDb } from '../db'
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

// Re-exportar utilidades para compatibilidad
export {
  NOMBRES_DIAS,
  DIAS_ABREVIADOS,
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  validarFormatoMes,
}

/**
 * Servicio centralizado de Disponibilidad Médica y Agenda (US-03, US-04, US-05)
 */
export class AgendaService {
  /**
   * Obtiene las disponibilidades de un médico para un mes determinado.
   */
  static async obtenerDisponibilidades(
    id_medico: string,
    mes_vigencia: string
  ): Promise<DisponibilidadMedica[]> {
    if (!validarFormatoMes(mes_vigencia)) {
      throw new Error('Formato de mes inválido. Debe ser YYYY-MM (ej: 2024-11)')
    }

    const db = readDb()
    return db.disponibilidades.filter(
      (d) => d.id_medico === id_medico && d.mes_vigencia === mes_vigencia
    )
  }

  /**
   * Guarda o actualiza una disponibilidad en estado BORRADOR (US-03).
   * Aplica la regla crítica de negocio: Máximo 2 días de atención por semana.
   */
  static async guardarDisponibilidad(
    id_medico: string,
    data: {
      mes_vigencia: string
      dia_semana: DiaSemana
      hora_desde: string
      hora_hasta: string
      duracion_turno_minutos: DuracionTurno
    }
  ): Promise<{ disponibilidad: DisponibilidadMedica; esNueva: boolean }> {
    const { mes_vigencia, dia_semana, hora_desde, hora_hasta, duracion_turno_minutos } = data

    if (!validarFormatoMes(mes_vigencia)) {
      throw new Error('Formato de mes inválido. Debe ser YYYY-MM')
    }

    if (![1, 2, 3, 4, 5, 6].includes(dia_semana)) {
      throw new Error('Día de la semana inválido. Debe ser de Lunes (1) a Sábado (6)')
    }

    if (![20, 30, 45].includes(duracion_turno_minutos)) {
      throw new Error('Duración de turno inválida. Solo se permite 20, 30 o 45 minutos')
    }

    const { total } = calcularTurnosPosibles(
      hora_desde,
      hora_hasta,
      duracion_turno_minutos
    )

    if (total <= 0) {
      throw new Error(
        'El horario es inválido: la hora de inicio debe ser menor a la hora de fin y debe permitir al menos 1 turno'
      )
    }

    const db = readDb()

    // Comprobar disponibilidades existentes para este médico y mes
    const existentesMes = db.disponibilidades.filter(
      (d) => d.id_medico === id_medico && d.mes_vigencia === mes_vigencia
    )

    // Buscar si ya existe una configuración para el mismo día de la semana
    const indiceExistente = existentesMes.findIndex((d) => d.dia_semana === dia_semana)

    // Si ya está publicado el mes, no se puede alterar arbitrariamente como borrador
    const tienePublicados = existentesMes.some(
      (d) => d.dia_semana === dia_semana && d.estado === 'PUBLICADO'
    )
    if (tienePublicados) {
      throw new Error(
        'Este día ya posee una agenda PUBLICADA para el mes. No puede modificarse directamente en borrador.'
      )
    }

    // Validación de la regla de negocio: Máximo 2 días de atención por semana
    const diasConfigurados = new Set(existentesMes.map((d) => d.dia_semana))
    if (!diasConfigurados.has(dia_semana) && diasConfigurados.size >= 2) {
      throw new Error(
        'Regla de negocio: Un médico puede configurar un máximo de 2 días de atención por semana.'
      )
    }

    const now = new Date().toISOString()
    let resultado: DisponibilidadMedica
    let esNueva = false

    if (indiceExistente >= 0) {
      // Actualizar borrador existente
      const dispExistente = existentesMes[indiceExistente]
      dispExistente.hora_desde = hora_desde
      dispExistente.hora_hasta = hora_hasta
      dispExistente.duracion_turno_minutos = duracion_turno_minutos
      dispExistente.cantidad_turnos = total
      dispExistente.updated_at = now
      dispExistente.estado = 'BORRADOR'
      resultado = dispExistente
    } else {
      // Crear nueva disponibilidad
      esNueva = true
      const nueva: DisponibilidadMedica = {
        id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        id_medico,
        mes_vigencia,
        dia_semana,
        hora_desde,
        hora_hasta,
        duracion_turno_minutos,
        estado: 'BORRADOR',
        cantidad_turnos: total,
        created_at: now,
        updated_at: now,
      }
      db.disponibilidades.push(nueva)
      resultado = nueva
    }

    writeDb(db)
    return { disponibilidad: resultado, esNueva }
  }

  /**
   * Elimina una disponibilidad en estado BORRADOR.
   */
  static async eliminarDisponibilidad(id_medico: string, id: string): Promise<boolean> {
    const db = readDb()
    const index = db.disponibilidades.findIndex(
      (d) => d.id === id && d.id_medico === id_medico
    )

    if (index === -1) {
      throw new Error('Configuración de disponibilidad no encontrada')
    }

    if (db.disponibilidades[index].estado === 'PUBLICADO') {
      throw new Error('No se puede eliminar una disponibilidad ya PUBLICADA')
    }

    db.disponibilidades.splice(index, 1)
    writeDb(db)
    return true
  }

  /**
   * Genera el resumen detallado para el modal de confirmación antes de publicar (US-04).
   */
  static async obtenerResumenPublicacion(
    id_medico: string,
    mes_vigencia: string
  ): Promise<ResumenPublicacion> {
    const db = readDb()
    const borradores = db.disponibilidades.filter(
      (d) =>
        d.id_medico === id_medico &&
        d.mes_vigencia === mes_vigencia &&
        d.estado === 'BORRADOR'
    )

    if (borradores.length === 0) {
      throw new Error('No hay configuraciones en borrador para publicar en este mes.')
    }

    let totalJornadas = 0
    let totalTurnos = 0

    const jornadasDetalle = borradores.map((b) => {
      const fechas = obtenerFechasDelMesParaDia(mes_vigencia, b.dia_semana)
      const ocurrencias = fechas.length
      const subtotalTurnos = b.cantidad_turnos * ocurrencias

      totalJornadas += ocurrencias
      totalTurnos += subtotalTurnos

      return {
        dia_semana: b.dia_semana,
        dia_nombre: NOMBRES_DIAS[b.dia_semana],
        hora_desde: b.hora_desde,
        hora_hasta: b.hora_hasta,
        duracion_minutos: b.duracion_turno_minutos,
        turnos_por_dia: b.cantidad_turnos,
        ocurrencias_en_mes: ocurrencias,
        subtotal_turnos: subtotalTurnos,
      }
    })

    return {
      mes_vigencia,
      total_jornadas: totalJornadas,
      total_turnos: totalTurnos,
      jornadas_detalle: jornadasDetalle,
    }
  }

  /**
   * Publica atómicamente la agenda médica del mes y genera los turnos DISPONIBLES (US-04 / RF-02).
   */
  static async publicarAgenda(
    id_medico: string,
    mes_vigencia: string
  ): Promise<{
    success: boolean
    mes: string
    total_jornadas: number
    total_turnos: number
  }> {
    if (!validarFormatoMes(mes_vigencia)) {
      throw new Error('Formato de mes inválido. Debe ser YYYY-MM')
    }

    const db = readDb()
    const borradores = db.disponibilidades.filter(
      (d) =>
        d.id_medico === id_medico &&
        d.mes_vigencia === mes_vigencia &&
        d.estado === 'BORRADOR'
    )

    if (borradores.length === 0) {
      throw new Error('No hay configuraciones en borrador pendientes de publicar para este mes.')
    }

    // Validar regla de máximo 2 días de atención
    const dias = new Set(borradores.map((b) => b.dia_semana))
    if (dias.size > 2) {
      throw new Error('Error de validación: Se supera el máximo de 2 días semanales permitidos.')
    }

    const nuevosTurnos: Turno[] = []
    let totalJornadas = 0
    const now = new Date().toISOString()

    // Generar slots para cada borrador
    for (const b of borradores) {
      const fechas = obtenerFechasDelMesParaDia(mes_vigencia, b.dia_semana)
      totalJornadas += fechas.length

      const { slots } = calcularTurnosPosibles(
        b.hora_desde,
        b.hora_hasta,
        b.duracion_turno_minutos
      )

      for (const fechaStr of fechas) {
        for (const slotHora of slots) {
          const fechaHoraIso = `${fechaStr}T${slotHora}:00`

          // Idempotencia: Verificar que no exista ya un turno generado para el mismo médico y fecha/hora
          const existeTurno = db.turnos.some(
            (t) => t.id_medico === id_medico && t.fecha_hora === fechaHoraIso
          )

          if (!existeTurno) {
            nuevosTurnos.push({
              id: `turno_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              id_medico,
              id_paciente: null,
              fecha_hora: fechaHoraIso,
              duracion_minutos: b.duracion_turno_minutos,
              estado: 'DISPONIBLE',
              modalidad: null,
              motivo_cancelacion: null,
              created_at: now,
            })
          }
        }
      }

      // Marcar borrador como PUBLICADO
      b.estado = 'PUBLICADO'
      b.updated_at = now
    }

    // Inserción atómica en la base de datos
    db.turnos.push(...nuevosTurnos)
    writeDb(db)

    return {
      success: true,
      mes: mes_vigencia,
      total_jornadas: totalJornadas,
      total_turnos: nuevosTurnos.length,
    }
  }

  /**
   * Consulta los turnos generados de la agenda médica (US-05).
   */
  static async obtenerAgendaTurnos(
    id_medico: string,
    mes_vigencia: string,
    vista: 'mensual' | 'semanal' = 'mensual',
    fecha_referencia?: string
  ): Promise<Turno[]> {
    if (!validarFormatoMes(mes_vigencia)) {
      throw new Error('Formato de mes inválido')
    }

    const db = readDb()
    let turnosMedico = db.turnos.filter(
      (t) => t.id_medico === id_medico && t.fecha_hora.startsWith(mes_vigencia)
    )

    if (vista === 'semanal' && fecha_referencia) {
      const refDate = new Date(`${fecha_referencia}T00:00:00`)
      const day = refDate.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day

      const monday = new Date(refDate)
      monday.setDate(refDate.getDate() + diffToMonday)
      monday.setHours(0, 0, 0, 0)

      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      turnosMedico = turnosMedico.filter((t) => {
        const turnoDate = new Date(t.fecha_hora)
        return turnoDate >= monday && turnoDate <= sunday
      })
    }

    // Ordenar cronológicamente
    return turnosMedico.sort(
      (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
    )
  }
}
