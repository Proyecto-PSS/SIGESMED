import { getCurrentPatient } from '@/lib/auth'
import { obtenerCitasPaciente } from '@/lib/services/citas-service'
import MisCitas from './MisCitas'
import BotonVolver from '@/components/ui/BotonVolver'
import ui from '@/components/paciente/ui/ui.module.css'

export default async function MisCitasPage() {
  const paciente = await getCurrentPatient()
  const citas = await obtenerCitasPaciente(paciente.idPaciente)

  const citasFormateadas = citas.map((cita: any) => ({
    idTurno: cita.idTurno,
    fecha: cita.fecha.toISOString(),
    hora: cita.hora,
    duracionMinutos: cita.duracionMinutos,
    estado: cita.estado,
    modalidad: cita.modalidad ?? 'PARTICULAR',
    pagos: cita.pagos?.map((p: any) => ({
      idPago: p.idPago,
      estado: p.estado,
      monto: p.monto.toString(),
      moneda: p.moneda,
    })) ?? [],
    medico: {
      nombre: cita.medico.nombre,
      apellido: cita.medico.apellido,
      especialidad: cita.medico.especialidad,
      consultorio: cita.medico.consultorio,
    },
  }))

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <div>
          <h1 className={ui.titulo}>Mis turnos</h1>
          <p className={ui.subtitulo}>
            {citasFormateadas.length === 0
              ? 'No tenés turnos próximos.'
              : citasFormateadas.length === 1
                ? 'Tenés 1 turno próximo.'
                : `Tenés ${citasFormateadas.length} turnos próximos.`}{' '}
            Podés cancelar hasta 48 hs antes.
          </p>
        </div>
      </header>

      <MisCitas citas={citasFormateadas} />
    </main>
  )
}
