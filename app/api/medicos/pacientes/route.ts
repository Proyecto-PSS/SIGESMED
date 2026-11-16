import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedico } from '@/lib/auth'
import {
  buscarPacientesFichaClinica,
  HistoriaClinicaError,
} from '@/lib/services/historia-clinica-service'

export async function GET(request: NextRequest) {
  try {
    await getCurrentMedico()

    const { searchParams } = new URL(request.url)
    const busqueda = searchParams.get('q') ?? searchParams.get('busqueda') ?? ''

    const pacientes = await buscarPacientesFichaClinica(busqueda)

    return NextResponse.json({
      ok: true,
      success: true,
      pacientes,
    })
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
            ? 'Error interno al consultar el listado de pacientes.'
            : error.message || 'No autorizado.',
      },
      { status }
    )
  }
}

