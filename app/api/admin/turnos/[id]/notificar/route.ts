import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { AdminTurnosService } from '@/lib/services/admin-turnos-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Identificador del turno no proporcionado.' }, { status: 400 })
    }

    const resultado = await AdminTurnosService.notificarCancelacion(id)
    return NextResponse.json(resultado, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 500
    const message = error.message || 'Error interno al procesar el envío de la notificación.'
    return NextResponse.json({ error: message, code: error.code }, { status })
  }
}
