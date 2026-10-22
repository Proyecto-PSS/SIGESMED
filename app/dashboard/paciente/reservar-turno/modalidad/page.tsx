import Link from 'next/link'
import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ModalidadConsulta from './ModalidadConsulta'

export default async function ModalidadPage({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string }>
}) {
  const { turno: idTurno } = await searchParams
  if (!idTurno) {
    return <Mensaje mensaje="No se recibió el turno seleccionado." />
  }

  const [turno, paciente] = await Promise.all([
    prisma.turno.findUnique({ where: { idTurno }, include: { medico: true } }),
    getCurrentPatient(),
  ])

  if (!turno || turno.estado !== 'DISPONIBLE' || turno.idPaciente) {
    return <Mensaje mensaje="El turno seleccionado ya no está disponible." />
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Reservar turno / Paso 3 de 4
          </p>
          <h1 className="mt-2 text-2xl font-bold">Modalidad de la consulta</h1>
        </div>
        <ModalidadConsulta
          idTurno={idTurno}
          idMedico={turno.idMedico}
          turno={{
            medico: `${turno.medico.nombre} ${turno.medico.apellido}`,
            especialidad: turno.medico.especialidad,
            fecha: turno.fecha.toISOString().slice(0, 10),
            hora: turno.hora,
            consultorio: turno.medico.consultorio,
          }}
          coberturaInicial={{
            obraSocial: paciente.obraSocial ?? '',
            numeroAfiliado: paciente.numeroAfiliado ?? '',
            plan: paciente.plan ?? '',
          }}
        />
      </div>
    </main>
  )
}

function Mensaje({ mensaje }: { mensaje: string }) {
  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">No se puede seleccionar la modalidad</h1>
        <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{mensaje}</p>
        <Link href="/dashboard/paciente/reservar-turno" className="text-xs text-slate-600 hover:text-slate-900">
          Volver a médicos
        </Link>
      </div>
    </main>
  )
}
