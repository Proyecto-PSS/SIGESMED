import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedicalUser } from '@/lib/auth'
import { AgendaService } from '@/lib/services/agenda-service'

/**
 * PUT /api/medicos/disponibilidad/[id]
 * Modifica una disponibilidad y regenera sus turnos disponibles.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const medico = await getCurrentMedicalUser()
    const { id } = await params
    const body = await request.json()

    const { mes_vigencia, dia_semana, hora_desde, hora_hasta, duracion_turno_minutos } = body

    if (!mes_vigencia || !dia_semana || !hora_desde || !hora_hasta || !duracion_turno_minutos) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos para la modificación' },
        { status: 400 }
      )
    }

    const { disponibilidad } = await AgendaService.guardarDisponibilidad(medico.id, {
      mes_vigencia,
      dia_semana: Number(dia_semana) as any,
      hora_desde,
      hora_hasta,
      duracion_turno_minutos: Number(duracion_turno_minutos) as any,
    })

    return NextResponse.json({
      message: 'Disponibilidad modificada exitosamente',
      disponibilidad,
    })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json({ error: error.message }, { status })
  }
}

/**
 * DELETE /api/medicos/disponibilidad/[id]
 * Elimina una disponibilidad y sus turnos libres asociados.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const medico = await getCurrentMedicalUser()
    const { id } = await params

    await AgendaService.eliminarDisponibilidad(medico.id, id)

    return NextResponse.json({
      success: true,
      message: 'Configuración eliminada exitosamente',
    })
  } catch (error: any) {
    const message = error.message || 'Error al eliminar configuración'
    const status = error.statusCode || (message.includes('No se puede eliminar') ? 409 : 400)
    return NextResponse.json({ error: message }, { status })
  }
}
