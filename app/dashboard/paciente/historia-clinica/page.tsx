import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { getCurrentPatient } from '@/lib/auth'
import { obtenerHistorialTurnosPaciente } from '@/lib/services/citas-service'

const etiquetasEstado: Record<string, string> = {
  CONFIRMADO: 'Reservado',
  ATENDIDO: 'Asistido',
  CANCELADO: 'Cancelado',
}

const estilosEstado: Record<string, string> = {
  CONFIRMADO: 'border-blue-200 bg-blue-50 text-blue-800',
  ATENDIDO: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CANCELADO: 'border-slate-300 bg-slate-100 text-slate-700',
}

const etiquetasEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function fechaLegible(fecha: Date) {
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function HistoriaClinicaPage() {
  const paciente = await getCurrentPatient()
  const turnos = await obtenerHistorialTurnosPaciente(paciente.idPaciente)

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-t-4 border-black bg-white">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
          <h1 className="text-sm font-bold">Historia Clínica</h1>
          <UserButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <Link href="/dashboard/paciente" className="text-xs text-slate-500 hover:text-slate-900">
            ← Volver al portal
          </Link>
          <p className="text-xs text-slate-700">/ Historia Clínica</p>
        </div>

        <section className="mt-6">
          <div className="border-b border-slate-300">
            <h2 className="inline-block border-b-2 border-black pb-3 text-sm font-semibold">
              Historial de Turnos ({turnos.length})
            </h2>
          </div>

          {turnos.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-xs font-mono font-bold uppercase tracking-wide text-slate-500">
                Historia Clínica
              </p>
              <h3 className="mt-3 text-base font-bold">Todavía no tenés turnos registrados</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Cuando reserves o recibas atención, tus turnos aparecerán acá para que puedas consultar su fecha, profesional y estado.
              </p>
              <Link
                href="/dashboard/paciente/reservar-turno"
                className="mt-5 inline-flex rounded-lg bg-black px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Solicitar un turno
              </Link>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="hidden w-full min-w-[680px] text-left md:table">
                  <thead className="bg-slate-50 text-[11px] font-mono uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3">Fecha</th>
                      <th scope="col" className="px-5 py-3">Hora</th>
                      <th scope="col" className="px-5 py-3">Especialidad</th>
                      <th scope="col" className="px-5 py-3">Profesional</th>
                      <th scope="col" className="px-5 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {turnos.map((turno) => (
                      <tr key={turno.idTurno}>
                        <td className="whitespace-nowrap px-5 py-4">{fechaLegible(turno.fecha)}</td>
                        <td className="whitespace-nowrap px-5 py-4">{turno.hora} hs</td>
                        <td className="px-5 py-4">
                          {etiquetasEspecialidad[turno.medico.especialidad] ?? turno.medico.especialidad}
                        </td>
                        <td className="px-5 py-4">{turno.medico.nombre} {turno.medico.apellido}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estilosEstado[turno.estado] ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            {etiquetasEstado[turno.estado] ?? turno.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-slate-100 md:hidden">
                {turnos.map((turno) => (
                  <li key={turno.idTurno} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{fechaLegible(turno.fecha)}</p>
                        <p className="mt-1 text-xs text-slate-600">{turno.hora} hs</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${estilosEstado[turno.estado] ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {etiquetasEstado[turno.estado] ?? turno.estado}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {etiquetasEspecialidad[turno.medico.especialidad] ?? turno.medico.especialidad}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {turno.medico.nombre} {turno.medico.apellido}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
