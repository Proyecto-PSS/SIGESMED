import PanelMetricas from './PanelMetricas'

// Inicio del administrador: panel de administrador con los indicadores de RF-15.
export default function AdminInicioPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <PanelMetricas />
      </div>
    </div>
  )
}
