import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { PagosService } from '@/lib/services/pagos-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ idTurno: string }> }
) {
  try {
    const paciente = await getCurrentPatient()
    const { idTurno } = await params

    if (!idTurno) {
      return NextResponse.json(
        { error: 'El identificador del turno es obligatorio.' },
        { status: 400 }
      )
    }

    const info = await PagosService.obtenerPagosDeTurno(idTurno, paciente.idPaciente)
    return NextResponse.json(info, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error al consultar pagos del turno.', code },
      { status }
    )
  }
}
