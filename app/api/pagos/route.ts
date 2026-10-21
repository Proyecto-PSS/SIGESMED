import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { PagosService } from '@/lib/services/pagos-service'

export async function POST(req: NextRequest) {
  try {
    const paciente = await getCurrentPatient()

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { idTurno } = body
    const headerIdempotency = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key')
    const idempotencyKey = body.idempotencyKey || headerIdempotency || undefined

    if (!idTurno || typeof idTurno !== 'string') {
      return NextResponse.json(
        { error: 'El campo idTurno es obligatorio.' },
        { status: 400 }
      )
    }

    const { pago, idempotent } = await PagosService.iniciarPagoTurno({
      idTurno,
      idPaciente: paciente.idPaciente,
      idempotencyKey,
    })

    return NextResponse.json(
      { pago, idempotent },
      { status: idempotent ? 200 : 201 }
    )
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error interno al iniciar el pago.', code },
      { status }
    )
  }
}
