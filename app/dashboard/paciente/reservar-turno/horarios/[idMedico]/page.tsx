// Paso 2 de la reserva: selección de día y horario para el médico elegido.
import { notFound } from 'next/navigation'
import { obtenerMedicoConTurnosDisponibles } from '@/lib/services/turnos-service'
import BotonVolver from '@/components/ui/BotonVolver'
import MedicoCard from '@/components/paciente/cartilla/MedicoCard'
import reserva from '@/components/paciente/reserva/reserva.module.css'
import SeleccionTurno from './SeleccionTurno'
import styles from './horarios.module.css'

export default async function HorariosMedicoPage({
  params,
}: {
  params: Promise<{ idMedico: string }>
}) {
  const { idMedico } = await params
  const medico = await obtenerMedicoConTurnosDisponibles(idMedico)

  if (!medico) {
    notFound()
  }

  const turnos = medico.turnos.map((turno) => ({
    id: turno.idTurno,
    fecha: turno.fecha.toISOString().slice(0, 10),
    hora: turno.hora,
    duracionMinutos: turno.duracionMinutos,
    estado: turno.estado,
  }))

  return (
    <main className={reserva.pagina}>
      <header className={reserva.encabezado}>
        <BotonVolver fallback="/dashboard/paciente/reservar-turno" />
        <div>
          <h1 className={reserva.titulo}>Elegí día y horario</h1>
          <p className={reserva.subtitulo}>Los días en gris no tienen horarios libres.</p>
        </div>
      </header>

      <div className={styles.columnas}>
        <aside className={styles.ficha}>
          <MedicoCard medico={medico} />
        </aside>
        <SeleccionTurno turnos={turnos} />
      </div>
    </main>
  )
}
