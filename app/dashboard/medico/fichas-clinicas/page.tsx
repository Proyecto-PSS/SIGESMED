import { redirect } from 'next/navigation'
import { getCurrentMedico } from '@/lib/auth'
import {
  buscarPacientesFichaClinica,
  obtenerFichaClinicaPaciente,
  type PacienteFichaDTO,
  type AtencionMedicaDTO,
} from '@/lib/services/historia-clinica-service'
import GestionFichasClinicas from './GestionFichasClinicas'

interface Props {
  searchParams: Promise<{ paciente?: string; q?: string }>
}

export default async function FichasClinicasMedicoPage({ searchParams }: Props) {
  try {
    await getCurrentMedico()
  } catch (error: any) {
    if (error?.statusCode === 401) {
      redirect('/sign-in')
    }
    redirect('/acceso-denegado')
  }

  const { paciente: idPacienteParam, q } = await searchParams
  const pacientesIniciales = await buscarPacientesFichaClinica(q)

  let pacienteInicialSeleccionado: PacienteFichaDTO | null = null
  let atencionesIniciales: AtencionMedicaDTO[] = []

  if (idPacienteParam?.trim()) {
    try {
      const ficha = await obtenerFichaClinicaPaciente(idPacienteParam.trim())
      pacienteInicialSeleccionado = ficha.paciente
      atencionesIniciales = ficha.atenciones
    } catch {
      // Si el parámetro no corresponde a un paciente existente, se muestra el selector general
    }
  }

  return (
    <GestionFichasClinicas
      pacientesIniciales={pacientesIniciales}
      pacienteInicialSeleccionado={pacienteInicialSeleccionado}
      atencionesIniciales={atencionesIniciales}
    />
  )
}

