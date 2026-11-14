import { getCurrentUser } from '@/lib/auth'
import LayoutStaff from '@/components/portal/LayoutStaff'

const BASE = '/dashboard/enfermero'

export default async function EnfermeroLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getCurrentUser()
  const nombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || 'Mi cuenta'

  return (
    <LayoutStaff
      inicio={BASE}
      secciones={[{ href: BASE, label: 'Vacunatorio', exacto: true }]}
      nombre={nombre}
      rol="Enfermería"
      etiqueta="Secciones de enfermería"
    >
      {children}
    </LayoutStaff>
  )
}
