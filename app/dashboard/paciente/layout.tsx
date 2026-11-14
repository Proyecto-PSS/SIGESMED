import { getCurrentUser } from '@/lib/auth'
import PacienteNavbar from '@/components/paciente/navbar/PacienteNavbar'
import { fontBody, fontDisplay } from '@/components/landing/fonts'
import tema from '@/components/landing/tema.module.css'

// Barra superior común + colores y tipografías del tema para todas las pantallas del paciente.
export default async function PacienteLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getCurrentUser()
  const nombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || 'Mi cuenta'

  return (
    <div className={`${tema.tema} ${fontDisplay.variable} ${fontBody.variable}`}>
      <PacienteNavbar nombre={nombre} />
      {children}
    </div>
  )
}
