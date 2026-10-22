// Endpoint de consulta de estado de idempotencia para la reserva de turnos (US-18).
import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import {
  consultarEstadoReserva,
  consultarEstadoReservaPorKey,
} from '@/lib/services/reserva-service'

export async function GET(request: Request) {
  try {
    const paciente = await getCurrentPatient()
    const { searchParams } = new URL(request.url)
    const idempotencyKey =
      searchParams.get('idempotencyKey') ||
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined
    const turnoId =
      searchParams.get('turnoId') ||
      searchParams.get('idTurno') ||
      undefined

    if (!idempotencyKey && !turnoId) {
      return NextResponse.json(
        { error: 'Se requiere idempotencyKey o turnoId', status: 'NO_ENCONTRADO' },
        { status: 400 }
      )
    }

    if (turnoId) {
      const resultado = await consultarEstadoReserva(
        turnoId,
        paciente.idPaciente,
        idempotencyKey
      )
      return NextResponse.json(resultado)
    }

    const resultado = await consultarEstadoReservaPorKey(
      idempotencyKey!,
      paciente.idPaciente
    )
    return NextResponse.json(resultado)
  } catch (error) {
    const customError = error as Error & { statusCode?: number }
    const statusCode = customError.statusCode ?? 500
    const message = error instanceof Error ? error.message : 'Error al verificar la reserva'
    return NextResponse.json({ error: message, status: 'ERROR' }, { status: statusCode })
  }
}
