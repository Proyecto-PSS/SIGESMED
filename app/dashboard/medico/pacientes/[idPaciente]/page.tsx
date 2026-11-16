import { redirect, notFound } from 'next/navigation'
import { getCurrentMedico } from '@/lib/auth'
import {
  obtenerDetalleFichaPaciente,
  HistoriaClinicaError,
} from '@/lib/services/historia-clinica-service'
import BuscadorFichaPaciente from '../BuscadorFichaPaciente'

interface Props {
  params: Promise<{ idPaciente: string }>
}

export default async function FichaPacienteDetalleMedicoPage({ params }: Props) {
  try {
    await getCurrentMedico()
  } catch {
    redirect('/acceso-denegado')
  }

  const { idPaciente } = await params

  try {
    const detalle = await obtenerDetalleFichaPaciente(idPaciente)

    return (
      <BuscadorFichaPaciente
        dniInicial={detalle.paciente.dni}
        pacienteEncontradoInicial={detalle.paciente}
        fichaAbiertaInicial={true}
        atencionesIniciales={detalle.atenciones}
      />
    )
  } catch (error: any) {
    if (error instanceof HistoriaClinicaError && error.statusCode === 404) {
      notFound()
    }
    throw error
  }
}

