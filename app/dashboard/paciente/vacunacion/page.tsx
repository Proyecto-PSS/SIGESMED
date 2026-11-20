import { getCurrentPatient } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'
import BotonVolver from '@/components/ui/BotonVolver'
import ReservarVacunacion from '@/components/paciente/vacunacion/ReservarVacunacion'
import ui from '@/components/paciente/ui/ui.module.css'

export default async function ReservarVacunacionPage() {
  await getCurrentPatient()
  const vacunas = await VacunacionService.obtenerVacunasConTurnosDisponibles()

  return (
    <main className={`${ui.pagina} ${ui.paginaAngosta}`}>
      <header className={ui.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <div>
          <h1 className={ui.titulo}>Reservar turno de vacunación</h1>
          <p className={ui.subtitulo}>
            {vacunas.length === 0
              ? 'No hay vacunas con turnos disponibles en este momento.'
              : 'Elegí la vacuna, el día y el horario que mejor te queden.'}
          </p>
        </div>
      </header>

      <ReservarVacunacion vacunas={vacunas} />
    </main>
  )
}
