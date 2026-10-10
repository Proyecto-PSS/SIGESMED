// Consulta de pacientes para selección en mostrador de vacunatorio (US-20).
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function GET() {
  try {
    await getCurrentNurseUser()
    const pacientes = await VacunacionService.obtenerPacientes()
    return NextResponse.json({ ok: true, pacientes })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener pacientes.' },
      { status: statusCode }
    )
  }
}
