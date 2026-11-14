// US-31: alta de vacuna. Exclusivo del rol Enfermera.
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(request: Request) {
  try {
    const enfermera = await getCurrentNurseUser()
    const body = await request.json().catch(() => null)
    const vacuna = await VacunacionService.registrarVacuna(body, enfermera.id)

    return NextResponse.json(
      { ok: true, mensaje: `Vacuna "${vacuna.nombre}" registrada con éxito en el inventario.`, vacuna },
      { status: 201 }
    )
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al registrar la vacuna.', code: error.code },
      { status: statusCode }
    )
  }
}
