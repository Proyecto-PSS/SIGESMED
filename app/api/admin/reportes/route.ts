import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ReportesService } from '@/lib/services/reportes-service'
import { resolverRangoReporte } from '@/lib/utils/reportes-utils'

// RF-15: reportes administrativos del período indicado (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD).
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 })
    }
    if (user.rol !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado: se requieren permisos de administrador.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const resultado = resolverRangoReporte(searchParams.get('desde'), searchParams.get('hasta'))
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, code: 'INVALID_RANGE' }, { status: 400 })
    }

    const reporte = await ReportesService.obtenerReporte(resultado.rango)
    return NextResponse.json(reporte, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 500
    const message = error.message || 'Error interno al generar el reporte.'
    return NextResponse.json({ error: message, code: error.code }, { status })
  }
}
