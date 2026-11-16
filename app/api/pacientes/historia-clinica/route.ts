import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import {
  obtenerHistorialClinicoPropioPaciente,
  HistoriaClinicaError,
} from '@/lib/services/historia-clinica-service'

export async function GET() {
  try {
    // Resuelve estrictamente la identidad del paciente autenticado desde la sesión en servidor.
    // Se ignora cualquier parámetro externo (protección contra IDOR - RF-39.6).
    const paciente = await getCurrentPatient()

    const atenciones = await obtenerHistorialClinicoPropioPaciente(paciente.idPaciente)

    return NextResponse.json(
      {
        ok: true,
        success: true,
        atenciones,
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
            ? 'No se pudo consultar el historial clínico en este momento.'
            : error.message || 'No autorizado.',
      },
      { status }
    )
  }
}

