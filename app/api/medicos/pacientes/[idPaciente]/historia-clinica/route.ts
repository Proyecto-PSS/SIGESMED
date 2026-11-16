import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedico } from '@/lib/auth'
import {
  obtenerFichaClinicaPaciente,
  registrarAtencionClinica,
  HistoriaClinicaError,
} from '@/lib/services/historia-clinica-service'

interface RouteContext {
  params: Promise<{ idPaciente: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await getCurrentMedico()
    const { idPaciente } = await context.params

    const { paciente, atenciones } = await obtenerFichaClinicaPaciente(idPaciente)

    return NextResponse.json({
      ok: true,
      success: true,
      paciente,
      atenciones,
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
            ? 'Error interno al obtener la historia clínica del paciente.'
            : error.message || 'No autorizado.',
      },
      { status }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const medico = await getCurrentMedico()
    const { idPaciente } = await context.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: 'El cuerpo de la solicitud no es un JSON válido.',
        },
        { status: 400 }
      )
    }

    const resultado = await registrarAtencionClinica({
      idMedicoAutenticado: medico.id,
      idPaciente,
      payload: body,
    })

    return NextResponse.json(
      {
        ok: true,
        success: true,
        message: resultado.message,
        atencion: resultado.atencion,
      },
      { status: 201 }
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
            ? 'Error interno al guardar la atención médica en la historia clínica.'
            : error.message || 'No autorizado.',
      },
      { status }
    )
  }
}

