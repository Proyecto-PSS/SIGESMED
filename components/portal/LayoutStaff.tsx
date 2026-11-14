import PortalNavbar, { type SeccionPortal } from './PortalNavbar'
import { fontBody, fontDisplay } from '@/components/landing/fonts'
import tema from '@/components/landing/tema.module.css'
import temaStaff from './tema-staff.module.css'

interface LayoutStaffProps {
  inicio: string
  secciones: SeccionPortal[]
  nombre: string
  rol: string
  etiqueta: string
  children: React.ReactNode
}

// Barra superior + colores y tipografías del portal para médico, enfermería y admin.
export default function LayoutStaff({ inicio, secciones, nombre, rol, etiqueta, children }: LayoutStaffProps) {
  return (
    <div className={`${tema.tema} ${fontDisplay.variable} ${fontBody.variable}`}>
      <PortalNavbar inicio={inicio} secciones={secciones} nombre={nombre} rol={rol} etiqueta={etiqueta} />
      <div className={temaStaff.staff}>{children}</div>
    </div>
  )
}
