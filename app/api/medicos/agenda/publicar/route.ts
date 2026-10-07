import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedicalUser } from '@/lib/auth'
import { AgendaService } from '@/lib/services/agenda-service'

/**
 * POST /api/medicos/agenda/publicar
 * Publicación atómica de la agenda mensual y generación de turnos en estado DISPONIBLE (US-04).
 */
export async function POST(request: NextRequest) {
  try {
    const medico = await getCurrentMedicalUser()
    const body = await request.json()
    const { mes_vigencia } = body

    if (!mes_vigencia) {
      return NextResponse.json(
        { error: 'El campo "mes_vigencia" es obligatorio (formato YYYY-MM)' },
        { status: 400 }
      )
    }

    const resultado = await AgendaService.publicarAgenda(medico.id, mes_vigencia)

    return NextResponse.json(resultado, { status: 200 })
  } catch (error: any) {
    const message = error.message || 'Error al publicar agenda'
    const status =
      error.statusCode ||
      (message.includes('No hay configuraciones') ? 400 : message.includes('supera') ? 409 : 500)

    return NextResponse.json({ error: message }, { status })
  }
}
