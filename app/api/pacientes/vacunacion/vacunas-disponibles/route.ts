import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function GET() {
  try {
    await getCurrentPatient()
    const vacunas = await VacunacionService.obtenerVacunasConTurnosDisponibles()
    return NextResponse.json({ vacunas })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode || 500
    const message =
      error instanceof Error ? error.message : 'No se pudieron obtener las vacunas disponibles.'
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
