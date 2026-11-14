// Muestra el resumen del turno seleccionado antes de confirmarlo.
import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import BotonVolver from '@/components/ui/BotonVolver'
import PantallaMensaje from '@/components/paciente/ui/PantallaMensaje'
import { capitalizar, fechaLarga } from '@/components/paciente/ui/formato'
import ui from '@/components/paciente/ui/ui.module.css'
import ConfirmarReserva from './ConfirmarReserva'

function Mensaje({ mensaje }: { mensaje: string }) {
  return (
    <PantallaMensaje
      titulo="No se puede confirmar el turno"
      mensaje={mensaje}
      enlace={{ href: '/dashboard/paciente/reservar-turno', label: 'Volver a médicos' }}
    />
  )
}

export default async function ConfirmacionTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string; modalidad?: string }>
}) {
  const { turno: idTurno, modalidad: modalidadParam } = await searchParams
  const modalidad = modalidadParam === 'COBERTURA' ? 'COBERTURA' : 'PARTICULAR'
  if (!idTurno) {
    return <Mensaje mensaje="No se recibió un turno para confirmar." />
  }

  const turno = await prisma.turno.findUnique({
    where: { idTurno },
    include: { medico: true },
  })

  if (!turno) {
    return <Mensaje mensaje="El turno seleccionado no existe." />
  }

  if (turno.estado !== 'DISPONIBLE' || turno.idPaciente) {
    return <Mensaje mensaje="El turno seleccionado ya no está disponible." />
  }

  let paciente
  try {
    paciente = await getCurrentPatient()
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo identificar al paciente.'
    return <Mensaje mensaje={mensaje} />
  }

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback={`/dashboard/paciente/reservar-turno/horarios/${turno.idMedico}`} />
        <div>
          <h1 className={ui.titulo}>Confirmá tu turno</h1>
          <p className={ui.subtitulo}>Revisá que los datos estén bien antes de confirmar.</p>
        </div>
      </header>

      <div className={ui.conLateral}>
        <section className={ui.tarjeta}>
          <h2 className={ui.tarjetaTitulo}>Datos de la reserva</h2>
          <dl className={ui.datos}>
            <div>
              <dt>Profesional</dt>
              <dd>
                {turno.medico.nombre} {turno.medico.apellido} · {nombreEspecialidadMedica(turno.medico.especialidad)}
              </dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>
                {capitalizar(fechaLarga(turno.fecha))} · {turno.hora} hs
              </dd>
            </div>
            <div>
              <dt>Consultorio</dt>
              <dd>{turno.medico.consultorio ?? 'A confirmar'}</dd>
            </div>
            <div>
              <dt>Paciente</dt>
              <dd>
                {paciente.nombre} {paciente.apellido} · DNI {paciente.dni}
              </dd>
            </div>
            <div>
              <dt>Modalidad</dt>
              <dd>
                {modalidad === 'COBERTURA' ? 'Obra social' : 'Particular'}
                {modalidad === 'COBERTURA' && (
                  <span className={ui.ayuda} style={{ display: 'block', marginTop: '0.15rem' }}>
                    {paciente.obraSocial} · Afiliado {paciente.numeroAfiliado} · Plan {paciente.plan || 'No informado'}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <aside className={`${ui.lateral} ${ui.pila}`}>
          <section className={ui.tarjeta}>
            <ConfirmarReserva idTurno={turno.idTurno} idMedico={turno.idMedico} modalidad={modalidad} />
          </section>
          <p className={`${ui.alerta} ${ui.alertaInfo}`}>
            Te enviaremos el comprobante a <strong>{paciente.email}</strong>.
          </p>
        </aside>
      </div>
    </main>
  )
}
