import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import BotonVolver from '@/components/ui/BotonVolver'
import PantallaMensaje from '@/components/paciente/ui/PantallaMensaje'
import { capitalizar, fechaLarga } from '@/components/paciente/ui/formato'
import ui from '@/components/paciente/ui/ui.module.css'
import ModalidadConsulta from './ModalidadConsulta'

const VOLVER_A_MEDICOS = { href: '/dashboard/paciente/reservar-turno', label: 'Volver a médicos' }

export default async function ModalidadPage({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string }>
}) {
  const { turno: idTurno } = await searchParams
  if (!idTurno) {
    return (
      <PantallaMensaje
        titulo="No se puede seleccionar la modalidad"
        mensaje="No se recibió el turno seleccionado."
        enlace={VOLVER_A_MEDICOS}
      />
    )
  }

  const [turno, paciente] = await Promise.all([
    prisma.turno.findUnique({ where: { idTurno }, include: { medico: true } }),
    getCurrentPatient(),
  ])

  if (!turno || turno.estado !== 'DISPONIBLE' || turno.idPaciente) {
    return (
      <PantallaMensaje
        titulo="No se puede seleccionar la modalidad"
        mensaje="El turno seleccionado ya no está disponible."
        enlace={VOLVER_A_MEDICOS}
      />
    )
  }

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback={`/dashboard/paciente/reservar-turno/horarios/${turno.idMedico}`} />
        <div>
          <h1 className={ui.titulo}>¿Cómo vas a abonar la consulta?</h1>
          <p className={ui.subtitulo}>Elegí si la consulta es particular o con tu obra social.</p>
        </div>
      </header>

      <ModalidadConsulta
        idTurno={idTurno}
        idMedico={turno.idMedico}
        turno={{
          medico: `${turno.medico.nombre} ${turno.medico.apellido}`,
          especialidad: nombreEspecialidadMedica(turno.medico.especialidad),
          fecha: capitalizar(fechaLarga(turno.fecha)),
          hora: turno.hora,
          consultorio: turno.medico.consultorio,
        }}
        coberturaInicial={{
          obraSocial: paciente.obraSocial ?? '',
          numeroAfiliado: paciente.numeroAfiliado ?? '',
          plan: paciente.plan ?? '',
        }}
      />
    </main>
  )
}
