import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const obrasSociales = new Set([
  'Particular', 'OSDE', 'Swiss Medical', 'Galeno', 'OSECAC', 'UOCRA', 'Medife',
  'PAMI', 'Federada Salud', 'SanCor Salud', 'Avalian', 'IOMA', 'Medicus', 'OMINT', 'OSPE',
])

export async function POST(request: Request) {
  let clerkUserId: string | undefined
  try {
    const body = await request.json()
    const nombre = String(body.nombre ?? '').trim()
    const apellido = String(body.apellido ?? '').trim()
    const dni = String(body.dni ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const telefono = String(body.telefono ?? '').trim() || null
    const obraSocial = String(body.obraSocial ?? '').trim() || null
    const numeroAfiliado = String(body.numeroAfiliado ?? '').trim() || null
    const password = String(body.password ?? '')

    if (!nombre || !apellido || !/^\d{7,8}$/.test(dni) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json({ error: 'Revisá los datos. El DNI debe tener 7 u 8 dígitos y la contraseña al menos 8 caracteres.' }, { status: 400 })
    }
    if (telefono && !/^\d+$/.test(telefono)) {
      return NextResponse.json({ error: 'El teléfono debe contener solo números.' }, { status: 400 })
    }
    if (!obraSocial || !obrasSociales.has(obraSocial)) {
      return NextResponse.json({ error: 'Seleccioná una obra social válida.' }, { status: 400 })
    }
    if (numeroAfiliado && !/^\d+$/.test(numeroAfiliado)) {
      return NextResponse.json({ error: 'El número de afiliado debe contener solo números.' }, { status: 400 })
    }
    if (obraSocial !== 'Particular' && !numeroAfiliado) {
      return NextResponse.json({ error: 'Ingresá el número de afiliado de la obra social.' }, { status: 400 })
    }
    const duplicate = await prisma.paciente.findFirst({ where: { OR: [{ dni }, { email }] }, select: { dni: true, email: true } })
    if (duplicate) return NextResponse.json({ error: duplicate.dni === dni ? 'Ya existe una cuenta con ese DNI.' : 'Ya existe una cuenta con ese email.' }, { status: 409 })

    const client = await clerkClient()
    const user = await client.users.createUser({
      emailAddress: [email], password, firstName: nombre, lastName: apellido,
      publicMetadata: { role: 'paciente' }, skipPasswordRequirement: false,
    })
    clerkUserId = user.id
    await prisma.paciente.create({ data: { idPaciente: user.id, nombre, apellido, dni, email, telefono, obraSocial, numeroAfiliado } })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (clerkUserId) {
      try { await (await clerkClient()).users.deleteUser(clerkUserId) } catch { /* best effort rollback */ }
    }
    const details = error as { code?: string; errors?: Array<{ message?: string }> }
    if (details.code === 'P2002') return NextResponse.json({ error: 'Ya existe una cuenta con ese DNI o email.' }, { status: 409 })
    const clerkErrors = details
    const message = clerkErrors.errors?.[0]?.message
    return NextResponse.json({ error: message || 'No se pudo completar el registro.' }, { status: message ? 409 : 500 })
  }
}
