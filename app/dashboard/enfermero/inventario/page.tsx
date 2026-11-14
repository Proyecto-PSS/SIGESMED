import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'
import { fechaHoyArgentina } from '@/lib/utils/reportes-utils'
import InventarioVacunas from '@/components/enfermeria/inventario/InventarioVacunas'

// US-32 y US-33: inventario de vacunas (consulta, filtros y actualización de stock).
export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ alta?: string }>
}) {
  await getCurrentNurseUser()
  const [{ alta }, vacunas] = await Promise.all([searchParams, VacunacionService.obtenerStockVacunas()])

  return <InventarioVacunas vacunas={vacunas} hoy={fechaHoyArgentina()} vacunaRegistrada={alta} />
}
