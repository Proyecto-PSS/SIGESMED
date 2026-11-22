// US-35: habilitación de días y horarios de vacunación. Exclusivo del rol Enfermera.
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(request: Request) {
  try {
    const enfermera = await getCurrentNurseUser()
    const body = await request.json()

    const resultado = await VacunacionService.habilitarDiaVacunacion(body, enfermera.id)

    return NextResponse.json({
      ok: true,
      mensaje: `Día de vacunación habilitado con éxito. Se habilitaron ${resultado.turnosHabilitados} turnos para ${resultado.vacuna.nombre}.`,
      data: resultado,
    })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al habilitar el día de vacunación.', code: error.code },
      { status: statusCode }
    )
  }
}
