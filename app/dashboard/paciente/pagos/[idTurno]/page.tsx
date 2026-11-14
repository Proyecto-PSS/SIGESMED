import { notFound, redirect } from 'next/navigation'
import { getCurrentPatient } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { obtenerTarifaConsulta } from '@/lib/config/pagos-config'
import PantallaMensaje from '@/components/paciente/ui/PantallaMensaje'
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
      <PantallaMensaje
        titulo="Esta consulta no se abona online"
        mensaje="El turno está registrado con tu obra social, así que no tenés que pagarlo en línea."
        enlace={{ href: '/dashboard/paciente/mis-citas', label: 'Volver a mis turnos' }}
        tono="info"
      />
    )
  }

  // Obtener último pago registrado para este turno (si existe)
  const pagoExistente = await prisma.pagoTurno.findFirst({
    where: {
      idTurno,
      idPaciente: paciente.idPaciente,
    },
    include: {
      comprobante: true,
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
        comprobante: pagoExistente.comprobante
          ? {
              idComprobante: pagoExistente.comprobante.idComprobante,
              idPago: pagoExistente.comprobante.idPago,
              numeroComprobante: pagoExistente.comprobante.numeroComprobante,
              estado: pagoExistente.comprobante.estado,
              nombreArchivo: pagoExistente.comprobante.nombreArchivo,
              mimeType: pagoExistente.comprobante.mimeType,
              tamanoBytes: pagoExistente.comprobante.tamanoBytes,
              fechaEmision: pagoExistente.comprobante.fechaEmision.toISOString(),
              errorGeneracion: pagoExistente.comprobante.errorGeneracion,
            }
          : null,
      }
    : null

  return (
    <PagoTurnoDetalle
      idTurno={idTurno}
      turno={turnoDTO}
      pagoInicial={pagoDTO}
      tarifa={tarifa}
      pacienteInfo={{
        nombre: paciente.nombre || '',
        apellido: paciente.apellido || '',
        dni: (paciente as any).dni || '',
      }}
    />
  )
}

