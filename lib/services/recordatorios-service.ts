// Servicio de gestión del ciclo de vida, estados y reintentos de recordatorios de turnos (US-15).
import { prisma } from '@/lib/prisma'
import { RECORDATORIOS_CONFIG } from '@/lib/config/recordatorios-config'
import { EmailService, type DatosRecordatorioEmail } from '@/lib/services/email-service'
import {
  obtenerInstanteTurno,
  calcularMomentoProgramado,
  calcularFechaProximoReintento,
  formatearFechaLegible,
} from '@/lib/utils/recordatorios-utils'

export {
  obtenerInstanteTurno,
  calcularMomentoProgramado,
  calcularFechaProximoReintento,
  formatearFechaLegible,
}

export interface ProgramarRecordatorioParams {
  idTurno: string
  idPaciente: string
  fechaTurno: Date | string
  horaTurno: string
  horasAnticipacion?: number
}

export interface ResultadoProcesamientoLote {
  totalProcesados: number
  enviados: number
  reintentosProgramados: number
  fallidos: number
  cancelados: number
  errores: { idRecordatorio: string; error: string; esTransitorio: boolean }[]
}

export class RecordatoriosService {
  /**
   * RF-15.1: Programa un recordatorio para un turno confirmado.
   * Si ya existe un recordatorio activo para el turno, evita duplicaciones (idempotencia).
   */
  static async programarRecordatorio(params: ProgramarRecordatorioParams) {
    const { idTurno, idPaciente, fechaTurno, horaTurno, horasAnticipacion } = params

    // 1. Verificar si ya existe un recordatorio activo o enviado para este turno
    const recordatorioExistente = await prisma.recordatorioTurno.findFirst({
      where: {
        idTurno,
        estado: {
          in: ['PENDIENTE', 'PROCESANDO', 'REINTENTO_PROGRAMADO', 'ENVIADO'],
        },
      },
    })

    if (recordatorioExistente) {
      return {
        recordatorio: recordatorioExistente,
        programado: false,
        motivo: 'Ya existe un recordatorio activo o enviado para este turno',
      }
    }

    // 2. Calcular momento previsto de envío según la política de anticipación
    const programadoPara = calcularMomentoProgramado(fechaTurno, horaTurno, horasAnticipacion)

    if (!programadoPara) {
      return {
        recordatorio: null,
        programado: false,
        motivo: 'El turno está demasiado próximo o en el pasado; no se programa recordatorio',
      }
    }

    // 3. Crear el registro persistente de recordatorio
    const nuevoRecordatorio = await prisma.recordatorioTurno.create({
      data: {
        idTurno,
        idPaciente,
        estado: 'PENDIENTE',
        intentos: 0,
        programadoPara,
        ciclo: 1,
      },
    })

    return {
      recordatorio: nuevoRecordatorio,
      programado: true,
    }
  }

  /**
   * RF-15.5: Reprograma el recordatorio cuando cambia la fecha u horario de un turno.
   * Si había un recordatorio pendiente o en reintento, actualiza su fecha programada.
   * Si ya se había enviado el recordatorio de la fecha anterior, inicia un nuevo ciclo.
   */
  static async reprogramarRecordatorio(idTurno: string, nuevaFecha: Date | string, nuevaHora: string) {
    const programadoPara = calcularMomentoProgramado(nuevaFecha, nuevaHora)

    // Buscar recordatorios activos para este turno
    const recordatorioActivo = await prisma.recordatorioTurno.findFirst({
      where: {
        idTurno,
        estado: {
          in: ['PENDIENTE', 'REINTENTO_PROGRAMADO', 'PROCESANDO'],
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recordatorioActivo) {
      if (!programadoPara) {
        // La nueva fecha está demasiado próxima o vencida; cancelar recordatorio
        return prisma.recordatorioTurno.update({
          where: { idRecordatorio: recordatorioActivo.idRecordatorio },
          data: {
            estado: 'CANCELADO',
            ultimoError: 'Turno reprogramado a un horario demasiado próximo',
          },
        })
      }

      return prisma.recordatorioTurno.update({
        where: { idRecordatorio: recordatorioActivo.idRecordatorio },
        data: {
          estado: 'PENDIENTE',
          programadoPara,
          intentos: 0,
          ultimoError: null,
        },
      })
    }

    // Si ya había sido enviado para la fecha anterior, y hay margen para la nueva, crear un nuevo ciclo
    const recordatorioEnviado = await prisma.recordatorioTurno.findFirst({
      where: { idTurno, estado: 'ENVIADO' },
      orderBy: { createdAt: 'desc' },
    })

    if (recordatorioEnviado && programadoPara) {
      return prisma.recordatorioTurno.create({
        data: {
          idTurno,
          idPaciente: recordatorioEnviado.idPaciente,
          estado: 'PENDIENTE',
          intentos: 0,
          programadoPara,
          ciclo: recordatorioEnviado.ciclo + 1,
        },
      })
    }

    return null
  }

  /**
   * RF-15.5: Cancela recordatorios pendientes o en reintento cuando un turno se cancela.
   */
  static async cancelarRecordatoriosTurno(idTurno: string, motivo: string = 'Turno cancelado') {
    return prisma.recordatorioTurno.updateMany({
      where: {
        idTurno,
        estado: {
          in: ['PENDIENTE', 'REINTENTO_PROGRAMADO', 'PROCESANDO'],
        },
      },
      data: {
        estado: 'CANCELADO',
        ultimoError: motivo,
      },
    })
  }

  /**
   * RF-15.4 / RF-15.6: Reclama y procesa un lote de recordatorios vencidos de forma atómica y segura contra concurrencia.
   * Si se especifica `forzarIdTurno`, procesa de inmediato dicho turno (útil para pruebas o disparos manuales controlados).
   */
  static async procesarLoteRecordatorios(opciones?: {
    limite?: number
    forzarIdTurno?: string
    ahora?: Date
  }): Promise<ResultadoProcesamientoLote> {
    const limite = opciones?.limite ?? RECORDATORIOS_CONFIG.TAMANO_LOTE_PROCESAMIENTO
    const ahora = opciones?.ahora ?? new Date()
    const staleThreshold = new Date(
      ahora.getTime() - RECORDATORIOS_CONFIG.STALE_PROCESSING_TIMEOUT_MINUTOS * 60 * 1000
    )

    // 1. Seleccionar candidatos para procesamiento
    let candidatos: { idRecordatorio: string }[] = []

    if (opciones?.forzarIdTurno) {
      candidatos = await prisma.recordatorioTurno.findMany({
        where: {
          idTurno: opciones.forzarIdTurno,
          estado: { in: ['PENDIENTE', 'REINTENTO_PROGRAMADO', 'PROCESANDO'] },
        },
        select: { idRecordatorio: true },
        take: 1,
      })
    } else {
      candidatos = await prisma.recordatorioTurno.findMany({
        where: {
          OR: [
            // Pendientes o reintentos cuya fecha programada ya llegó
            {
              estado: { in: ['PENDIENTE', 'REINTENTO_PROGRAMADO'] },
              programadoPara: { lte: ahora },
            },
            // Registros huérfanos que quedaron en 'PROCESANDO' por corte o timeout
            {
              estado: 'PROCESANDO',
              ultimoIntentoAt: { lte: staleThreshold },
            },
          ],
        },
        select: { idRecordatorio: true },
        orderBy: { programadoPara: 'asc' },
        take: limite,
      })
    }

    if (candidatos.length === 0) {
      return {
        totalProcesados: 0,
        enviados: 0,
        reintentosProgramados: 0,
        fallidos: 0,
        cancelados: 0,
        errores: [],
      }
    }

    const idsCandidatos = candidatos.map((c) => c.idRecordatorio)

    // 2. Reclamación atómica: pasar los candidatos a PROCESANDO
    // Solo los registros efectivamente actualizados por esta transacción serán procesados por este worker.
    const reclamados = await prisma.$transaction(async (tx) => {
      const actualizados = await tx.recordatorioTurno.updateMany({
        where: {
          idRecordatorio: { in: idsCandidatos },
          OR: [
            { estado: { in: ['PENDIENTE', 'REINTENTO_PROGRAMADO'] } },
            { estado: 'PROCESANDO', ultimoIntentoAt: { lte: staleThreshold } },
          ],
        },
        data: {
          estado: 'PROCESANDO',
          ultimoIntentoAt: ahora,
        },
      })

      if (actualizados.count === 0 && !opciones?.forzarIdTurno) {
        return []
      }

      return tx.recordatorioTurno.findMany({
        where: {
          idRecordatorio: { in: idsCandidatos },
          estado: 'PROCESANDO',
        },
        include: {
          turno: {
            include: {
              medico: true,
              paciente: true,
            },
          },
          paciente: true,
        },
      })
    })

    const resultado: ResultadoProcesamientoLote = {
      totalProcesados: reclamados.length,
      enviados: 0,
      reintentosProgramados: 0,
      fallidos: 0,
      cancelados: 0,
      errores: [],
    }

    // 3. Procesar envíos de correo FUERA de la transacción para no bloquear la BD
    for (const recordatorio of reclamados) {
      const { turno, paciente } = recordatorio

      // Verificar vigencia del turno: si ya no está CONFIRMADO, cancelar recordatorio
      if (!turno || turno.estado !== 'CONFIRMADO') {
        await prisma.recordatorioTurno.update({
          where: { idRecordatorio: recordatorio.idRecordatorio },
          data: {
            estado: 'CANCELADO',
            ultimoError: 'El turno ya no se encuentra confirmado',
          },
        })
        resultado.cancelados++
        continue
      }

      // Obtener datos del destinatario
      const emailPaciente = paciente?.email || turno.paciente?.email
      if (!emailPaciente) {
        await prisma.recordatorioTurno.update({
          where: { idRecordatorio: recordatorio.idRecordatorio },
          data: {
            estado: 'FALLIDO',
            ultimoError: 'El paciente no posee dirección de email registrada',
          },
        })
        resultado.fallidos++
        continue
      }

      const datosEmail: DatosRecordatorioEmail = {
        email: emailPaciente,
        pacienteNombre: `${paciente.nombre} ${paciente.apellido}`.trim(),
        medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`.trim(),
        especialidad: turno.medico.especialidad,
        fecha: formatearFechaLegible(turno.fecha),
        hora: turno.hora,
        consultorio: turno.medico.consultorio,
        direccion: turno.medico.direccion,
      }

      // Ejecutar intento de envío a través del EmailService
      const resultadoEnvio = await EmailService.enviarRecordatorioTurno(datosEmail)
      const nuevosIntentos = recordatorio.intentos + 1

      if (resultadoEnvio.ok) {
        // ENVÍO EXITOSO
        const momentoEnvio = new Date()
        await prisma.$transaction([
          prisma.recordatorioTurno.update({
            where: { idRecordatorio: recordatorio.idRecordatorio },
            data: {
              estado: 'ENVIADO',
              intentos: nuevosIntentos,
              enviadoAt: momentoEnvio,
              ultimoError: null,
            },
          }),
          prisma.turno.update({
            where: { idTurno: turno.idTurno },
            data: {
              recordatorioEnviadoAt: momentoEnvio,
            },
          }),
        ])
        resultado.enviados++
      } else {
        // FALLA EN EL ENVÍO: Evaluar si corresponde reintento o falla definitiva
        const esTransitorio = resultadoEnvio.esErrorTransitorio
        const errorMsg = resultadoEnvio.error || 'Error desconocido al emitir email'

        resultado.errores.push({
          idRecordatorio: recordatorio.idRecordatorio,
          error: errorMsg,
          esTransitorio,
        })

        if (esTransitorio && nuevosIntentos < RECORDATORIOS_CONFIG.MAX_INTENTOS) {
          // REINTENTO PROGRAMADO con backoff exponencial
          const proximoIntento = calcularFechaProximoReintento(nuevosIntentos, ahora)
          await prisma.recordatorioTurno.update({
            where: { idRecordatorio: recordatorio.idRecordatorio },
            data: {
              estado: 'REINTENTO_PROGRAMADO',
              intentos: nuevosIntentos,
              programadoPara: proximoIntento,
              ultimoError: errorMsg,
            },
          })
          resultado.reintentosProgramados++
        } else {
          // ERROR PERMANENTE O REINTENTOS AGOTADOS -> FALLIDO
          await prisma.recordatorioTurno.update({
            where: { idRecordatorio: recordatorio.idRecordatorio },
            data: {
              estado: 'FALLIDO',
              intentos: nuevosIntentos,
              ultimoError: errorMsg,
            },
          })
          resultado.fallidos++
        }
      }
    }

    return resultado
  }

  /**
   * Obtiene el estado y detalles del recordatorio asociado a un turno.
   */
  static async obtenerRecordatorioTurno(idTurno: string) {
    return prisma.recordatorioTurno.findFirst({
      where: { idTurno },
      orderBy: { createdAt: 'desc' },
    })
  }
}
