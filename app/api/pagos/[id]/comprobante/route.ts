import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { ComprobantePagoService } from '@/lib/services/comprobante-pago-service'

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

    const comprobante = await ComprobantePagoService.obtenerComprobantePorPago(
      idPago,
      paciente.idPaciente
    )

    return NextResponse.json({ comprobante }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error al obtener el comprobante de pago.', code },
      { status }
    )
  }
}

export async function POST(
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

    // Verificar propiedad antes de forzar reintento
    const comprobante = await ComprobantePagoService.obtenerComprobantePorPago(
      idPago,
      paciente.idPaciente
    )

    const resultado = await ComprobantePagoService.generarComprobantePago(idPago)
    return NextResponse.json({ comprobante: resultado }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error al reintentar generar el comprobante.', code },
      { status }
    )
  }
}
