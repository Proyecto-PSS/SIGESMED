import { UserButton } from '@clerk/nextjs'

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
              Administración Central
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Dashboard de Administrador
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-xs font-bold text-slate-900">Admin General</span>
              <span className="text-[10px] font-mono text-slate-500">Gestión Clínica</span>
            </div>

            <UserButton />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Reportes Generales
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Métricas de Atención</h2>
            <p className="text-xs text-slate-600">
              Estadísticas de turnos por especialidad, ausentismo de pacientes y facturación consolidada.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Inventario Clínico
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Auditoría de Vacunas</h2>
            <p className="text-xs text-slate-600">
              Monitoreo del stock crítico de biológicos, alertas tempranas y consumo por vacunatorio.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase block mb-1">
              Personal y Roles
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-2">Control de Usuarios</h2>
            <p className="text-xs text-slate-600">
              Gestión de cuentas para médicos, enfermeros, personal administrativo y pacientes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
