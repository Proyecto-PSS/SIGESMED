import { redirect } from 'next/navigation'
import { getCurrentAdminUser } from '@/lib/auth'
import PagosRealizadosReporte from '@/components/reportes/PagosRealizadosReporte'

export default async function ReportePagosRealizadosAdminPage() {
  try {
    await getCurrentAdminUser()
  } catch {
    redirect('/acceso-denegado')
  }

  return <PagosRealizadosReporte reportesHref="/dashboard/admin/reportes" />
}
