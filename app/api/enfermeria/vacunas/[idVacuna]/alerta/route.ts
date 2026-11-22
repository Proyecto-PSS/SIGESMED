// US-34: emisión de alerta de stock bajo para una vacuna. Exclusivo del rol Enfermera.
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ idVacuna: string }> }
) {
  try {
    const enfermera = await getCurrentNurseUser()
    const { idVacuna } = await context.params

    const { alerta, vacuna } = await VacunacionService.emitirAlertaStock(idVacuna, enfermera.id)

    return NextResponse.json({
      ok: true,
      mensaje: `Alerta de stock emitida exitosamente para ${vacuna.nombre} (Notificación enviada a Administración).`,
      alerta,
    })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al emitir la alerta de stock.', code: error.code },
      { status: statusCode }
    )
  }
}
