import { redirect } from 'next/navigation'
import { getCurrentPatient } from '@/lib/auth'
import { obtenerHistorialClinicoPropioPaciente } from '@/lib/services/historia-clinica-service'
import BotonVolver from '@/components/ui/BotonVolver'
import ui from '@/components/paciente/ui/ui.module.css'
import HistorialClinicoPaciente from '../historia-clinica/HistorialClinicoPaciente'

export default async function HistorialClinicoDirectPage() {
  let paciente: Awaited<ReturnType<typeof getCurrentPatient>>
  try {
    paciente = await getCurrentPatient()
  } catch (error: any) {
    if (error?.statusCode === 401) {
      redirect('/sign-in')
    }
    redirect('/acceso-denegado')
  }

  const atenciones = await obtenerHistorialClinicoPropioPaciente(paciente.idPaciente)

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <div>
          <h1 className={ui.titulo}>Historial Clínico</h1>
          <p className={ui.subtitulo}>
            Consultá los diagnósticos, observaciones y tratamientos registrados por tus profesionales médicos.
          </p>
        </div>
      </header>

      <HistorialClinicoPaciente atencionesIniciales={atenciones} />
    </main>
  )
}

