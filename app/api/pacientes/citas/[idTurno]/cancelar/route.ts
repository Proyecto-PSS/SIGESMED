import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { cancelarCitaPaciente } from '@/lib/services/citas-service'

export async function POST(
  request: Request,
  context: {
    params: Promise<{ idTurno: string }>
  }
) {
  try {
    const paciente = await getCurrentPatient()

    const { idTurno } = await context.params

    const turno = await cancelarCitaPaciente(
      idTurno,
      paciente.idPaciente
    )

    return NextResponse.json({
      mensaje: 'Turno cancelado correctamente',
      turno,
    })
  } catch (error) {
    const statusCode =
      error instanceof Error &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500

    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo cancelar el turno'

    return NextResponse.json(
      { error: message },
      { status: statusCode }
    )
  }
}