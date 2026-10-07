// Endpoint de confirmación atómica de una reserva de turno.
import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { confirmarTurno } from '@/lib/services/reserva-service'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ idTurno: string }> }
) {
  try {
    const { idTurno } = await params
    const paciente = await getCurrentPatient()
    const turno = await confirmarTurno(idTurno, paciente.idPaciente)

    return NextResponse.json({ turno })
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
    const message = error instanceof Error ? error.message : 'No se pudo confirmar el turno'
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
