import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-8 flex flex-col justify-between">
      <div className="max-w-5xl w-full mx-auto space-y-8 py-8 sm:py-12">
        {/* Header Institucional */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-bold text-lg font-mono">
              +
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold tracking-widest text-slate-500 uppercase block">
                Sistema de Gestión de Salud Médica
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                SIGESMED
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-mono font-bold text-slate-700 transition-colors"
            >
              Panel Administrador
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <div className="space-y-3 text-left sm:text-center max-w-2xl mx-auto pt-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Gestión Integral de Consultorios y Atención Médica
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
            Plataforma digital para la administración de agendas profesionales, reserva de turnos, registro de historias clínicas y control de vacunatorio.
          </p>
        </div>

        {/* Módulos Operativos por Perfil (Estructura dashboard) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          {/* Card: Perfil Médico */}
          <Link
            href="/dashboard/medico/agenda"
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-black shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-black group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                  Médicos
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">
                Agenda Médica Profesional
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Definición mensual de franjas horarias de atención, control de cupos y publicación de turnos en calendario interactivo.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-900">
              <span>Ingresar al panel</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </Link>

          {/* Card: Perfil Paciente */}
          <Link
            href="/dashboard/paciente"
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-black shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-black group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                  Pacientes
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">
                Portal de Pacientes y Turnos
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Búsqueda de profesionales por especialidad, consulta de horarios disponibles y confirmación de citas presenciales o con cobertura médica.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-900">
              <span>Ver disponibilidad</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </Link>

          {/* Card: Perfil Enfermería */}
          <Link
            href="/dashboard/enfermero"
            className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-black shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-black group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                  Enfermería
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">
                Control de Stock y Vacunatorio
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Registro de dosis aplicadas, alertas preventivas ante inventario mínimo y asignación rápida en mostrador.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-900">
              <span>Consultar vacunas</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto pt-8 border-t border-slate-200 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500">
        <div>SIGESMED · Sistema de Gestión de Salud Médica</div>
        <div>Sala Médica Central · Todos los derechos reservados</div>
      </footer>
    </main>
  )
}
