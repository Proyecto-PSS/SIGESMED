import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedico } from '@/lib/auth'
import {
  buscarPacientePorDni,
  HistoriaClinicaError,
} from '@/lib/services/historia-clinica-service'

export async function GET(request: NextRequest) {
  try {
    await getCurrentMedico()

    const { searchParams } = new URL(request.url)
    const dni = searchParams.get('dni')

    const paciente = await buscarPacientePorDni(dni)

    return NextResponse.json(
      {
        ok: true,
        success: true,
        paciente,
      },
      { status: 200 }
    )
  } catch (error: any) {
    if (error instanceof HistoriaClinicaError) {
      return NextResponse.json(
        { ok: false, success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error:
          status === 500
            ? 'Error interno al buscar al paciente por DNI.'
            : error?.message || 'No autorizado.',
      },
      { status }
    )
  }
}

