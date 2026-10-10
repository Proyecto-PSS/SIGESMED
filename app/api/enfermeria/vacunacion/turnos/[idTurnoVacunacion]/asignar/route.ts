// Asignación atómica y concurrente de turno de vacunación y reserva de dosis (US-20).
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idTurnoVacunacion: string }> }
) {
  try {
    const enfermera = await getCurrentNurseUser()
    const { idTurnoVacunacion } = await params

    if (!idTurnoVacunacion) {
      return NextResponse.json(
        { ok: false, error: 'Identificador de turno de vacunación inválido.' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const idempotencyKey =
      body.idempotencyKey ||
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined

    const resultado = await VacunacionService.asignarTurnoVacunacion({
      idTurnoVacunacion,
      idPaciente: body.idPaciente,
      idVacuna: body.idVacuna,
      idLote: body.idLote,
      idEnfermero: enfermera.id,
      idempotencyKey,
    })

    return NextResponse.json(
      {
        ok: true,
        ...resultado,
      },
      { status: resultado.idempotent ? 200 : 201 }
    )
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    const code = error.code || (statusCode === 409 ? 'CONCURRENCY_CONFLICT' : 'ERROR')

    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error al asignar el turno de vacunación.',
        code,
      },
      { status: statusCode }
    )
  }
}
