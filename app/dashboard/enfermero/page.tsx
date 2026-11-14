import { getCurrentNurseUser } from '@/lib/auth'
import PanelEnfermeria from '@/components/enfermeria/PanelEnfermeria'

// El nombre y el avatar los muestra la barra superior (app/dashboard/enfermero/layout.tsx).
export default async function EnfermeroDashboardPage() {
  await getCurrentNurseUser()
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-3 sm:p-5 lg:p-6">
      <div className="max-w-[1400px] mx-auto">
        <PanelEnfermeria />
      </div>
    </div>
  )
}
