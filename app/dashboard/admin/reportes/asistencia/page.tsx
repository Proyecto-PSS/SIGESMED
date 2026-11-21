import { redirect } from 'next/navigation'
import { getCurrentAdminUser } from '@/lib/auth'
import AsistenciaReporte from '@/components/reportes/AsistenciaReporte'

export default async function ReporteAsistenciaAdminPage() {
  try {
    await getCurrentAdminUser()
  } catch {
    redirect('/acceso-denegado')
  }

  return <AsistenciaReporte reportesHref="/dashboard/admin/reportes" />
}
