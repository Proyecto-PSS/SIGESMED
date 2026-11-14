// US-32: actualización del stock de una vacuna a una cantidad nueva (0 o más). Exclusivo del rol Enfermera.
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function PUT(request: Request, context: { params: Promise<{ idVacuna: string }> }) {
  try {
    const enfermera = await getCurrentNurseUser()
    const { idVacuna } = await context.params
    const body = await request.json().catch(() => null)

    const { vacuna, sinCambios } = await VacunacionService.actualizarStock(idVacuna, body, enfermera.id)
    const mensaje = sinCambios
      ? 'La cantidad ingresada es igual al stock actual; no hubo cambios.'
      : `Stock de "${vacuna.nombre}" actualizado a ${vacuna.stock} dosis.`

    return NextResponse.json({ ok: true, mensaje, vacuna })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al actualizar el stock.', code: error.code },
      { status: statusCode }
    )
  }
}
