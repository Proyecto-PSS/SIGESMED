// Muestra el resumen del turno seleccionado antes de confirmarlo.
import Link from 'next/link'
import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ConfirmarReserva from './ConfirmarReserva'

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

export default async function ConfirmacionTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string }>
}) {
  const { turno: idTurno } = await searchParams
  if (!idTurno) {
    return <MensajeConfirmacion mensaje="No se recibió un turno para confirmar." />
  }

  const turno = await prisma.turno.findUnique({
    where: { idTurno },
    include: { medico: true },
  })

  if (!turno) {
    return <MensajeConfirmacion mensaje="El turno seleccionado no existe." />
  }

  if (turno.estado !== 'DISPONIBLE' || turno.idPaciente) {
    return <MensajeConfirmacion mensaje="El turno seleccionado ya no está disponible." />
  }

  let paciente
  try {
    paciente = await getCurrentPatient()
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo identificar al paciente.'
    return <MensajeConfirmacion mensaje={mensaje} />
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href={`/dashboard/paciente/reservar-turno/horarios/${turno.idMedico}`} className="text-xs text-slate-500 hover:text-slate-900">
          &larr; Volver a Horarios
        </Link>
        <h1 className="text-2xl font-bold">Confirmar Reserva de Turno</h1>
        <section className="overflow-hidden rounded-lg border border-slate-300 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-4 text-[10px] font-bold uppercase tracking-widest">
            Resumen del turno
          </h2>
          <div className="grid grid-cols-[130px_1fr] border-b border-slate-200 px-5 py-4 text-sm">
            <span className="text-[10px] font-medium uppercase text-slate-600">Médico</span>
            <span>
              <strong>{turno.medico.nombre} {turno.medico.apellido}</strong>{' '}
              <span className="text-slate-600">({nombresEspecialidad[turno.medico.especialidad]})</span>
            </span>
          </div>
          <div className="grid grid-cols-[130px_1fr] border-b border-slate-200 px-5 py-4 text-sm">
            <span className="text-[10px] font-medium uppercase text-slate-600">Fecha y hora</span>
            <strong>
              {turno.fecha.toLocaleDateString('es-AR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                timeZone: 'UTC',
              })}, {turno.hora} hs
            </strong>
          </div>
          <div className="grid grid-cols-[130px_1fr] border-b border-slate-200 px-5 py-4 text-sm">
            <span className="text-[10px] font-medium uppercase text-slate-600">Sede</span>
            <span>{turno.medico.consultorio ?? 'Sede no informada'}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] px-5 py-4 text-sm">
            <span className="text-[10px] font-medium uppercase text-slate-600">Paciente</span>
            <span>{paciente.nombre} {paciente.apellido} <span className="text-slate-600">(DNI: {paciente.dni})</span></span>
          </div>
        </section>
        <section className="border border-slate-300 bg-white p-4 text-sm">
          Se enviará comprobante de reserva a <strong>{paciente.email}</strong>
        </section>
        <ConfirmarReserva idTurno={turno.idTurno} idMedico={turno.idMedico} />
      </div>
    </main>
  )
}

function MensajeConfirmacion({ mensaje }: { mensaje: string }) {
  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">No se puede confirmar el turno</h1>
        <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{mensaje}</p>
        <Link
          href="/dashboard/paciente/reservar-turno"
          className="inline-block text-xs text-slate-600 no-underline hover:text-slate-900"
        >
          Volver a médicos
        </Link>
      </div>
    </main>
  )
}
