import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const dashboardRoutes = createRouteMatcher(['/dashboard/(.*)'])
const roleDashboard: Record<string, string> = {
  paciente: '/dashboard/paciente',
  medico: '/dashboard/medico',
  enfermera: '/dashboard/enfermero',
  admin: '/dashboard/admin',
}

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()
  const path = request.nextUrl.pathname

  if (dashboardRoutes(request) && !userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
  if (!userId) return NextResponse.next()

  // Clerk's session token may not contain custom metadata unless the instance
  // has a session claim configured. Read backend metadata for protected app pages.
  const needsIdentity = dashboardRoutes(request) || path === '/' || path === '/cambiar-password' || path === '/acceso-denegado'
  if (!needsIdentity) return NextResponse.next()

  let metadata: { role?: string; mustChangePassword?: boolean }
  try {
    const user = await (await clerkClient()).users.getUser(userId)
    metadata = user.publicMetadata as { role?: string; mustChangePassword?: boolean }
  } catch {
    return NextResponse.redirect(new URL('/acceso-denegado', request.url))
  }

  const dashboard = metadata.role ? roleDashboard[metadata.role] : undefined
  if (metadata.mustChangePassword && path !== '/cambiar-password') {
    return NextResponse.redirect(new URL('/cambiar-password', request.url))
  }
  if (path === '/cambiar-password' && !metadata.mustChangePassword) {
    return NextResponse.redirect(new URL(dashboard || '/acceso-denegado', request.url))
  }
  if (path === '/acceso-denegado' && dashboard) {
    return NextResponse.redirect(new URL(dashboard, request.url))
  }
  if (path === '/' && dashboard) {
    return NextResponse.redirect(new URL(dashboard, request.url))
  }
  if (path === '/' && !dashboard) {
    return NextResponse.redirect(new URL('/acceso-denegado', request.url))
  }
  if (dashboardRoutes(request)) {
    const isOwnDashboard = dashboard && (path === dashboard || path.startsWith(`${dashboard}/`))
    if (!isOwnDashboard) {
      return NextResponse.redirect(new URL(dashboard || '/acceso-denegado', request.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|factor-one|sign-in|sign-up|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
