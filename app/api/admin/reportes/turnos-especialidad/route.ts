import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdminUser } from '@/lib/auth'
import {
  ReportesService,
  ReporteTurnosEspecialidadError,
} from '@/lib/services/reportes-service'

export async function GET(request: NextRequest) {
  try {
    await getCurrentAdminUser()

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde') ?? searchParams.get('desde')
    const fechaHasta = searchParams.get('fechaHasta') ?? searchParams.get('hasta')

    const reporte = await ReportesService.obtenerTurnosPorEspecialidad(
      fechaDesde,
      fechaHasta
    )

    return NextResponse.json(
      {
        ok: true,
        success: true,
        ...reporte,
      },
      { status: 200 }
    )
  } catch (error: any) {
    if (error instanceof ReporteTurnosEspecialidadError) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: error.message,
        },
        { status: error.statusCode }
      )
    }

    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error:
          status === 500
            ? 'Error interno al generar el reporte de turnos por especialidad.'
            : error?.message || 'No autorizado.',
      },
      { status }
    )
  }
}

