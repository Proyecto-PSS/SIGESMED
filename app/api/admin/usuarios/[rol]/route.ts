import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { puedeRegistrarProfesionales, validarAltaProfesional, type TipoProfesional } from '@/lib/validation/profesional'

type Rol = 'medico' | 'enfermera'

export async function POST(request: Request, context: { params: Promise<{ rol: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 })
  const identity = await currentUser()
  const trustedRole = (identity?.publicMetadata as { role?: string } | undefined)?.role
  if (!puedeRegistrarProfesionales(trustedRole)) return NextResponse.json({ error: 'Solo un administrador puede registrar profesionales.' }, { status: 403 })

  const { rol } = await context.params
  if (rol !== 'medico' && rol !== 'enfermera') return NextResponse.json({ error: 'Rol no válido.' }, { status: 404 })
  let clerkUserId: string | undefined
  try {
    const parsed = validarAltaProfesional(rol as TipoProfesional, await request.json())
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { nombre, apellido, email, matricula, especialidad } = parsed.datos
    const duplicate = rol === 'medico'
      ? await prisma.medico.findFirst({ where: { OR: [{ email }, { matricula }] } })
      : await prisma.enfermero.findFirst({ where: { OR: [{ email }, { matricula }] } })
    if (duplicate) return NextResponse.json({ error: 'Ya existe un profesional con ese email o matrícula.' }, { status: 409 })

    const passwordProvisoria = `${randomBytes(18).toString('base64url')}Aa1!`
    const user = await (await clerkClient()).users.createUser({
      emailAddress: [email], password: passwordProvisoria, firstName: nombre, lastName: apellido,
      publicMetadata: { role: rol, mustChangePassword: true }, skipPasswordRequirement: false,
    })
    clerkUserId = user.id
    if (rol === 'medico') {
      await prisma.medico.create({ data: { idMedico: user.id, nombre, apellido, email, matricula, especialidad: especialidad! } })
    } else {
      await prisma.enfermero.create({ data: { idEnfermero: user.id, nombre, apellido, email, matricula } })
    }
    return NextResponse.json({ ok: true, email, passwordProvisoria, aviso: 'Entregá esta contraseña por un canal seguro; no volverá a mostrarse.' }, { status: 201 })
  } catch (error) {
    if (clerkUserId) {
      try { await (await clerkClient()).users.deleteUser(clerkUserId) } catch { /* best effort rollback */ }
    }
    const details = error as { code?: string; errors?: Array<{ message?: string }> }
    if (details.code === 'P2002') return NextResponse.json({ error: 'Ya existe un profesional con ese email o matrícula.' }, { status: 409 })
    const clerkErrors = details
    const message = clerkErrors.errors?.[0]?.message
    return NextResponse.json({ error: message || 'No se pudo completar el alta.' }, { status: message ? 409 : 500 })
  }
}
