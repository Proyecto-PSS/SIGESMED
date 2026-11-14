import { getCurrentUser } from '@/lib/auth'
import AccesoDenegadoReporte from '@/components/reportes/AccesoDenegadoReporte'
import StockVacunasReporte from '@/components/reportes/StockVacunasReporte'

export default async function ReporteStockVacunasAdminPage() {
  const usuario = await getCurrentUser()
  if (usuario?.rol !== 'ADMIN') return <AccesoDenegadoReporte />
  return <StockVacunasReporte reportesHref="/dashboard/admin/reportes" />
}
