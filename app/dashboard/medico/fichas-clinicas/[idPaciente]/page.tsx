import { redirect, notFound } from 'next/navigation'
import { getCurrentMedico } from '@/lib/auth'
import {
  buscarPacientesFichaClinica,
  obtenerFichaClinicaPaciente,
} from '@/lib/services/historia-clinica-service'
import GestionFichasClinicas from '../GestionFichasClinicas'

interface Props {
  params: Promise<{ idPaciente: string }>
}

export default async function FichaClinicaDetalleMedicoPage({ params }: Props) {
  try {
    await getCurrentMedico()
  } catch (error: any) {
    if (error?.statusCode === 401) {
      redirect('/sign-in')
    }
    redirect('/acceso-denegado')
  }

  const { idPaciente } = await params

  try {
    const [pacientesIniciales, ficha] = await Promise.all([
      buscarPacientesFichaClinica(),
      obtenerFichaClinicaPaciente(idPaciente),
    ])

    return (
      <GestionFichasClinicas
        pacientesIniciales={pacientesIniciales}
        pacienteInicialSeleccionado={ficha.paciente}
        atencionesIniciales={ficha.atenciones}
      />
    )
  } catch (error: any) {
    if (error?.statusCode === 404) {
      notFound()
    }
    throw error
  }
}

