import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { PagosService } from '@/lib/services/pagos-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paciente = await getCurrentPatient()
    const { id: idPago } = await params

    if (!idPago) {
      return NextResponse.json(
        { error: 'El identificador del pago es obligatorio.' },
        { status: 400 }
      )
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { resultado, motivoRechazo, codigoError, transaccionExternaId } = body

    if (!resultado || !['APROBADO', 'RECHAZADO', 'ERROR'].includes(resultado)) {
      return NextResponse.json(
        { error: 'El resultado debe ser APROBADO, RECHAZADO o ERROR.' },
        { status: 400 }
      )
    }

    const pagoActualizado = await PagosService.procesarResultadoPago({
      idPago,
      idPaciente: paciente.idPaciente,
      resultado,
      transaccionExternaId,
      motivoRechazo,
      codigoError,
    })

    return NextResponse.json({ pago: pagoActualizado }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error al procesar el pago.', code },
      { status }
    )
  }
}
