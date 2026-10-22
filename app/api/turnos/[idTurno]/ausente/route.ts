import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { marcarTurnoAusente } from '@/lib/services/citas-service'

export async function POST(_request: Request, { params }: { params: Promise<{ idTurno: string }> }) {
  try {
    const usuario = await getCurrentUser()
    if (!usuario) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 })
    if (usuario.rol !== 'MEDICO' && usuario.rol !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo médicos y administradores pueden registrar ausencias.' }, { status: 403 })
    }
    const { idTurno } = await params
    const turno = await marcarTurnoAusente(idTurno, { id: usuario.id, rol: usuario.rol })
    return NextResponse.json({ turno: { idTurno: turno.idTurno, estado: turno.estado } })
  } catch (error) {
    const err = error as Error & { statusCode?: number }
    return NextResponse.json({ error: err.message || 'No se pudo registrar la ausencia.' }, { status: err.statusCode || 500 })
  }
}
