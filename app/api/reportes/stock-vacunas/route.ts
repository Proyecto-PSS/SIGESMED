import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ReportesService } from '@/lib/services/reportes-service'

export async function GET() {
  try {
    const usuario = await getCurrentUser()
    if (!usuario) {
      return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 })
    }
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'ENFERMERA') {
      return NextResponse.json(
        { error: 'Acceso denegado: el reporte está disponible solo para Administración y Enfermería.' },
        { status: 403 }
      )
    }

    const vacunas = await ReportesService.obtenerStockVacunas()
    return NextResponse.json({ vacunas })
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode || 500
    const message = error instanceof Error ? error.message : 'No se pudo consultar el stock de vacunas.'
    return NextResponse.json({ error: message }, { status })
  }
}
