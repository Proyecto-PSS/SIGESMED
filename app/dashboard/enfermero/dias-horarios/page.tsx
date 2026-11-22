import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'
import { fechaHoyArgentina } from '@/lib/utils/reportes-utils'
import HabilitarDiaVacunacion from '@/components/enfermeria/habilitacion/HabilitarDiaVacunacion'

// US-35: Gestión de Días y Horarios de Vacunación (habilitación condicionada por stock disponible).
export default async function HabilitarDiaVacunacionPage() {
  await getCurrentNurseUser()
  const vacunas = await VacunacionService.obtenerStockVacunas()

  return (
    <HabilitarDiaVacunacion
      vacunas={vacunas}
      fechaSugerida={fechaHoyArgentina()}
    />
  )
}
