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

    const { buffer, mimeType, nombreArchivo, tamanoBytes } =
      await ComprobantePagoService.descargarComprobante(idPago, paciente.idPaciente)

    // Devolver el archivo binario PDF con encabezados seguros
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Content-Length': tamanoBytes.toString(),
        'Cache-Control': 'private, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'

    return NextResponse.json(
      { error: error.message || 'Error al descargar el comprobante.', code },
      { status }
    )
  }
}
