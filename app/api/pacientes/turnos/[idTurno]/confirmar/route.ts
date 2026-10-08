// Endpoint de confirmación atómica y resiliente de una reserva de turno (US-09 y US-18).
import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { confirmarTurno, consultarEstadoReserva } from '@/lib/services/reserva-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idTurno: string }> }
) {
  try {
    const { idTurno } = await params
    const paciente = await getCurrentPatient()

    let body: {
      idempotencyKey?: string
      modalidad?: 'PARTICULAR' | 'COBERTURA'
    } = {}

    try {
      body = await request.json()
    } catch {
      // Body es opcional para compatibilidad hacia atrás
    }

    const idempotencyKey =
      body.idempotencyKey ||
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined

    const modalidad = body.modalidad || 'PARTICULAR'

    const resultado = await confirmarTurno(idTurno, paciente.idPaciente, {
      idempotencyKey,
      modalidad,
    })

    return NextResponse.json({
      success: true,
      idempotent: resultado.idempotent,
      turno: resultado.turno,
      reservation: {
        id: resultado.turno.idTurno,
        turnoId: resultado.turno.idTurno,
        estado: resultado.turno.estado,
      },
    })
  } catch (error) {
    const customError = error as Error & { statusCode?: number; code?: string }
    const statusCode = customError.statusCode ?? 500
    const message = error instanceof Error ? error.message : 'No se pudo confirmar el turno'

    return NextResponse.json(
      {
        success: false,
        code: customError.code ?? (statusCode === 409 ? 'TURN_ALREADY_RESERVED' : 'ERROR'),
        error: message,
        message,
      },
      { status: statusCode }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ idTurno: string }> }
) {
  try {
    const { idTurno } = await params
    const paciente = await getCurrentPatient()

    const { searchParams } = new URL(request.url)
    const idempotencyKey =
      searchParams.get('idempotencyKey') ||
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined

    const resultado = await consultarEstadoReserva(
      idTurno,
      paciente.idPaciente,
      idempotencyKey
    )

    return NextResponse.json(resultado)
  } catch (error) {
    const customError = error as Error & { statusCode?: number }
    const statusCode = customError.statusCode ?? 500
    const message = error instanceof Error ? error.message : 'Error al verificar la reserva'
    return NextResponse.json({ error: message, status: 'ERROR' }, { status: statusCode })
  }
}
