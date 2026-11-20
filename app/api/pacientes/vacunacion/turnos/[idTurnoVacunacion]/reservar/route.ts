import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idTurnoVacunacion: string }> }
) {
  try {
    const paciente = await getCurrentPatient()
    const { idTurnoVacunacion } = await params
    const body = await request.json().catch(() => ({}))
    const idempotencyKey: string | undefined =
      typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : undefined

    const resultado = await VacunacionService.reservarTurnoVacunacionPaciente(
      idTurnoVacunacion,
      paciente.idPaciente,
      idempotencyKey
    )

    return NextResponse.json({ turno: resultado.turno, idempotent: resultado.idempotent })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode || 500
    const code = (error as { code?: string })?.code
    const message =
      error instanceof Error ? error.message : 'No se pudo reservar el turno de vacunación.'
    return NextResponse.json({ error: message, code }, { status: statusCode })
  }
}
