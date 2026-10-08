import { notFound } from 'next/navigation'
import { HorariosMedicoView } from '@/components/paciente/HorariosMedico'
import { obtenerHorariosDisponibles } from '@/lib/services/horarios-disponibles-service'
import { obtenerMedico } from '@/lib/services/medicos-service'

export const dynamic = 'force-dynamic'

type SearchParams = { mes?: string; fecha?: string }

export default async function HorariosMedicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const medico = await obtenerMedico(id)
  if (!medico) notFound()

  const horarios = await obtenerHorariosDisponibles(id, query.mes, query.fecha)
  return <HorariosMedicoView medico={medico} horarios={horarios} />
}
