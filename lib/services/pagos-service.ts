// Servicio de pagos para consultas particulares (US-23).
import { prisma } from '../prisma'
import { Prisma } from '../generated/prisma/client'
import { EstadoPago, ProveedorPago } from '../generated/prisma/enums'
import { PAGOS_CONFIG, obtenerTarifaConsulta } from '../config/pagos-config'

export interface IniciarPagoInput {
  idTurno: string
  idPaciente: string
  idempotencyKey?: string
}

export interface ProcesarResultadoPagoInput {
  idPago: string
  idPaciente?: string
  resultado: 'APROBADO' | 'RECHAZADO' | 'ERROR'
  transaccionExternaId?: string
  motivoRechazo?: string
  codigoError?: string
}

export interface PagoTurnoDTO {
  idPago: string
  idTurno: string
  idPaciente: string
  monto: string
  moneda: string
  estado: EstadoPago
  proveedor: ProveedorPago
  transaccionExternaId: string | null
  idempotencyKey: string
  motivoRechazo: string | null
  codigoError: string | null
  aprobadoAt: string | null
  createdAt: string
  updatedAt: string
  turno?: {
    idTurno: string
    fecha: string
    hora: string
    modalidad: string | null
    estado: string
    medico: {
      nombre: string
      apellido: string
      especialidad: string
      consultorio: string | null
    }
  }
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string }
  err.statusCode = statusCode
  if (code) err.code = code
  return err
}

export class PagosService {
  /**
   * Inicia el proceso de pago para un turno de modalidad PARTICULAR.
   * Valida titularidad, modalidad, estado del turno, ausencia de pago aprobado previo
   * e implementa idempotencia estricta.
   */
  static async iniciarPagoTurno(input: IniciarPagoInput): Promise<{ pago: PagoTurnoDTO; idempotent: boolean }> {
    const { idTurno, idPaciente, idempotencyKey } = input

    if (!idTurno || typeof idTurno !== 'string') {
      throw errorConEstado('El identificador del turno es requerido.', 400, 'INVALID_TURNO_ID')
    }

    if (!idPaciente || typeof idPaciente !== 'string') {
      throw errorConEstado('El identificador del paciente es requerido.', 400, 'INVALID_PATIENT_ID')
    }

    // 1. Idempotencia: si se provee idempotencyKey, verificar si ya existe una operación previa
    if (idempotencyKey) {
      const pagoExistente = await prisma.pagoTurno.findUnique({
        where: { idempotencyKey },
        include: {
          turno: {
            include: { medico: true },
          },
        },
      })

      if (pagoExistente) {
        if (pagoExistente.idTurno === idTurno && pagoExistente.idPaciente === idPaciente) {
          return {
            pago: this.mapearPagoADTO(pagoExistente),
            idempotent: true,
          }
        }

        throw errorConEstado(
          'La clave de idempotencia ya fue utilizada para otra operación de pago.',
          409,
          'IDEMPOTENCY_KEY_REUSED'
        )
      }
    }

    // 2. Transacción de verificación y creación del intento de pago
    return prisma.$transaction(async (tx) => {
      // 2.1 Verificar existencia y titularidad del turno
      const turno = await tx.turno.findUnique({
        where: { idTurno },
        include: {
          medico: true,
          paciente: true,
        },
      })

      if (!turno) {
        throw errorConEstado('El turno solicitado no existe.', 404, 'TURNO_NOT_FOUND')
      }

      if (turno.idPaciente !== idPaciente) {
        throw errorConEstado(
          'Acceso denegado: el turno solicitado no pertenece al paciente autenticado.',
          403,
          'FORBIDDEN_TURNO_ACCESS'
        )
      }

      // 2.2 Verificar modalidad del turno
      if (turno.modalidad === 'COBERTURA') {
        throw errorConEstado(
          'El turno fue reservado con cobertura médica y no requiere pago particular.',
          409,
          'TURNO_COBERTURA_NO_PAGABLE'
        )
      }

      if (turno.modalidad !== 'PARTICULAR') {
        throw errorConEstado(
          `La modalidad del turno (${turno.modalidad ?? 'NO_DEFINIDA'}) no admite pago particular.`,
          400,
          'MODALIDAD_INVALIDA'
        )
      }

      // 2.3 Verificar estado del turno (no cancelado ni atendido)
      if (turno.estado === 'CANCELADO') {
        throw errorConEstado(
          'No se puede abonar una consulta cancelada.',
          409,
          'TURNO_CANCELADO'
        )
      }

      if (turno.estado === 'ATENDIDO') {
        throw errorConEstado(
          'No se puede abonar una consulta que ya fue atendida.',
          409,
          'TURNO_ATENDIDO'
        )
      }

      if (turno.estado !== 'CONFIRMADO') {
        throw errorConEstado(
          `El turno debe estar confirmado para iniciar el pago. Estado actual: ${turno.estado}.`,
          409,
          'TURNO_NOT_CONFIRMED'
        )
      }

      // 2.4 Verificar si ya existe un pago APROBADO para este turno
      const pagoAprobado = await tx.pagoTurno.findFirst({
        where: {
          idTurno,
          estado: 'APROBADO',
        },
        include: {
          turno: { include: { medico: true } },
        },
      })

      if (pagoAprobado) {
        throw errorConEstado(
          'Este turno ya cuenta con un pago aprobado registrado.',
          409,
          'PAYMENT_ALREADY_APPROVED'
        )
      }

      // 2.5 Determinar tarifa oficial del servidor
      const { monto, moneda } = obtenerTarifaConsulta(turno.medico?.especialidad)
      const decimalMonto = new Prisma.Decimal(monto)

      // Clave de idempotencia única si no fue enviada por el cliente
      const claveFinal = idempotencyKey || `pago_${idTurno}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // 2.6 Registrar el intento de pago en estado PENDIENTE
      const nuevoPago = await tx.pagoTurno.create({
        data: {
          idTurno,
          idPaciente,
          monto: decimalMonto,
          moneda,
          estado: EstadoPago.PENDIENTE,
          proveedor: PAGOS_CONFIG.PROVEEDOR,
          idempotencyKey: claveFinal,
        },
        include: {
          turno: { include: { medico: true } },
        },
      })

      return {
        pago: this.mapearPagoADTO(nuevoPago),
        idempotent: false,
      }
    })
  }

  /**
   * Procesa el resultado de una transacción (aprobación, rechazo o error técnico).
   * Aplica atomicidad, actualización condicional y protecciones de concurrencia.
   */
  static async procesarResultadoPago(input: ProcesarResultadoPagoInput): Promise<PagoTurnoDTO> {
    const {
      idPago,
      idPaciente,
      resultado,
      transaccionExternaId,
      motivoRechazo,
      codigoError,
    } = input

    if (!idPago || typeof idPago !== 'string') {
      throw errorConEstado('El identificador del pago es requerido.', 400, 'INVALID_PAGO_ID')
    }

    if (!['APROBADO', 'RECHAZADO', 'ERROR'].includes(resultado)) {
      throw errorConEstado('El resultado especificado es inválido.', 400, 'INVALID_RESULT')
    }

    // 1. Obtener pago actual
    const pagoActual = await prisma.pagoTurno.findUnique({
      where: { idPago },
      include: {
        turno: { include: { medico: true } },
      },
    })

    if (!pagoActual) {
      throw errorConEstado('El pago solicitado no existe.', 404, 'PAGO_NOT_FOUND')
    }

    if (idPaciente && pagoActual.idPaciente !== idPaciente) {
      throw errorConEstado(
        'Acceso denegado: el pago no pertenece al paciente indicado.',
        403,
        'FORBIDDEN_PAGO_ACCESS'
      )
    }

    // 2. Idempotencia ante pagos ya aprobados
    if (pagoActual.estado === 'APROBADO') {
      if (resultado === 'APROBADO') {
        return this.mapearPagoADTO(pagoActual)
      }
      throw errorConEstado(
        'No se puede modificar ni rechazar un pago que ya fue aprobado previamente.',
        409,
        'PAYMENT_ALREADY_APPROVED'
      )
    }

    // 3. Verificación de entorno si se utiliza simulación para aprobar
    if (pagoActual.proveedor === 'SIMULADA' && !PAGOS_CONFIG.PERMITIR_SIMULACION) {
      throw errorConEstado(
        'La simulación de pagos se encuentra deshabilitada en este entorno.',
        403,
        'SIMULATION_NOT_ALLOWED'
      )
    }

    // 4. Si se intenta aprobar, verificar que ningún otro proceso haya aprobado un pago concurrente para el mismo turno
    if (resultado === 'APROBADO') {
      const otroAprobado = await prisma.pagoTurno.findFirst({
        where: {
          idTurno: pagoActual.idTurno,
          estado: 'APROBADO',
          idPago: { not: idPago },
        },
      })

      if (otroAprobado) {
        throw errorConEstado(
          'Ya existe otro pago aprobado registrado para este turno.',
          409,
          'PAYMENT_ALREADY_APPROVED'
        )
      }
    }

    // 5. Transición atómica condicional: solo actualizar si sigue en PENDIENTE o PROCESANDO
    const transaccionId = transaccionExternaId || (resultado === 'APROBADO' ? `SIM-${Date.now()}-${pagoActual.idPago.slice(-6)}` : null)
    const fechaAprobacion = resultado === 'APROBADO' ? new Date() : null
    const motivo = resultado === 'RECHAZADO' ? (motivoRechazo || 'Transacción rechazada por fondos insuficientes o tarjeta inválida') : null
    const errorCod = resultado === 'ERROR' ? (codigoError || 'ERROR_COMUNICACION_PASARELA') : null

    const resultadoUpdate = await prisma.pagoTurno.updateMany({
      where: {
        idPago,
        estado: { in: ['PENDIENTE', 'PROCESANDO'] },
      },
      data: {
        estado: resultado as EstadoPago,
        transaccionExternaId: transaccionId,
        motivoRechazo: motivo,
        codigoError: errorCod,
        aprobadoAt: fechaAprobacion,
      },
    })

    if (resultadoUpdate.count !== 1) {
      // Re-consultar para verificar si ya fue procesado concurrentemente
      const refresco = await prisma.pagoTurno.findUniqueOrThrow({
        where: { idPago },
        include: { turno: { include: { medico: true } } },
      })

      if (refresco.estado === resultado) {
        return this.mapearPagoADTO(refresco)
      }

      throw errorConEstado(
        `El estado del pago cambió concurrentemente a ${refresco.estado}.`,
        409,
        'CONCURRENT_MODIFICATION'
      )
    }

    const pagoActualizado = await prisma.pagoTurno.findUniqueOrThrow({
      where: { idPago },
      include: {
        turno: { include: { medico: true } },
      },
    })

    return this.mapearPagoADTO(pagoActualizado)
  }

  /**
   * Consulta el estado de un pago garantizando la titularidad del paciente.
   */
  static async obtenerEstadoPago(idPago: string, idPaciente: string): Promise<PagoTurnoDTO> {
    if (!idPago || typeof idPago !== 'string') {
      throw errorConEstado('El identificador del pago es inválido.', 400, 'INVALID_PAGO_ID')
    }

    const pago = await prisma.pagoTurno.findFirst({
      where: {
        idPago,
        idPaciente,
      },
      include: {
        turno: { include: { medico: true } },
      },
    })

    if (!pago) {
      throw errorConEstado('No se encontró el pago solicitado o no pertenece a tu cuenta.', 404, 'PAGO_NOT_FOUND')
    }

    return this.mapearPagoADTO(pago)
  }

  /**
   * Consulta los pagos asociados a un turno para el paciente autenticado.
   */
  static async obtenerPagosDeTurno(idTurno: string, idPaciente: string): Promise<{
    pagos: PagoTurnoDTO[]
    pagoAprobado: PagoTurnoDTO | null
    tarifaSugerida: { monto: string; moneda: string }
  }> {
    if (!idTurno || typeof idTurno !== 'string') {
      throw errorConEstado('El identificador del turno es inválido.', 400, 'INVALID_TURNO_ID')
    }

    const turno = await prisma.turno.findUnique({
      where: { idTurno },
      include: { medico: true },
    })

    if (!turno) {
      throw errorConEstado('El turno solicitado no existe.', 404, 'TURNO_NOT_FOUND')
    }

    if (turno.idPaciente !== idPaciente) {
      throw errorConEstado('Acceso denegado: el turno no pertenece al paciente.', 403, 'FORBIDDEN_TURNO_ACCESS')
    }

    const pagos = await prisma.pagoTurno.findMany({
      where: {
        idTurno,
        idPaciente,
      },
      include: {
        turno: { include: { medico: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const dtos = pagos.map((p) => this.mapearPagoADTO(p))
    const pagoAprobado = dtos.find((p) => p.estado === 'APROBADO') ?? null
    const tarifaSugerida = obtenerTarifaConsulta(turno.medico?.especialidad)

    return {
      pagos: dtos,
      pagoAprobado,
      tarifaSugerida,
    }
  }

  /**
   * Mapea el modelo de Prisma al DTO seguro expuesto por la API.
   * Garantiza que ningún dato sensible o de infraestructura sea expuesto.
   */
  private static mapearPagoADTO(pago: any): PagoTurnoDTO {
    return {
      idPago: pago.idPago,
      idTurno: pago.idTurno,
      idPaciente: pago.idPaciente,
      monto: pago.monto.toString(),
      moneda: pago.moneda,
      estado: pago.estado,
      proveedor: pago.proveedor,
      transaccionExternaId: pago.transaccionExternaId,
      idempotencyKey: pago.idempotencyKey,
      motivoRechazo: pago.motivoRechazo,
      codigoError: pago.codigoError,
      aprobadoAt: pago.aprobadoAt ? pago.aprobadoAt.toISOString() : null,
      createdAt: pago.createdAt.toISOString(),
      updatedAt: pago.updatedAt.toISOString(),
      turno: pago.turno
        ? {
            idTurno: pago.turno.idTurno,
            fecha: pago.turno.fecha.toISOString().slice(0, 10),
            hora: pago.turno.hora,
            modalidad: pago.turno.modalidad,
            estado: pago.turno.estado,
            medico: {
              nombre: pago.turno.medico.nombre,
              apellido: pago.turno.medico.apellido,
              especialidad: pago.turno.medico.especialidad,
              consultorio: pago.turno.medico.consultorio,
            },
          }
        : undefined,
    }
  }
}
