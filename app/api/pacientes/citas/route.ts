import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { obtenerCitasPaciente } from '@/lib/services/citas-service'

export async function GET() {
  try {
    const paciente = await getCurrentPatient()
    const citas = await obtenerCitasPaciente(paciente.idPaciente)

    return NextResponse.json({ citas })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudieron obtener las citas'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}