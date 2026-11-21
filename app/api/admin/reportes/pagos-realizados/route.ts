import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdminUser } from '@/lib/auth'
import { ReportesService } from '@/lib/services/reportes-service'
import { ejecutarReportePagosRealizados } from '@/lib/utils/reportes-pagos-utils'

// US-42: GET /api/admin/reportes/pagos-realizados?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const { status, body } = await ejecutarReportePagosRealizados({
    autorizar: getCurrentAdminUser,
    obtenerReporte: (fechaDesde, fechaHasta) =>
      ReportesService.obtenerPagosRealizados(fechaDesde, fechaHasta),
    fechaDesde: searchParams.get('fechaDesde'),
    fechaHasta: searchParams.get('fechaHasta'),
    registrarError: (error) => console.error('[US-42] Error al generar el reporte de pagos:', error),
  })

  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
