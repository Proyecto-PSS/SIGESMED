import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function PacienteDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Portal del paciente</span>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Mi Portal de Salud</h1>
          </div>
          <UserButton />
        </header>

          <section className="grid gap-4">
          <Link
            href="/dashboard/paciente/reservar-turno"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-400"
          >
            <span className="mb-1 block text-xs font-mono font-bold uppercase text-slate-500">
              Atención Médica
            </span>
            <h2 className="mb-2 text-base font-bold text-slate-900">
              Solicitar Nuevo Turno
            </h2>
            <p className="text-xs text-slate-600">
              Reserva de consultas con médicos clínicos, pediatras y traumatólogos según disponibilidad.
            </p>
          </Link>
          <Link href="/dashboard/paciente/medicos" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400">
            <span className="mb-2 block text-xs font-mono font-bold uppercase text-slate-500">Profesionales</span>
            <h2 className="text-lg font-bold">Médicos</h2>
            <p className="mt-2 text-sm text-slate-600">Elegí un profesional y consultá sus días y horarios disponibles.</p>
          </Link>
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="mb-2 block text-xs font-mono font-bold uppercase text-slate-500">Mis citas</span>
            <h2 className="text-lg font-bold">Turnos confirmados</h2>
            <p className="mt-2 text-sm text-slate-600">Visualización de citas programadas y opción de cancelación con al menos 48 hs de anticipación.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="mb-2 block text-xs font-mono font-bold uppercase text-slate-500">Ficha médica</span>
            <h2 className="text-lg font-bold">Mi historial clínico</h2>
            <p className="mt-2 text-sm text-slate-600">Consulta de atenciones anteriores, prescripciones, diagnósticos y estudios solicitados.</p>
          </article>
        </section>
      </div>
    </div>
  )
}
