import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedicalUser } from '@/lib/auth'
import { AgendaService } from '@/lib/services/agenda-service'

/**
 * GET /api/medicos/disponibilidad/resumen?mes=2024-11
 * Devuelve el resumen estructurado para el modal de confirmación de publicación (US-04).
 */
export async function GET(request: NextRequest) {
  try {
    const medico = await getCurrentMedicalUser()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    if (!mes) {
      return NextResponse.json(
        { error: 'El parámetro "mes" (formato YYYY-MM) es requerido' },
        { status: 400 }
      )
    }

    const resumen = await AgendaService.obtenerResumenPublicacion(medico.id, mes)

    return NextResponse.json({
      medico: {
        id: medico.id,
        nombre: `${medico.nombre} ${medico.apellido}`,
        especialidad: medico.especialidad,
      },
      ...resumen,
    })
  } catch (error: any) {
    const message = error.message || 'Error al obtener resumen de publicación'
    const status = error.statusCode || 400
    return NextResponse.json(
      {
        success: false,
        error: message,
        message,
        ...(error.code ? { code: error.code } : {}),
      },
      { status }
    )
  }
}
