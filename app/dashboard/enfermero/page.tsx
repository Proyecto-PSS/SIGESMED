export default function EnfermeroDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
              Inmunizaciones y Vacunatorio
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Dashboard de Enfermería
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-slate-900">Enf. Valeria Ríos</span>
            <span className="text-[10px] font-mono text-slate-500">Vacunatorio Central</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Atención Diaria
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Turnos de Vacunación</h2>
            <p className="text-xs text-slate-600">
              Gestión de fila de espera, asignación express en mostrador por demanda espontánea y aplicación de dosis.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Inventario en Tiempo Real
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Control de Stock de Vacunas</h2>
            <p className="text-xs text-slate-600">
              Registro de biológicos por lote y fecha de vencimiento, con alertas automáticas ante nivel crítico.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
