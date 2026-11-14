import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function GET() {
  try {
    const paciente = await getCurrentPatient()
    const turnos = await VacunacionService.obtenerTurnosVacunacionPaciente(paciente.idPaciente)
    return NextResponse.json({ turnos })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode || 500
    const message = error instanceof Error ? error.message : 'No se pudieron obtener los turnos de vacunación.'
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
