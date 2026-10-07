import { NextRequest, NextResponse } from 'next/server'
import { getCurrentMedicalUser } from '@/lib/auth'
import { AgendaService } from '@/lib/services/agenda-service'

/**
 * GET /api/medicos/disponibilidad?mes=2024-11
 * Obtiene las disponibilidades configuradas para el médico en el mes indicado.
 */
export async function GET(request: NextRequest) {
  try {
    const medico = await getCurrentMedicalUser()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    if (!mes) {
      return NextResponse.json(
        { error: 'El parámetro "mes" (formato YYYY-MM) es obligatorio' },
        { status: 400 }
      )
    }

    const disponibilidades = await AgendaService.obtenerDisponibilidades(medico.id, mes)

    return NextResponse.json({
      mes,
      medico: {
        id: medico.id,
        nombre: `${medico.nombre} ${medico.apellido}`,
        especialidad: medico.especialidad,
      },
      disponibilidades,
    })
  } catch (error: any) {
    const status = error.statusCode || 500
    return NextResponse.json(
      { error: error.message || 'Error interno al consultar disponibilidad' },
      { status }
    )
  }
}

/**
 * POST /api/medicos/disponibilidad
 * Guarda o actualiza la disponibilidad y genera los turnos disponibles del mes.
 * Valida la regla de negocio de máximo 2 días semanales.
 */
export async function POST(request: NextRequest) {
  try {
    const medico = await getCurrentMedicalUser()
    const body = await request.json()

    const { mes_vigencia, dia_semana, hora_desde, hora_hasta, duracion_turno_minutos } = body

    if (!mes_vigencia || !dia_semana || !hora_desde || !hora_hasta || !duracion_turno_minutos) {
      return NextResponse.json(
        {
          error:
            'Campos requeridos: mes_vigencia, dia_semana, hora_desde, hora_hasta, duracion_turno_minutos',
        },
        { status: 400 }
      )
    }

    const { disponibilidad, esNueva, turnosGenerados } = await AgendaService.guardarDisponibilidad(
      medico.id,
      {
        mes_vigencia,
        dia_semana: Number(dia_semana) as any,
        hora_desde,
        hora_hasta,
        duracion_turno_minutos: Number(duracion_turno_minutos) as any,
      }
    )

    return NextResponse.json(
      {
        message: esNueva
          ? 'Disponibilidad creada y turnos generados exitosamente'
          : 'Disponibilidad actualizada y turnos regenerados exitosamente',
        disponibilidad,
        turnos_generados: turnosGenerados,
      },
      { status: esNueva ? 201 : 200 }
    )
  } catch (error: any) {
    const message = error.message || 'Error al guardar disponibilidad'
    const isConflict = message.includes('No se puede modificar')
    const isValidation =
      message.includes('Regla de negocio') ||
      message.includes('inválido') ||
      message.includes('inválida')

    const status = error.statusCode || (isConflict ? 409 : isValidation ? 400 : 500)
    return NextResponse.json({ error: message }, { status })
  }
}
