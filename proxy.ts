import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const dashboardRoutes = createRouteMatcher([
  "/dashboard/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Si intenta acceder a un dashboard sin estar autenticado,
  // lo enviamos al inicio de sesión.
  if (dashboardRoutes(req) && !userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Si no está autenticado, dejamos que Clerk maneje
  // normalmente las rutas públicas y su propio flujo.
  if (!userId) {
    return NextResponse.next();
  }

  // Obtenemos el rol guardado en Public Metadata de Clerk.
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const role = metadata?.role;

  const dashboardByRole: Record<string, string> = {
    paciente: "/dashboard/paciente",
    medico: "/dashboard/medico",
    enfermero: "/dashboard/enfermero",
    admin: "/dashboard/admin",
  };

  const userDashboard = role ? dashboardByRole[role] : undefined;
  // La página de acceso denegado solo corresponde
  // a usuarios autenticados sin un rol válido.
  if (req.nextUrl.pathname === "/acceso-denegado" && userDashboard) {
    return NextResponse.redirect(new URL(userDashboard, req.url));
  }

  // Si el usuario está autenticado pero no tiene un rol válido,
  // no permitimos el acceso a ningún dashboard.
  if (!userDashboard && dashboardRoutes(req)) {
    return NextResponse.redirect(new URL("/acceso-denegado", req.url));
  }

  // Si está en la página principal y tiene un rol válido,
  // lo mandamos a su dashboard.
  if (req.nextUrl.pathname === "/" && userDashboard) {
    return NextResponse.redirect(new URL(userDashboard, req.url));
  }

  // Si está autenticado pero no tiene un rol válido,
  // lo mandamos a la página de acceso denegado.
  if (req.nextUrl.pathname === "/" && !userDashboard) {
    return NextResponse.redirect(new URL("/acceso-denegado", req.url));
  }

  // Si intenta acceder a otro dashboard, lo devolvemos
  // al dashboard correspondiente a su rol.
  if (dashboardRoutes(req) && userDashboard) {
    const requestedPath = req.nextUrl.pathname;

    const isOwnDashboard =
      requestedPath === userDashboard ||
      requestedPath.startsWith(`${userDashboard}/`);

    if (!isOwnDashboard) {
      return NextResponse.redirect(new URL(userDashboard, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // No aplicamos nuestro middleware a las rutas internas
    // utilizadas por Clerk durante el proceso de autenticación.
    "/((?!_next|factor-one|sign-in|sign-up|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};