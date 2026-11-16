import { redirect } from 'next/navigation'
import { getCurrentMedico } from '@/lib/auth'
import {
  buscarPacientePorDni,
  obtenerDetalleFichaPaciente,
  HistoriaClinicaError,
  type PacienteFichaDTO,
  type AtencionMedicaDTO,
} from '@/lib/services/historia-clinica-service'
import BuscadorFichaPaciente from './BuscadorFichaPaciente'

interface Props {
  searchParams: Promise<{ dni?: string; paciente?: string }>
}

export default async function MedicoPacientesPage({ searchParams }: Props) {
  try {
    await getCurrentMedico()
  } catch {
    redirect('/acceso-denegado')
  }

  const { dni, paciente: idPacienteParam } = await searchParams

  let dniInicial = ''
  let pacienteEncontradoInicial: PacienteFichaDTO | null = null
  let fichaAbiertaInicial = false
  let atencionesIniciales: AtencionMedicaDTO[] = []
  let errorInicial: string | null = null
  let noEncontradoInicial = false

  if (idPacienteParam?.trim()) {
    try {
      const detalle = await obtenerDetalleFichaPaciente(idPacienteParam.trim())
      pacienteEncontradoInicial = detalle.paciente
      atencionesIniciales = detalle.atenciones
      dniInicial = detalle.paciente.dni
      fichaAbiertaInicial = true
    } catch (error: any) {
      if (error instanceof HistoriaClinicaError && error.statusCode === 404) {
        noEncontradoInicial = true
      } else {
        errorInicial = error?.message || 'No se pudo cargar la ficha clínica del paciente.'
      }
    }
  } else if (dni !== undefined) {
    dniInicial = dni
    try {
      pacienteEncontradoInicial = await buscarPacientePorDni(dni)
    } catch (error: any) {
      if (error instanceof HistoriaClinicaError && error.statusCode === 404) {
        noEncontradoInicial = true
      } else if (error instanceof HistoriaClinicaError) {
        errorInicial = error.message
      }
    }
  }

  return (
    <BuscadorFichaPaciente
      dniInicial={dniInicial}
      pacienteEncontradoInicial={pacienteEncontradoInicial}
      fichaAbiertaInicial={fichaAbiertaInicial}
      atencionesIniciales={atencionesIniciales}
      errorInicial={errorInicial}
      noEncontradoInicial={noEncontradoInicial}
    />
  )
}

