import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { AdminTurnosService } from '@/lib/services/admin-turnos-service'
import { EstadoTurno } from '@/lib/generated/prisma/client'

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
    const paciente = searchParams.get('paciente') || undefined
    const fecha = searchParams.get('fecha') || undefined
    const estadoParam = searchParams.get('estado') || undefined
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')

    let estado: EstadoTurno | undefined = undefined
    if (estadoParam) {
      if (!Object.values(EstadoTurno).includes(estadoParam as EstadoTurno)) {
        return NextResponse.json(
          { error: `Estado inválido. Los valores permitidos son: ${Object.values(EstadoTurno).join(', ')}.` },
          { status: 400 }
        )
      }
      estado = estadoParam as EstadoTurno
    }

    const page = pageParam ? parseInt(pageParam, 10) : undefined
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : undefined

    const resultado = await AdminTurnosService.consultarTurnos({
      paciente,
      fecha,
      estado,
      page,
      pageSize,
    })

    return NextResponse.json(resultado, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 500
    const message = error.message || 'Error interno del servidor al consultar turnos.'
    return NextResponse.json({ error: message, code: error.code }, { status })
  }
}
