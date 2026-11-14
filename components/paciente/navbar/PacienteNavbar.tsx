import PortalNavbar, { type SeccionPortal } from '@/components/portal/PortalNavbar'

const BASE = '/dashboard/paciente'

const SECCIONES: SeccionPortal[] = [
  { href: BASE, label: 'Inicio', exacto: true },
  { href: `${BASE}/mis-citas`, label: 'Mis turnos', activoEn: [`${BASE}/mis-citas`, `${BASE}/pagos`] },
  { href: `${BASE}/historia-clinica`, label: 'Historia clínica' },
]

export default function PacienteNavbar({ nombre }: { nombre: string }) {
  return (
    <PortalNavbar
      inicio={BASE}
      secciones={SECCIONES}
      nombre={nombre}
      rol="Paciente"
      etiqueta="Secciones del paciente"
    />
  )
}
