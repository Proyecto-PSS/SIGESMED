import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 })

  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'No se encontró la cuenta.' }, { status: 404 })
  const metadata = user.publicMetadata as Record<string, unknown>
  if (metadata.mustChangePassword !== true) {
    if (metadata.mustChangePassword === false) return NextResponse.json({ ok: true, alreadyCompleted: true })
    return NextResponse.json({ error: 'La cuenta no requiere un cambio de contraseña.' }, { status: 409 })
  }

  await (await clerkClient()).users.updateUserMetadata(userId, {
    publicMetadata: { ...metadata, mustChangePassword: false },
  })

  return NextResponse.json({ ok: true })
}
