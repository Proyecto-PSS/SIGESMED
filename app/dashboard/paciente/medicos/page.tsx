import { ListaMedicos } from '@/components/paciente/ListaMedicos'
import { listarMedicos } from '@/lib/services/medicos-service'

export const dynamic = 'force-dynamic'

export default async function MedicosPage() {
  const medicos = await listarMedicos()
  return <ListaMedicos medicos={medicos} />
}
