import { getCurrentUser } from '@/lib/auth'
import LayoutStaff from '@/components/portal/LayoutStaff'

const BASE = '/dashboard/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getCurrentUser()
  const nombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || 'Mi cuenta'

  return (
    <LayoutStaff
      inicio={BASE}
      secciones={[{ href: BASE, label: 'Panel de administración', exacto: true }]}
      nombre={nombre}
      rol="Administración"
      etiqueta="Secciones de administración"
    >
      {children}
    </LayoutStaff>
  )
}
