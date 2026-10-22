// Registro y auditoría atómica de movimientos de stock de vacunas (US-20).
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function POST(request: Request) {
  try {
    const enfermera = await getCurrentNurseUser()
    const body = await request.json()

    const idempotencyKey =
      body.idempotencyKey ||
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined

    const resultado = await VacunacionService.registrarMovimientoStock({
      ...body,
      idEnfermero: enfermera.id,
      idempotencyKey,
    })

    return NextResponse.json(
      {
        ok: true,
        ...resultado,
      },
      { status: resultado.idempotent ? 200 : 201 }
    )
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    const code = error.code || (statusCode === 409 ? 'STOCK_CONFLICT' : 'ERROR')
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error al registrar movimiento de inventario.',
        code,
      },
      { status: statusCode }
    )
  }
}

export async function GET(request: Request) {
  try {
    await getCurrentNurseUser()
    const { searchParams } = new URL(request.url)
    const idVacuna = searchParams.get('idVacuna') || undefined
    const movimientos = await VacunacionService.obtenerHistorialMovimientos(idVacuna)
    return NextResponse.json({ ok: true, movimientos })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener historial.' },
      { status: statusCode }
    )
  }
}
