import { redirect } from 'next/navigation'
import { getCurrentAdminUser } from '@/lib/auth'
import MenuReportes from '@/components/reportes/MenuReportes'
import TurnosEspecialidadReporte from '@/components/reportes/TurnosEspecialidadReporte'

export default async function ReportesAdminPage() {
  try {
    await getCurrentAdminUser()
  } catch {
    redirect('/acceso-denegado')
  }

  return (
    <>
      <MenuReportes href="/dashboard/admin/reportes" />
      <TurnosEspecialidadReporte reportesHref="/dashboard/admin/reportes" ocultarVolver />
    </>
  )
}
