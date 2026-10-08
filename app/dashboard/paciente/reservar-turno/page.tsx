// Pantalla de elección de médico: filtra profesionales y deriva a sus horarios.
import Link from 'next/link'
import {
  especialidades,
  obtenerMedicosParaReserva,
  type EspecialidadFiltro,
} from '@/lib/services/turnos-service'

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function formatoFecha(fecha: Date, hora: string) {
  return `${fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })} ${hora} hs`
}

export default async function ReservarTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ especialidad?: string }>
}) {
  const params = await searchParams
  const filtro = especialidades.some(({ value }) => value === params.especialidad)
    ? (params.especialidad as EspecialidadFiltro)
    : 'TODAS'
  const medicos = await obtenerMedicosParaReserva(filtro)

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-slate-200 pb-4">
          <Link href="/dashboard/paciente" className="text-xs text-slate-500 hover:text-slate-900">
            &larr; Volver al portal
          </Link>
          <h1 className="mt-3 text-xl font-bold tracking-tight">Reservar turno</h1>
          <p className="mt-1 text-sm text-slate-600">Elegí un profesional para consultar sus horarios.</p>
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Especialidades">
          {especialidades.map((especialidad) => (
            <Link
              key={especialidad.value}
              href={
                especialidad.value === 'TODAS'
                  ? '/dashboard/paciente/reservar-turno'
                  : `/dashboard/paciente/reservar-turno?especialidad=${especialidad.value}`
              }
              className={`px-3 py-1.5 text-xs font-medium ${
                filtro === especialidad.value
                  ? 'font-bold text-slate-900'
                  : 'text-slate-500 no-underline hover:text-slate-900'
              }`}
            >
              {especialidad.label}
            </Link>
          ))}
        </nav>

        <section className="space-y-2">
          {medicos.length === 0 ? (
            <p className="border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No hay médicos para la especialidad seleccionada.
            </p>
          ) : (
            medicos.map((medico) => (
              <article
                key={medico.idMedico}
                className="flex min-h-[80px] flex-col justify-between gap-3 border border-slate-300 bg-white px-3 py-3 sm:flex-row sm:items-center"
              >
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Dr. {medico.nombre} {medico.apellido}
                  </h2>
                  <p className="mt-1 text-xs text-slate-700">
                    {nombresEspecialidad[medico.especialidad]}{medico.consultorio ? ` · ${medico.consultorio}` : ''}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-600">
                    {medico.proximoTurno
                      ? `Próximo turno: ${formatoFecha(medico.proximoTurno.fecha, medico.proximoTurno.hora)}`
                      : 'No hay turnos disponibles actualmente'}
                  </p>
                </div>
                <Link
                  href={`/dashboard/paciente/reservar-turno/horarios/${medico.idMedico}`}
                  className="border border-slate-400 px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-slate-900 hover:border-slate-900"
                >
                  Ver horarios disponibles
                </Link>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
