// Consulta y creación express de turnos de vacunación (US-20).
import { NextResponse } from 'next/server'
import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'

export async function GET(request: Request) {
  try {
    await getCurrentNurseUser()
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado') as any
    const fecha = searchParams.get('fecha') || undefined
    const idVacuna = searchParams.get('idVacuna') || undefined

    const turnos = await VacunacionService.obtenerTurnosVacunacion({
      estado,
      fecha,
      idVacuna,
    })

    return NextResponse.json({ ok: true, turnos })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al consultar turnos de vacunación.' },
      { status: statusCode }
    )
  }
}

export async function POST(request: Request) {
  try {
    const enfermera = await getCurrentNurseUser()
    const body = await request.json()

    const { idVacuna, fecha, hora, idPaciente, idLote } = body

    if (!idVacuna || !fecha || !hora) {
      return NextResponse.json(
        { ok: false, error: 'idVacuna, fecha y hora son obligatorios.' },
        { status: 400 }
      )
    }

    const idempotencyKey =
      body.idempotencyKey ||
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined

    // Si viene con idPaciente, podemos crear el turno express e invocar la asignación atómica
    const turno = await VacunacionService.crearTurnoVacunacionExpress({
      idEnfermero: enfermera.id,
      idVacuna,
      fecha,
      hora,
      idLote,
      idempotencyKey,
    })

    if (idPaciente) {
      const resultado = await VacunacionService.asignarTurnoVacunacion({
        idTurnoVacunacion: turno.idTurnoVacunacion,
        idPaciente,
        idVacuna,
        idLote,
        idEnfermero: enfermera.id,
        idempotencyKey,
      })
      return NextResponse.json({ ok: true, turno: resultado.turno }, { status: 201 })
    }

    return NextResponse.json({ ok: true, turno }, { status: 201 })
  } catch (error: any) {
    const statusCode = error.statusCode || 500
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al crear turno de vacunación.' },
      { status: statusCode }
    )
  }
}
