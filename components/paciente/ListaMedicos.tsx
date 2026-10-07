import Link from 'next/link'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'

type Medico = {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  consultorio: string | null
  direccion: string | null
}

export function ListaMedicos({ medicos }: { medicos: Medico[] }) {
  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard/paciente" className="text-sm font-semibold text-slate-600 hover:text-slate-950">← Volver al portal</Link>
        <header>
          <span className="block text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Atención médica</span>
          <h1 className="mt-1 text-2xl font-bold">Elegí un profesional</h1>
          <p className="mt-2 text-sm text-slate-600">Consultá los días y horarios disponibles para reservar un turno.</p>
        </header>
        {medicos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Todavía no hay médicos cargados en el sistema.</div>
        ) : (
          <section aria-label="Listado de médicos" className="grid gap-4 md:grid-cols-2">
            {medicos.map((medico) => (
              <article key={medico.idMedico} className="flex flex-col justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="font-bold">Dr. {medico.nombre} {medico.apellido}</h2>
                  <p className="mt-1 text-sm text-slate-600">{nombreEspecialidadMedica(medico.especialidad)}</p>
                  {medico.consultorio && <p className="mt-2 text-sm text-slate-700">{medico.consultorio}</p>}
                  {medico.direccion && <p className="mt-1 text-sm text-slate-500">{medico.direccion}</p>}
                </div>
                <Link href={`/dashboard/paciente/medicos/${encodeURIComponent(medico.idMedico)}/horarios`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700">Ver horarios disponibles</Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
