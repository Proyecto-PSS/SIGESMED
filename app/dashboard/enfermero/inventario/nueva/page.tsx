import { getCurrentNurseUser } from '@/lib/auth'
import FormularioAltaVacuna from '@/components/enfermeria/inventario/FormularioAltaVacuna'

// US-31: alta de una vacuna nueva en el inventario.
export default async function NuevaVacunaPage() {
  const enfermera = await getCurrentNurseUser()
  const nombre = [enfermera.nombre, enfermera.apellido].filter(Boolean).join(' ')
  return <FormularioAltaVacuna registradaPor={nombre || 'Enfermería'} />
}
