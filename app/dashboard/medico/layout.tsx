import { getCurrentUser } from '@/lib/auth'
import LayoutStaff from '@/components/portal/LayoutStaff'

const BASE = '/dashboard/medico'

export default async function MedicoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getCurrentUser()
  const nombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || 'Mi cuenta'

  return (
    <LayoutStaff
      inicio={BASE}
      secciones={[
        { href: BASE, label: 'Inicio', exacto: true },
        { href: `${BASE}/agenda`, label: 'Agenda' },
      ]}
      nombre={nombre}
      rol={usuario?.especialidad ?? 'Profesional'}
      etiqueta="Secciones del médico"
    >
      {children}
    </LayoutStaff>
  )
}
