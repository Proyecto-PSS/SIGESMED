import { UserButton } from '@clerk/nextjs'
import { getCurrentNurseUser } from '@/lib/auth'
import PanelEnfermeria from '@/components/enfermeria/PanelEnfermeria'

export default async function EnfermeroDashboardPage() {
  const enfermera = await getCurrentNurseUser()
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-3 sm:p-5 lg:p-6">
      <div className="max-w-[1400px] mx-auto">
        <PanelEnfermeria enfermera={enfermera} userButtonSlot={<UserButton />} />
      </div>
    </div>
  )
}
