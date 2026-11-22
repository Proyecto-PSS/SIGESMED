import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdminUser } from '@/lib/auth'
import { ReportesService } from '@/lib/services/reportes-service'
import { ejecutarReporteAsistencia } from '@/lib/utils/reportes-asistencia-utils'

// US-43: GET /api/admin/reportes/asistencia?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const { status, body } = await ejecutarReporteAsistencia({
    autorizar: getCurrentAdminUser,
    obtenerReporte: (fechaDesde, fechaHasta) =>
      ReportesService.obtenerAsistenciaPacientes(fechaDesde, fechaHasta),
    fechaDesde: searchParams.get('fechaDesde'),
    fechaHasta: searchParams.get('fechaHasta'),
    registrarError: (error) => console.error('[US-43] Error al generar el reporte de asistencia:', error),
  })

  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
