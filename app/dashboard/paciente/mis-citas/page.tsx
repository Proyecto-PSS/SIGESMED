import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { getCurrentPatient } from '@/lib/auth'
import { obtenerCitasPaciente } from '@/lib/services/citas-service'
import MisCitas from './MisCitas'

export default async function MisCitasPage() {
  const paciente = await getCurrentPatient()
  const citas = await obtenerCitasPaciente(paciente.idPaciente)

  const citasFormateadas = citas.map((cita) => ({
    idTurno: cita.idTurno,
    fecha: cita.fecha.toISOString(),
    hora: cita.hora,
    duracionMinutos: cita.duracionMinutos,
    estado: cita.estado,
    medico: {
      nombre: cita.medico.nombre,
      apellido: cita.medico.apellido,
      especialidad: cita.medico.especialidad,
      consultorio: cita.medico.consultorio,
    },
  }))

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Encabezado */}
      <header className="border-t-4 border-black bg-white">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
          <h1 className="text-sm font-bold">
            Mis Turnos
          </h1>

          <UserButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Navegación */}
        <div className="space-y-3">
          <Link
            href="/dashboard/paciente"
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            ← Volver al portal
          </Link>

          {/* Breadcrumb */}
          <p className="text-xs text-slate-700">
            / Mis Turnos
          </p>
        </div>

        {/* Pestañas */}
        <div className="mt-6 flex gap-8 border-b border-slate-300">
          <button
            type="button"
            className="border-b-2 border-black px-0 pb-3 text-sm font-semibold"
          >
            Próximos Turnos ({citasFormateadas.length})
          </button>

          <button
            type="button"
            className="pb-3 text-sm text-slate-600"
          >
            Historial
          </button>
        </div>

        <MisCitas citas={citasFormateadas} />

      </div>
    </main>
  )
}