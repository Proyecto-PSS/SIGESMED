// Pantalla de selección de día y horario para el médico elegido.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerMedicoConTurnosDisponibles } from '@/lib/services/turnos-service'
import SeleccionTurno from './SeleccionTurno'

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

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
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-slate-200 pb-4">
          <Link href="/dashboard/paciente/reservar-turno" className="text-xs text-slate-500 hover:text-slate-900">
            &larr; Volver a médicos
          </Link>
          <h1 className="mt-3 text-xl font-bold">Selección de Día y Horario</h1>
        </header>

        <section className="border border-slate-200 bg-white px-3 py-3">
          <h2 className="text-sm font-semibold">
            {medico.nombre} {medico.apellido}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {nombresEspecialidad[medico.especialidad]}
            {medico.consultorio ? ` · ${medico.consultorio}` : ''}
          </p>
        </section>

        <SeleccionTurno turnos={turnos} />
      </div>
    </main>
  )
}
