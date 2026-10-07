export default function PacienteDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
              Portal del Paciente
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Mi Portal de Salud
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-slate-900">Carlos Morales</span>
            <span className="text-[10px] font-mono text-slate-500">DNI: 34.891.204</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Atención Médica
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Solicitar Nuevo Turno</h2>
            <p className="text-xs text-slate-600">
              Reserva de consultas con médicos clínicos, pediatras y traumatólogos según disponibilidad.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Mis Citas
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Turnos Confirmados</h2>
            <p className="text-xs text-slate-600">
              Visualización de citas programadas y opción de cancelación con al menos 48 hs de anticipación.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Ficha Médica
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Mi Historial Clínico</h2>
            <p className="text-xs text-slate-600">
              Consulta de atenciones anteriores, prescripciones, diagnósticos y estudios solicitados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
