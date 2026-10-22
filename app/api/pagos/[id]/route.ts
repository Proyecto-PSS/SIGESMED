import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { PagosService } from '@/lib/services/pagos-service'

export async function GET(
  _req: NextRequest,
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

    const pago = await PagosService.obtenerEstadoPago(idPago, paciente.idPaciente)
    return NextResponse.json({ pago }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error al obtener el pago.', code },
      { status }
    )
  }
}
