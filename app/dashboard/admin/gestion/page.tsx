import RegistroProfesional from '../RegistroProfesional'
import SeccionesAdmin from '../SeccionesAdmin'
import GestionTurnosAdmin from '../GestionTurnosAdmin'
import { listarMedicos } from '@/lib/services/medicos-service'

export default async function GestionAdminPage() {
  const medicos = await listarMedicos()

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
              Administración
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Gestión administrativa
            </h1>
          </div>
          {/* Nombre y avatar: en la barra superior (app/dashboard/admin/layout.tsx). */}
        </header>

        <SeccionesAdmin
          turnos={<GestionTurnosAdmin medicos={medicos} />}
          profesionales={<RegistroProfesional />}
        />
      </div>
    </div>
  )
}
