// Servicio integral de gestión de stock de vacunas, lotes y turnos de vacunación con transacciones atómicas (US-20).
import { prisma } from '@/lib/prisma'
import type { TipoMovimientoStock, EstadoTurnoVacunacion } from '@/lib/generated/prisma/client'
import { validarMovimientoStock, validarAsignarTurno, type DatosMovimientoStockInput, type DatosAsignarTurnoInput } from '@/lib/validation/vacunacion'

export interface RegistrarMovimientoParams extends DatosMovimientoStockInput {
  idEnfermero?: string
}

export interface AsignarTurnoParams extends DatosAsignarTurnoInput {
  idTurnoVacunacion: string
  idEnfermero?: string
}

export interface CrearTurnoExpressParams {
  idEnfermero: string
  idVacuna: string
  fecha: Date | string
  hora: string
  idPaciente?: string
  idLote?: string
  idempotencyKey?: string
}

export class VacunacionService {
  /**
   * Asegura un catálogo base de vacunas si el sistema aún no tiene registros creados.
   */
  static async asegurarCatalogoVacunas() {
    const total = await prisma.vacuna.count()
    if (total > 0) return

    const vacunasIniciales = [
      { nombre: 'Antigripal Trivalente', stock: 15 },
      { nombre: 'Hepatitis B Adultos', stock: 10 },
      { nombre: 'Triple Viral (SRP)', stock: 8 },
      { nombre: 'COVID-19 Bivalente', stock: 20 },
      { nombre: 'Fiebre Amarilla', stock: 5 },
    ]

    for (const v of vacunasIniciales) {
      const vacunaCreada = await prisma.vacuna.create({
        data: {
          nombre: v.nombre,
          stock: v.stock,
        },
      })

      // Crear un lote inicial para demostración
      const loteNumero = `LOTE-${v.nombre.slice(0, 3).toUpperCase()}-2026-A`
      const vencimiento = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 meses
      await prisma.loteVacuna.create({
        data: {
          idVacuna: vacunaCreada.idVacuna,
          numeroLote: loteNumero,
          stock: v.stock,
          vencimiento,
        },
      })

      await prisma.movimientoStockVacuna.create({
        data: {
          idVacuna: vacunaCreada.idVacuna,
          tipoMovimiento: 'INGRESO',
          cantidad: v.stock,
          stockAnterior: 0,
          stockNuevo: v.stock,
          motivo: 'Carga inicial de inventario',
        },
      })
    }
  }

  /**
   * RF-20.1: Consulta el inventario de vacunas con stock total, lotes detallados y dosis comprometidas.
   */
  static async obtenerStockVacunas() {
    await this.asegurarCatalogoVacunas()

    const vacunas = await prisma.vacuna.findMany({
      include: {
        lotes: {
          orderBy: [{ vencimiento: 'asc' }, { createdAt: 'desc' }],
        },
        turnos: {
          where: { estado: 'CONFIRMADO' },
          select: { idTurnoVacunacion: true },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    return vacunas.map((v) => ({
      idVacuna: v.idVacuna,
      nombre: v.nombre,
      stockDisponible: v.stock,
      turnosComprometidos: v.turnos.length,
      lotes: v.lotes.map((l) => ({
        idLote: l.idLote,
        numeroLote: l.numeroLote,
        stock: l.stock,
        vencimiento: l.vencimiento ? l.vencimiento.toISOString().slice(0, 10) : null,
      })),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }))
  }

  /**
   * Obtiene la lista de pacientes registrados para selección en mostrador.
   */
  static async obtenerPacientes() {
    return prisma.paciente.findMany({
      select: {
        idPaciente: true,
        nombre: true,
        apellido: true,
        dni: true,
        email: true,
        obraSocial: true,
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    })
  }

  /**
   * RF-20.2: Registro atómico de ingreso o ajuste de stock con soporte para lotes e idempotencia.
   */
  static async registrarMovimientoStock(params: RegistrarMovimientoParams) {
    const validacion = validarMovimientoStock(params)
    if (!validacion.ok || !validacion.datos) {
      const err = new Error(validacion.error || 'Datos de movimiento inválidos')
      ;(err as any).statusCode = 400
      throw err
    }

    const { idVacuna, tipoMovimiento, cantidad, numeroLote, vencimiento, motivo, idempotencyKey } = validacion.datos
    const idEnfermero = params.idEnfermero

    // 1. Idempotencia: si ya existe un movimiento registrado con esta clave, devolverlo
    if (idempotencyKey) {
      const movimientoExistente = await prisma.movimientoStockVacuna.findUnique({
        where: { idempotencyKey },
        include: { vacuna: true, lote: true },
      })
      if (movimientoExistente) {
        return {
          movimiento: movimientoExistente,
          idempotent: true,
          mensaje: 'Movimiento recuperado de operación previa (idempotente).',
        }
      }
    }

    // 2. Transacción atómica en PostgreSQL
    return prisma.$transaction(async (tx) => {
      const vacuna = await tx.vacuna.findUnique({
        where: { idVacuna },
      })

      if (!vacuna) {
        const err = new Error('La vacuna especificada no existe')
        ;(err as any).statusCode = 404
        throw err
      }

      let loteId: string | undefined = undefined

      // Gestión de lote si se indicó número de lote
      if (numeroLote) {
        let lote = await tx.loteVacuna.findUnique({
          where: {
            idVacuna_numeroLote: {
              idVacuna,
              numeroLote,
            },
          },
        })

        if (!lote) {
          lote = await tx.loteVacuna.create({
            data: {
              idVacuna,
              numeroLote,
              stock: 0,
              vencimiento: vencimiento ? new Date(vencimiento) : null,
            },
          })
        }
        loteId = lote.idLote
      }

      const stockAnterior = vacuna.stock

      if (tipoMovimiento === 'INGRESO') {
        // Ingreso suma a la vacuna y al lote
        const vacunaActualizada = await tx.vacuna.update({
          where: { idVacuna },
          data: { stock: { increment: cantidad } },
        })

        if (loteId) {
          await tx.loteVacuna.update({
            where: { idLote: loteId },
            data: { stock: { increment: cantidad } },
          })
        }

        const movimiento = await tx.movimientoStockVacuna.create({
          data: {
            idVacuna,
            idLote: loteId,
            idEnfermero,
            tipoMovimiento: 'INGRESO',
            cantidad,
            stockAnterior,
            stockNuevo: vacunaActualizada.stock,
            motivo: motivo || 'Ingreso de dosis al inventario',
            idempotencyKey,
          },
          include: { vacuna: true, lote: true },
        })

        return {
          movimiento,
          vacuna: vacunaActualizada,
          idempotent: false,
        }
      } else {
        // Tipo AJUSTE: cantidad puede ser positiva o negativa
        if (cantidad < 0) {
          const valorAbsoluto = Math.abs(cantidad)

          // Actualización condicional atómica: stock >= cantidad a descontar
          const resVacuna = await tx.vacuna.updateMany({
            where: {
              idVacuna,
              stock: { gte: valorAbsoluto },
            },
            data: {
              stock: { increment: cantidad }, // cantidad es negativa
            },
          })

          if (resVacuna.count !== 1) {
            const err = new Error('Stock insuficiente: el ajuste resultaría en un saldo negativo.')
            ;(err as any).statusCode = 409
            ;(err as any).code = 'INSUFFICIENT_STOCK'
            throw err
          }

          if (loteId) {
            const resLote = await tx.loteVacuna.updateMany({
              where: {
                idLote: loteId,
                stock: { gte: valorAbsoluto },
              },
              data: {
                stock: { increment: cantidad },
              },
            })

            if (resLote.count !== 1) {
              const err = new Error('Stock insuficiente en el lote especificado para el ajuste.')
              ;(err as any).statusCode = 409
              ;(err as any).code = 'INSUFFICIENT_BATCH_STOCK'
              throw err
            }
          }
        } else {
          // Ajuste positivo
          await tx.vacuna.update({
            where: { idVacuna },
            data: { stock: { increment: cantidad } },
          })

          if (loteId) {
            await tx.loteVacuna.update({
              where: { idLote: loteId },
              data: { stock: { increment: cantidad } },
            })
          }
        }

        const vacunaFinal = await tx.vacuna.findUniqueOrThrow({ where: { idVacuna } })

        const movimiento = await tx.movimientoStockVacuna.create({
          data: {
            idVacuna,
            idLote: loteId,
            idEnfermero,
            tipoMovimiento: 'AJUSTE',
            cantidad,
            stockAnterior,
            stockNuevo: vacunaFinal.stock,
            motivo: motivo || 'Ajuste manual de inventario',
            idempotencyKey,
          },
          include: { vacuna: true, lote: true },
        })

        return {
          movimiento,
          vacuna: vacunaFinal,
          idempotent: false,
        }
      }
    })
  }

  /**
   * Consulta turnos de vacunación con filtros de estado o fecha.
   */
  static async obtenerTurnosVacunacion(filtros?: {
    fecha?: Date | string
    estado?: EstadoTurnoVacunacion
    idVacuna?: string
  }) {
    const where: any = {}

    if (filtros?.estado) {
      where.estado = filtros.estado
    }

    if (filtros?.idVacuna) {
      where.idVacuna = filtros.idVacuna
    }

    if (filtros?.fecha) {
      const fechaObj = filtros.fecha instanceof Date ? filtros.fecha : new Date(filtros.fecha)
      where.fecha = fechaObj
    }

    return prisma.turnoVacunacion.findMany({
      where,
      include: {
        vacuna: true,
        lote: true,
        paciente: true,
        enfermero: true,
      },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
    })
  }

  /**
   * Crea un turno express o de demanda espontánea para vacunación en mostrador.
   */
  static async crearTurnoVacunacionExpress(params: CrearTurnoExpressParams) {
    const { idEnfermero, idVacuna, fecha, hora, idPaciente, idLote, idempotencyKey } = params

    const fechaObj = fecha instanceof Date ? fecha : new Date(fecha)

    // Si ya existe turno para ese enfermero, fecha y hora, retornar existente
    const existente = await prisma.turnoVacunacion.findUnique({
      where: {
        idEnfermero_fecha_hora: {
          idEnfermero,
          fecha: fechaObj,
          hora,
        },
      },
    })

    if (existente) {
      return existente
    }

    return prisma.turnoVacunacion.create({
      data: {
        idEnfermero,
        idVacuna,
        idPaciente: idPaciente || null,
        idLote: idLote || null,
        fecha: fechaObj,
        hora,
        estado: idPaciente ? 'CONFIRMADO' : 'DISPONIBLE',
        idempotencyKey: idempotencyKey || null,
      },
      include: {
        vacuna: true,
        lote: true,
        paciente: true,
        enfermero: true,
      },
    })
  }

  /**
   * RF-20.3 & RF-20.6: Asignación atómica y concurrente de un turno de vacunación a un paciente.
   * Compromete 1 dosis de stock garantizando exclusión mutua contra condiciones de carrera.
   * Si dos peticiones compiten por la última dosis (stock = 1), exactamente UNA gana y la otra recibe 409.
   */
  static async asignarTurnoVacunacion(params: AsignarTurnoParams) {
    const validacion = validarAsignarTurno(params)
    if (!validacion.ok || !validacion.datos) {
      const err = new Error(validacion.error || 'Datos de asignación inválidos')
      ;(err as any).statusCode = 400
      throw err
    }

    const { idTurnoVacunacion, idEnfermero } = params
    const { idPaciente, idVacuna, idLote, idempotencyKey } = validacion.datos

    // 1. Soporte de idempotencia: si la misma clave ya asignó este turno a este paciente
    if (idempotencyKey) {
      const yaAsignado = await prisma.turnoVacunacion.findFirst({
        where: {
          idTurnoVacunacion,
          idPaciente,
          idempotencyKey,
          estado: 'CONFIRMADO',
        },
        include: { vacuna: true, lote: true, paciente: true, enfermero: true },
      })

      if (yaAsignado) {
        return {
          turno: yaAsignado,
          idempotent: true,
          mensaje: 'Turno ya asignado con esta clave de operación (idempotente).',
        }
      }
    }

    // 2. Transacción atómica de asignación y consumo de stock
    return prisma.$transaction(async (tx) => {
      // A. Verificar turno
      const turno = await tx.turnoVacunacion.findUnique({
        where: { idTurnoVacunacion },
        include: { vacuna: true, lote: true },
      })

      if (!turno) {
        const err = new Error('El turno de vacunación solicitado no existe.')
        ;(err as any).statusCode = 404
        throw err
      }

      if (turno.estado !== 'DISPONIBLE') {
        const err = new Error('El turno ya no está disponible para asignación.')
        ;(err as any).statusCode = 409
        ;(err as any).code = 'TURN_NOT_AVAILABLE'
        throw err
      }

      // B. Verificar paciente
      const paciente = await tx.paciente.findUnique({
        where: { idPaciente },
      })

      if (!paciente) {
        const err = new Error('El paciente especificado no existe.')
        ;(err as any).statusCode = 404
        throw err
      }

      const vacunaObjetivoId = idVacuna || turno.idVacuna
      const loteObjetivoId = idLote || turno.idLote

      // C. ACTUALIZACIÓN CONDICIONAL ATÓMICA DE STOCK EN VACUNA (RF-20.6)
      // Solo actualiza si stock >= 1 en el instante exacto de ejecución en PostgreSQL
      const updateVacuna = await tx.vacuna.updateMany({
        where: {
          idVacuna: vacunaObjetivoId,
          stock: { gte: 1 },
        },
        data: {
          stock: { decrement: 1 },
        },
      })

      if (updateVacuna.count !== 1) {
        const err = new Error('Stock insuficiente para la vacuna seleccionada.')
        ;(err as any).statusCode = 409
        ;(err as any).code = 'INSUFFICIENT_STOCK'
        throw err
      }

      // D. Si se especificó un lote, descontar condicionalmente del lote
      if (loteObjetivoId) {
        const updateLote = await tx.loteVacuna.updateMany({
          where: {
            idLote: loteObjetivoId,
            stock: { gte: 1 },
          },
          data: {
            stock: { decrement: 1 },
          },
        })

        if (updateLote.count !== 1) {
          const err = new Error('Stock insuficiente en el lote seleccionado.')
          ;(err as any).statusCode = 409
          ;(err as any).code = 'INSUFFICIENT_BATCH_STOCK'
          throw err
        }
      }

      // E. ACTUALIZACIÓN ATÓMICA DEL TURNO
      const updateTurno = await tx.turnoVacunacion.updateMany({
        where: {
          idTurnoVacunacion,
          estado: 'DISPONIBLE',
          idPaciente: null,
        },
        data: {
          idPaciente,
          idVacuna: vacunaObjetivoId,
          idLote: loteObjetivoId || null,
          estado: 'CONFIRMADO',
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      })

      if (updateTurno.count !== 1) {
        const err = new Error('El turno de vacunación fue tomado concurrentemente por otra solicitud.')
        ;(err as any).statusCode = 409
        ;(err as any).code = 'TURN_CONCURRENTLY_RESERVED'
        throw err
      }

      // F. Registrar movimiento de inventario para trazabilidad y auditoría
      const vacunaFinal = await tx.vacuna.findUniqueOrThrow({ where: { idVacuna: vacunaObjetivoId } })

      await tx.movimientoStockVacuna.create({
        data: {
          idVacuna: vacunaObjetivoId,
          idLote: loteObjetivoId || null,
          idEnfermero: idEnfermero || turno.idEnfermero || null,
          tipoMovimiento: 'CONSUMO',
          cantidad: -1,
          stockAnterior: vacunaFinal.stock + 1,
          stockNuevo: vacunaFinal.stock,
          motivo: `Asignación de turno de vacunación #${idTurnoVacunacion} a ${paciente.nombre} ${paciente.apellido}`,
          idempotencyKey: idempotencyKey ? `asig_${idempotencyKey}` : null,
        },
      })

      const turnoConfirmado = await tx.turnoVacunacion.findUniqueOrThrow({
        where: { idTurnoVacunacion },
        include: { vacuna: true, lote: true, paciente: true, enfermero: true },
      })

      return {
        turno: turnoConfirmado,
        stockRestante: vacunaFinal.stock,
        idempotent: false,
      }
    })
  }

  /**
   * RF-20.8: Marca un turno de vacunación como APLICADO.
   * Regla de consistencia: NO descuenta stock nuevamente porque ya fue comprometido al confirmar.
   */
  static async aplicarTurnoVacunacion(idTurnoVacunacion: string) {
    return prisma.$transaction(async (tx) => {
      const turno = await tx.turnoVacunacion.findUnique({
        where: { idTurnoVacunacion },
      })

      if (!turno) {
        const err = new Error('Turno de vacunación no encontrado')
        ;(err as any).statusCode = 404
        throw err
      }

      if (turno.estado === 'APLICADO') {
        return turno
      }

      if (turno.estado !== 'CONFIRMADO') {
        const err = new Error('Solo se pueden aplicar turnos que estén previamente confirmados')
        ;(err as any).statusCode = 409
        throw err
      }

      return tx.turnoVacunacion.update({
        where: { idTurnoVacunacion },
        data: { estado: 'APLICADO' },
        include: { vacuna: true, lote: true, paciente: true, enfermero: true },
      })
    })
  }

  /**
   * Cancela un turno de vacunación y libera la dosis de stock comprometida si el turno estaba confirmado.
   */
  static async cancelarTurnoVacunacion(idTurnoVacunacion: string, motivo: string = 'Cancelado') {
    return prisma.$transaction(async (tx) => {
      const turno = await tx.turnoVacunacion.findUnique({
        where: { idTurnoVacunacion },
      })

      if (!turno) {
        const err = new Error('Turno de vacunación no encontrado')
        ;(err as any).statusCode = 404
        throw err
      }

      if (turno.estado === 'CANCELADO') {
        return turno
      }

      if (turno.estado === 'APLICADO') {
        const err = new Error('No se puede cancelar una vacuna que ya fue efectivamente aplicada al paciente')
        ;(err as any).statusCode = 409
        throw err
      }

      // Si estaba CONFIRMADO, se debe restituir la dosis de stock (LIBERACION)
      if (turno.estado === 'CONFIRMADO') {
        const vacuna = await tx.vacuna.update({
          where: { idVacuna: turno.idVacuna },
          data: { stock: { increment: 1 } },
        })

        if (turno.idLote) {
          await tx.loteVacuna.update({
            where: { idLote: turno.idLote },
            data: { stock: { increment: 1 } },
          })
        }

        await tx.movimientoStockVacuna.create({
          data: {
            idVacuna: turno.idVacuna,
            idLote: turno.idLote,
            idEnfermero: turno.idEnfermero,
            tipoMovimiento: 'LIBERACION',
            cantidad: 1,
            stockAnterior: vacuna.stock - 1,
            stockNuevo: vacuna.stock,
            motivo: `Liberación por cancelación de turno #${idTurnoVacunacion}: ${motivo}`,
          },
        })
      }

      return tx.turnoVacunacion.update({
        where: { idTurnoVacunacion },
        data: {
          estado: 'CANCELADO',
          idPaciente: null,
          idempotencyKey: null,
        },
        include: { vacuna: true, lote: true, paciente: true },
      })
    })
  }

  /**
   * Obtiene el historial de movimientos de inventario de vacunas.
   */
  static async obtenerHistorialMovimientos(idVacuna?: string, limite: number = 30) {
    const where: any = {}
    if (idVacuna) where.idVacuna = idVacuna

    return prisma.movimientoStockVacuna.findMany({
      where,
      include: {
        vacuna: true,
        lote: true,
        enfermero: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limite,
    })
  }
}
