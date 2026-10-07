import Link from 'next/link'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import type { obtenerHorariosDisponibles } from '@/lib/services/horarios-disponibles-service'
import type { obtenerMedico } from '@/lib/services/medicos-service'

type Medico = NonNullable<Awaited<ReturnType<typeof obtenerMedico>>>
type Horarios = Awaited<ReturnType<typeof obtenerHorariosDisponibles>>

function fechaLegible(fecha: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-AR', { ...options, timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00.000Z`))
}

export function HorariosMedicoView({ medico, horarios }: { medico: Medico; horarios: Horarios }) {
  const base = `/dashboard/paciente/medicos/${encodeURIComponent(medico.idMedico)}/horarios`
  const urlDia = (fecha: string) => `${base}?mes=${encodeURIComponent(horarios.mes)}&fecha=${encodeURIComponent(fecha)}`

  return (
    <main className="pagina-horarios-medico min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <section>
          <Link href="/dashboard/paciente/medicos" className="text-xs font-semibold text-slate-600 hover:text-slate-950">← Volver a Médicos</Link>
          <h1 className="mt-2 text-xl font-bold">Turnos disponibles</h1>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-bold">Dr. {medico.nombre} {medico.apellido}</h2>
            <p className="mt-1 text-xs text-slate-600">{nombreEspecialidadMedica(medico.especialidad)}{medico.consultorio ? ` · ${medico.consultorio}` : ''}</p>
            {medico.direccion && <p className="mt-1 text-xs text-slate-500">{medico.direccion}</p>}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wide">1. Seleccionar día</h2>
            <form action={base} method="GET" className="flex items-center gap-2">
              <label htmlFor="mes" className="text-xs text-slate-600">Mes</label>
              <input id="mes" type="month" name="mes" defaultValue={horarios.mes} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs" />
              <button className="rounded-md bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-700">Ver</button>
            </form>
          </div>
          {horarios.dias.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-600">Este médico no tiene turnos futuros cargados para {fechaLegible(`${horarios.mes}-01`, { month: 'long', year: 'numeric' })}.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {horarios.dias.map((dia) => {
                const disponible = dia.disponibles > 0
                const elegido = horarios.fecha === dia.fecha
                const contenido = <><span className="text-[10px] font-bold uppercase">{fechaLegible(dia.fecha, { weekday: 'short' })}</span><span className="text-xl font-bold">{fechaLegible(dia.fecha, { day: 'numeric' })}</span><span className="text-[11px]">{disponible ? 'Disponible' : 'Agotado'}</span></>
                return disponible ? (
                  <Link key={dia.fecha} href={urlDia(dia.fecha)} aria-current={elegido ? 'date' : undefined} className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-md border p-2 text-center ${elegido ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-500'}`}>{contenido}</Link>
                ) : (
                  <div key={dia.fecha} aria-disabled="true" className="flex min-h-20 cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-slate-300 bg-slate-100 p-2 text-center text-slate-400">{contenido}</div>
                )
              })}
            </div>
          )}
          {horarios.dias.length > 0 && horarios.dias.every((dia) => dia.disponibles === 0) && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Todos los días de atención de este mes están agotados. Volvé al listado para elegir otro médico.</p>
          )}
        </section>

        {horarios.fecha && horarios.hayTurnosEnDia && (
          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wide">2. Horarios disponibles ({fechaLegible(horarios.fecha, { weekday: 'short', day: 'numeric', month: 'short' })})</h2>
              {horarios.duracionTurno && <span className="text-[11px] text-slate-500">Duración: {horarios.duracionTurno} min</span>}
            </div>
            {horarios.horariosManana.length + horarios.horariosTarde.length === 0 ? (
              <p role="status" className="text-xs text-slate-600">Ya no quedan horarios disponibles para este día.</p>
            ) : (
              <div className="space-y-4">
                {horarios.horariosManana.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-medium uppercase text-slate-500">Turno mañana</h3>
                    <div className="flex flex-wrap gap-2">{horarios.horariosManana.map((horario) => <span key={horario.idTurno} className="inline-flex min-w-14 justify-center rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">{horario.hora}</span>)}</div>
                  </div>
                )}
                {horarios.horariosTarde.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-[11px] font-medium uppercase text-slate-500">Turno tarde</h3>
                    <div className="flex flex-wrap gap-2">{horarios.horariosTarde.map((horario) => <span key={horario.idTurno} className="inline-flex min-w-14 justify-center rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">{horario.hora}</span>)}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
