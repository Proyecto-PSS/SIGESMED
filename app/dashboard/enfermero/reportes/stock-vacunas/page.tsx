import { getCurrentUser } from '@/lib/auth'
import AccesoDenegadoReporte from '@/components/reportes/AccesoDenegadoReporte'
import StockVacunasReporte from '@/components/reportes/StockVacunasReporte'

export default async function ReporteStockVacunasEnfermeriaPage() {
  const usuario = await getCurrentUser()
  if (usuario?.rol !== 'ENFERMERA') return <AccesoDenegadoReporte />
  return <StockVacunasReporte reportesHref="/dashboard/enfermero/reportes" />
}
