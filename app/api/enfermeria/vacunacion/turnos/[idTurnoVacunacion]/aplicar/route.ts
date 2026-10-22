// Confirmación de aplicación efectiva de dosis de vacuna (US-20).
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

    const turno = await VacunacionService.aplicarTurnoVacunacion(idTurnoVacunacion)
    return NextResponse.json({ ok: true, turno })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al registrar aplicación de vacuna.' },
      { status: statusCode }
    )
  }
}
