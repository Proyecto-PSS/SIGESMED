import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedicalUser } from '@/lib/auth'
import { AgendaService } from '@/lib/services/agenda-service'

/**
 * GET /api/medicos/agenda?mes=2024-11&vista=mensual|semanal&fecha=2024-11-04
 * Consulta la agenda de turnos generados para el médico autenticado (US-05).
 */
export async function GET(request: NextRequest) {
  try {
    const medico = await getCurrentMedicalUser()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    const vista = (searchParams.get('vista') as 'mensual' | 'semanal') || 'mensual'
    const fecha = searchParams.get('fecha') || undefined

    if (!mes) {
      return NextResponse.json(
        { error: 'El parámetro "mes" (formato YYYY-MM) es requerido' },
        { status: 400 }
      )
    }

    const turnos = await AgendaService.obtenerAgendaTurnos(
      medico.id,
      mes,
      vista,
      fecha
    )

    return NextResponse.json({
      mes,
      vista,
      medico: {
        id: medico.id,
        nombre: `${medico.nombre} ${medico.apellido}`,
        especialidad: medico.especialidad,
        matricula: medico.matricula,
      },
      total_turnos: turnos.length,
      turnos,
    })
  } catch (error: any) {
    const status = error.statusCode || 500
    return NextResponse.json(
      { error: error.message || 'Error al consultar la agenda médica' },
      { status }
    )
  }
}
