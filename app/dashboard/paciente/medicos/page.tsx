import CartillaMedicos from '@/components/paciente/cartilla/CartillaMedicos'
import { listarMedicos } from '@/lib/services/medicos-service'
import { NOMBRES_ESPECIALIDADES_MEDICAS } from '@/lib/utils/especialidades-medicas'

export const dynamic = 'force-dynamic'

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: Promise<{ especialidad?: string | string[] }>
}) {
  const { especialidad } = await searchParams
  const valor = Array.isArray(especialidad) ? especialidad[0] : especialidad
  // Solo se aceptan especialidades conocidas; cualquier otro valor muestra todas.
  const especialidadValida = valor && Object.hasOwn(NOMBRES_ESPECIALIDADES_MEDICAS, valor) ? valor : null

  const medicos = await listarMedicos()
  return <CartillaMedicos medicos={medicos} especialidad={especialidadValida} />
}
