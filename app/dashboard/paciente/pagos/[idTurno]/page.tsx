import { notFound, redirect } from 'next/navigation'
import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { obtenerTarifaConsulta } from '@/lib/config/pagos-config'
import PagoTurnoDetalle from './PagoTurnoDetalle'

export default async function PagoTurnoPage({
  params,
}: {
  params: Promise<{ idTurno: string }>
}) {
  const paciente = await getCurrentPatient()
  const { idTurno } = await params

  if (!idTurno) {
    notFound()
  }

  const turno = await prisma.turno.findUnique({
    where: { idTurno },
    include: { medico: true },
  })

  if (!turno) {
    notFound()
  }

  // Verificar que el turno pertenezca al paciente actual
  if (turno.idPaciente !== paciente.idPaciente) {
    redirect('/acceso-denegado')
  }

  // Si la modalidad no es PARTICULAR, no requiere pago particular
  if (turno.modalidad !== 'PARTICULAR') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-2">Consulta no arancelada</h1>
          <p className="text-sm text-slate-600 mb-4">
            Este turno fue registrado con modalidad {turno.modalidad ?? 'Cobertura médica'} y no requiere pago particular en línea.
          </p>
          <a
            href="/dashboard/paciente/mis-citas"
            className="inline-block bg-slate-900 px-4 py-2 text-xs font-semibold text-white rounded hover:bg-slate-800"
          >
            Volver a Mis Citas
          </a>
        </div>
      </div>
    )
  }

  // Obtener último pago registrado para este turno (si existe)
  const pagoExistente = await prisma.pagoTurno.findFirst({
    where: {
      idTurno,
      idPaciente: paciente.idPaciente,
    },
    orderBy: { createdAt: 'desc' },
  })

  const tarifa = obtenerTarifaConsulta(turno.medico.especialidad)

  const turnoDTO = {
    idTurno: turno.idTurno,
    fecha: turno.fecha.toISOString().slice(0, 10),
    hora: turno.hora,
    modalidad: turno.modalidad,
    estado: turno.estado,
    medico: {
      nombre: turno.medico.nombre,
      apellido: turno.medico.apellido,
      especialidad: turno.medico.especialidad,
      consultorio: turno.medico.consultorio,
    },
  }

  const pagoDTO = pagoExistente
    ? {
        idPago: pagoExistente.idPago,
        idTurno: pagoExistente.idTurno,
        idPaciente: pagoExistente.idPaciente,
        monto: pagoExistente.monto.toString(),
        moneda: pagoExistente.moneda,
        estado: pagoExistente.estado,
        proveedor: pagoExistente.proveedor,
        transaccionExternaId: pagoExistente.transaccionExternaId,
        motivoRechazo: pagoExistente.motivoRechazo,
        codigoError: pagoExistente.codigoError,
        aprobadoAt: pagoExistente.aprobadoAt?.toISOString() ?? null,
      }
    : null

  return (
    <PagoTurnoDetalle
      idTurno={idTurno}
      turno={turnoDTO}
      pagoInicial={pagoDTO}
      tarifa={tarifa}
    />
  )
}
