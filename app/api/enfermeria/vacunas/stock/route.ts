// Consulta de inventario de vacunas y disponibilidad por lote (US-20).
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function GET() {
  try {
    await getCurrentNurseUser()
    const stock = await VacunacionService.obtenerStockVacunas()
    return NextResponse.json({ ok: true, stock })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al consultar stock de vacunas.' },
      { status: statusCode }
    )
  }
}
