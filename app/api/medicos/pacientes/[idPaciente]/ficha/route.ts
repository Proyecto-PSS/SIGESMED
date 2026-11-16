import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedico } from '@/lib/auth'
import {
  obtenerDetalleFichaPaciente,
  HistoriaClinicaError,
} from '@/lib/services/historia-clinica-service'

interface RouteContext {
  params: Promise<{ idPaciente: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await getCurrentMedico()
    const { idPaciente } = await context.params

    const detalle = await obtenerDetalleFichaPaciente(idPaciente)

    return NextResponse.json(
      {
        ok: true,
        success: true,
        paciente: detalle.paciente,
        atenciones: detalle.atenciones,
        sinRegistrosClinicos: detalle.sinRegistrosClinicos,
        mensajeHistorialVacio: detalle.mensajeHistorialVacio,
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
            ? 'Error interno al consultar la ficha clínica del paciente.'
            : error?.message || 'No autorizado.',
      },
      { status }
    )
  }
}

