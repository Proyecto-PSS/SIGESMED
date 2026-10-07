import Link from 'next/link'

export default function MedicoDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
              Panel Profesional
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Dashboard Médico
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-slate-900">Dr. Martín Gómez</span>
            <span className="text-[10px] font-mono text-slate-500">Traumatología</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/medico/agenda"
            className="p-5 bg-white border border-slate-200 hover:border-black rounded-xl shadow-sm transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-black" />
                <span className="text-[11px] font-mono text-slate-500 font-bold uppercase">
                  Gestión de Horarios
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Agenda Médica y Disponibilidad
              </h2>
              <p className="text-xs text-slate-600">
                Definición mensual de días de atención, franjas horarias y publicación de turnos en calendario interactivo.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-900">
              <span>Abrir módulo de agenda</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </Link>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between opacity-80">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-[11px] font-mono text-slate-500 font-bold uppercase">
                  Consultorio
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Fichas Clínicas de Pacientes
              </h2>
              <p className="text-xs text-slate-600">
                Búsqueda de pacientes citados, carga ágil de diagnósticos, prescripciones y antecedentes clínicos.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
              <span>Módulo en preparación</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
