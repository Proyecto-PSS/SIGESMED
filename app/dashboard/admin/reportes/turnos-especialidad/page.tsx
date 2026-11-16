import { redirect } from 'next/navigation'
import { getCurrentAdminUser } from '@/lib/auth'
import TurnosEspecialidadReporte from '@/components/reportes/TurnosEspecialidadReporte'

export default async function ReporteTurnosEspecialidadAdminPage() {
  try {
    await getCurrentAdminUser()
  } catch {
    redirect('/acceso-denegado')
  }

  return <TurnosEspecialidadReporte reportesHref="/dashboard/admin/reportes" />
}

