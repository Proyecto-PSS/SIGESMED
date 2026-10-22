// Cancelación de turno de vacunación y liberación de stock comprometido (US-20).
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idTurnoVacunacion: string }> }
) {
  try {
    await getCurrentNurseUser()
    const { idTurnoVacunacion } = await params

    let motivo = 'Cancelado desde panel de enfermería'
    try {
      const body = await request.json()
      if (body.motivo) motivo = body.motivo
    } catch {
      // Body opcional
    }

    const turno = await VacunacionService.cancelarTurnoVacunacion(idTurnoVacunacion, motivo)
    return NextResponse.json({ ok: true, turno })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al cancelar turno de vacunación.' },
      { status: statusCode }
    )
  }
}
