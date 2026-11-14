import { getCurrentPatient } from '@/lib/auth'
import { VacunacionService } from '@/lib/services/vacunacion-service'
import BotonVolver from '@/components/ui/BotonVolver'
import ui from '@/components/paciente/ui/ui.module.css'
import MisTurnosVacunacion from './MisTurnosVacunacion'

export default async function MisTurnosVacunacionPage() {
  const paciente = await getCurrentPatient()
  const [turnos, cancelaciones] = await Promise.all([
    VacunacionService.obtenerTurnosVacunacionPaciente(paciente.idPaciente),
    VacunacionService.obtenerHistorialCancelacionesVacunacionPaciente(paciente.idPaciente),
  ])

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <div>
          <h1 className={ui.titulo}>Mis turnos de vacunación</h1>
          <p className={ui.subtitulo}>
            {turnos.length === 0
              ? 'No tenés turnos de vacunación confirmados.'
              : turnos.length === 1
                ? 'Tenés 1 turno de vacunación confirmado.'
                : `Tenés ${turnos.length} turnos de vacunación confirmados.`}
          </p>
        </div>
      </header>
      <MisTurnosVacunacion turnos={turnos.map((turno) => ({
        id: turno.idTurnoVacunacion,
        fecha: turno.fecha.toISOString(),
        hora: turno.hora,
        vacuna: turno.vacuna.nombre,
        enfermero: `${turno.enfermero.nombre} ${turno.enfermero.apellido}`,
      }))} cancelaciones={cancelaciones.map((cancelacion) => ({
        id: cancelacion.idCancelacion,
        fecha: cancelacion.fecha.toISOString(),
        hora: cancelacion.hora,
        vacuna: cancelacion.nombreVacuna,
        motivo: cancelacion.motivo,
        canceladoAt: cancelacion.canceladoAt.toISOString(),
      }))} />
    </main>
  )
}
