import { NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const obrasSociales = new Set([
  'OSDE', 'Swiss Medical', 'Galeno', 'OSECAC', 'UOCRA', 'Medife', 'PAMI',
  'Federada Salud', 'SanCor Salud', 'Avalian', 'IOMA', 'Medicus', 'OMINT', 'OSPE',
])

export async function PATCH(request: Request) {
  try {
    const paciente = await getCurrentPatient()
    const body = await request.json()
    const obraSocial = String(body.obraSocial ?? '').trim()
    const numeroAfiliado = String(body.numeroAfiliado ?? '').trim()
    const plan = String(body.plan ?? '').trim()
    if (!obrasSociales.has(obraSocial)) {
      return NextResponse.json({ error: 'Seleccioná una obra social válida.' }, { status: 400 })
    }
    if (!/^\d{4,20}$/.test(numeroAfiliado)) {
      return NextResponse.json(
        { error: 'El número de afiliado debe contener entre 4 y 20 dígitos, sin espacios ni letras.' },
        { status: 400 }
      )
    }
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .-]{0,29}$/u.test(plan)) {
      return NextResponse.json(
        { error: 'Ingresá un plan válido, por ejemplo 310 o Plan Básico.' },
        { status: 400 }
      )
    }
    await prisma.paciente.update({
      where: { idPaciente: paciente.idPaciente },
      data: { obraSocial, numeroAfiliado, plan },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar la cobertura.' }, { status: statusCode })
  }
}
