// Servicio de reportes administrativos (RF-15): turnos por especialidad, asistencia, pagos y stock de vacunas.
import { prisma } from '../prisma'
import { EspecialidadMedica } from '../generated/prisma/enums'
import {
  agruparTurnosPorEspecialidad,
  calcularAsistencia,
  clasificarStockVacunas,
  limitesInstantesArgentina,
  parseFechaRango,
  resumirPagos,
  type Asistencia,
  type RangoReporte,
  type ResumenPagos,
  type StockVacuna,
  type TurnosEspecialidad,
} from '../utils/reportes-utils'

export interface ReporteAdministrativoDTO {
  rango: RangoReporte
  turnosReservados: number
  turnosPorEspecialidad: TurnosEspecialidad[]
  asistencia: Asistencia
  pagos: ResumenPagos
  vacunas: StockVacuna[]
}

export class ReportesService {
  /**
   * Arma el reporte del período. Los turnos se filtran por su fecha de atención y los pagos
   * por la fecha en que se registraron. El stock de vacunas es siempre el actual.
   */
  static async obtenerReporte(rango: RangoReporte): Promise<ReporteAdministrativoDTO> {
    const { inicio, fin } = limitesInstantesArgentina(rango)

    const [conteosPorMedico, medicos, gruposPagos, vacunas] = await Promise.all([
      prisma.turno.groupBy({
        by: ['idMedico', 'estado'],
        where: {
          fecha: { gte: parseFechaRango(rango.desde), lte: parseFechaRango(rango.hasta) },
          idPaciente: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.medico.findMany({ select: { idMedico: true, especialidad: true } }),
      prisma.pagoTurno.groupBy({
        by: ['estado'],
        where: { createdAt: { gte: inicio, lt: fin } },
        _count: { _all: true },
        _sum: { monto: true },
      }),
      prisma.vacuna.findMany({ select: { idVacuna: true, nombre: true, stock: true } }),
    ])

    const especialidadPorMedico = new Map(medicos.map((m) => [m.idMedico, m.especialidad]))
    const conteos = conteosPorMedico.map((c) => ({
      especialidad: especialidadPorMedico.get(c.idMedico) ?? 'SIN_ESPECIALIDAD',
      estado: c.estado,
      cantidad: c._count._all,
    }))

    const turnosPorEspecialidad = agruparTurnosPorEspecialidad(conteos, Object.values(EspecialidadMedica))

    return {
      rango,
      turnosReservados: turnosPorEspecialidad.reduce((suma, t) => suma + t.total, 0),
      turnosPorEspecialidad,
      asistencia: calcularAsistencia(turnosPorEspecialidad),
      pagos: resumirPagos(
        gruposPagos.map((g) => ({
          estado: g.estado,
          cantidad: g._count._all,
          monto: Number(g._sum.monto ?? 0),
        }))
      ),
      vacunas: clasificarStockVacunas(vacunas),
    }
  }
}
