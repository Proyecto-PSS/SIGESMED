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
  CANCELADO: 'border-rose-200 bg-rose-50 text-rose-800',
}

const etiquetasEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

const opcionesEstado = [
  { value: 'CONFIRMADO', label: 'Reservado' },
  { value: 'ATENDIDO', label: 'Asistido' },
  { value: 'CANCELADO', label: 'Cancelado' },
] as const

type ParametroBusqueda = string | string[] | undefined

function primerParametro(valor: ParametroBusqueda) {
  return Array.isArray(valor) ? valor[0] ?? '' : valor ?? ''
}

function valorFechaInput(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return ''
  const fecha = new Date(`${valor}T00:00:00.000Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
    ? valor
    : ''
}

function fechaLegible(fecha: Date) {
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function HistoriaClinicaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: ParametroBusqueda; desde?: ParametroBusqueda; hasta?: ParametroBusqueda }>
}) {
  const paciente = await getCurrentPatient()
  const parametros = await searchParams
  const estadoFiltro = primerParametro(parametros.estado)
  const desdeFiltro = primerParametro(parametros.desde)
  const hastaFiltro = primerParametro(parametros.hasta)
  const tieneFiltros = Boolean(estadoFiltro || desdeFiltro || hastaFiltro)
  let turnos: Awaited<ReturnType<typeof obtenerHistorialTurnosPaciente>> = []
  let errorFiltros = ''

  try {
    turnos = await obtenerHistorialTurnosPaciente(paciente.idPaciente, {
      estado: estadoFiltro,
      desde: desdeFiltro,
      hasta: hastaFiltro,
    })
  } catch (error) {
    errorFiltros = error instanceof Error ? error.message : 'No se pudo filtrar el historial.'
  }

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

          <form
            method="get"
            className="mt-5 space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
            aria-label="Filtrar historial de turnos"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6.2 7.1v5.2l-3.6 1.8v-7L4 5Z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Filtrar turnos</h3>
                <p className="mt-0.5 text-xs text-slate-500">Elegí un estado o un período para acotar la lista.</p>
              </div>
            </div>

            <div className="grid historial-filtros-grid gap-3">
              <div className="space-y-1.5">
                <label htmlFor="desde" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Desde</label>
                <input
                  id="desde"
                  name="desde"
                  type="date"
                  defaultValue={valorFechaInput(desdeFiltro)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="hasta" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Hasta</label>
                <input
                  id="hasta"
                  name="hasta"
                  type="date"
                  defaultValue={valorFechaInput(hastaFiltro)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="estado" className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Estado</label>
                <select
                  id="estado"
                  name="estado"
                  defaultValue={opcionesEstado.some((opcion) => opcion.value === estadoFiltro) ? estadoFiltro : ''}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">Todos los estados</option>
                  {opcionesEstado.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                  ))}
                </select>
              </div>
              <div className="historial-filtros-acciones">
                <button
                  type="submit"
                  className="rounded-md bg-slate-800 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                >
                  Aplicar
                </button>
                <Link
                  href="/dashboard/paciente/historia-clinica"
                  className="rounded-md px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  Restablecer
                </Link>
              </div>
            </div>
          </form>

          {errorFiltros && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
              {errorFiltros}
            </p>
          )}

          {tieneFiltros && turnos.length === 0 && !errorFiltros && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="text-base font-bold">No hay turnos que coincidan con esos filtros</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Probá cambiar el estado o ampliar el rango de fechas.
              </p>
            </div>
          )}

          {turnos.length === 0 && !tieneFiltros && !errorFiltros ? (
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
          ) : turnos.length > 0 ? (
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
          ) : null}
        </section>
      </div>
    </main>
  )
}
