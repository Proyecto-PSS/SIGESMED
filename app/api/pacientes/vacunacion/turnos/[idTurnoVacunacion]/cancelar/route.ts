import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idTurnoVacunacion: string }> }
) {
  try {
    const paciente = await getCurrentPatient()
    const body = await request.json().catch(() => null)
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''

    if (motivo.length < 3 || motivo.length > 120) {
      return NextResponse.json(
        { error: 'Seleccioná un motivo válido para cancelar el turno.' },
        { status: 400 }
      )
    }

    const { idTurnoVacunacion } = await params
    const resultado = await VacunacionService.cancelarTurnoVacunacionPaciente(
      idTurnoVacunacion,
      paciente.idPaciente,
      motivo
    )
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode || 500
    const message = error instanceof Error ? error.message : 'No se pudo cancelar el turno de vacunación.'
    return NextResponse.json({ ok: false, error: message }, { status: statusCode })
  }
}
