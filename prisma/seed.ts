import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../lib/generated/prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Falta configurar DATABASE_URL para ejecutar el seed.')
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
})

const medicos = [
  {
    idMedico: 'med_001',
    nombre: 'Martín',
    apellido: 'Gómez',
    especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
    matricula: 'MN-84920',
    email: 'martin.gomez@example.test',
    consultorio: 'Consultorio 104 - Sede Central',
  },
  {
    idMedico: 'med_002',
    nombre: 'Juan Carlos',
    apellido: 'Rossi',
    especialidad: 'CLINICA_MEDICA',
    matricula: 'MN-72154',
    email: 'juan.rossi@example.test',
    consultorio: 'Consultorio 204 - Sede Central',
  },
  {
    idMedico: 'med_003',
    nombre: 'Elena',
    apellido: 'Martínez',
    especialidad: 'PEDIATRIA',
    matricula: 'MN-91203',
    email: 'elena.martinez@example.test',
    consultorio: 'Centro Pediátrico Norte',
  },
] as const

const paciente = {
  idPaciente: 'user_3KMyaDXQrUpGpnhklCKzc929Hku',
  nombre: 'Paciente',
  apellido: 'Demo',
  dni: '34891204',
  email: 'paciente@gmail.com',
  telefono: '1123456789',
}

const configuracionesAgenda = [
  { idMedico: 'med_001', dias: [2, 4], horaDesde: '09:00', horaHasta: '12:00' },
  { idMedico: 'med_002', dias: [1, 3], horaDesde: '14:00', horaHasta: '17:00' },
  { idMedico: 'med_003', dias: [2, 5], horaDesde: '08:00', horaHasta: '11:00' },
] as const

function mesActual(): Date {
  const hoy = new Date()
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1))
}

function fechasDelMes(mes: Date, diaSemana: number) {
  const fechas: Date[] = []
  const ultimoDia = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 0)).getUTCDate()
  const hoy = new Date()
  const inicioMes = mes.getUTCMonth() === hoy.getUTCMonth() && mes.getUTCFullYear() === hoy.getUTCFullYear()

  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const fecha = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), dia))
    const diaConvertido = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()

    if (diaConvertido === diaSemana && (!inicioMes || fecha >= new Date(Date.UTC(
      hoy.getUTCFullYear(),
      hoy.getUTCMonth(),
      hoy.getUTCDate()
    )))) {
      fechas.push(fecha)
    }
  }

  return fechas
}

function horariosDelRango(horaDesde: string, horaHasta: string, duracionMinutos: number) {
  const horarios: string[] = []
  const [desdeHora, desdeMinuto] = horaDesde.split(':').map(Number)
  const [hastaHora, hastaMinuto] = horaHasta.split(':').map(Number)
  let minutos = desdeHora * 60 + desdeMinuto
  const limite = hastaHora * 60 + hastaMinuto

  while (minutos + duracionMinutos <= limite) {
    horarios.push(`${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`)
    minutos += duracionMinutos
  }

  return horarios
}

async function main() {
  for (const medico of medicos) {
    await prisma.medico.upsert({
      where: { idMedico: medico.idMedico },
      update: medico,
      create: medico,
    })
  }

  await prisma.paciente.upsert({
    where: { idPaciente: paciente.idPaciente },
    update: paciente,
    create: paciente,
  })

  const mes = mesActual()
  let turnosGenerados = 0

  for (const configuracion of configuracionesAgenda) {
    for (const diaSemana of configuracion.dias) {
      const disponibilidad = await prisma.disponibilidadMedica.upsert({
        where: {
          idMedico_mesVigencia_diaSemana: {
            idMedico: configuracion.idMedico,
            mesVigencia: mes,
            diaSemana,
          },
        },
        update: {
          horaDesde: configuracion.horaDesde,
          horaHasta: configuracion.horaHasta,
          duracionTurnoMinutos: 30,
        },
        create: {
          idMedico: configuracion.idMedico,
          mesVigencia: mes,
          diaSemana,
          horaDesde: configuracion.horaDesde,
          horaHasta: configuracion.horaHasta,
          duracionTurnoMinutos: 30,
        },
      })

      const turnos = fechasDelMes(mes, diaSemana).flatMap((fecha) =>
        horariosDelRango(configuracion.horaDesde, configuracion.horaHasta, 30).map((hora) => ({
          idMedico: configuracion.idMedico,
          idDisponibilidadMedica: disponibilidad.idDisponibilidadMedica,
          fecha,
          hora,
          duracionMinutos: 30,
          estado: 'DISPONIBLE' as const,
        }))
      )

      if (turnos.length > 0) {
        const resultado = await prisma.turno.createMany({
          data: turnos,
          skipDuplicates: true,
        })
        turnosGenerados += resultado.count
      }
    }
  }

  console.log(`Seed aplicado: ${medicos.length} médicos, 1 paciente y ${turnosGenerados} turnos nuevos para el mes actual.`)
  // Turnos de demostración de US-26/US-27 para el paciente de prueba existente.
  const fechaRelativa = (meses: number, dias = 0) => {
    const fecha = new Date()
    fecha.setUTCDate(1)
    fecha.setUTCMonth(fecha.getUTCMonth() + meses)
    fecha.setUTCDate(fecha.getUTCDate() + dias)
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))
  }
  const turnosDemo = [
    { idTurno: 'demo_historial_reservado', idMedico: 'med_001', fecha: fechaRelativa(1, 14), hora: '10:00', estado: 'CONFIRMADO' as const, modalidad: 'PARTICULAR' as const },
    { idTurno: 'demo_historial_asistido_1', idMedico: 'med_002', fecha: fechaRelativa(-1, 12), hora: '09:30', estado: 'ATENDIDO' as const, modalidad: 'COBERTURA' as const },
    { idTurno: 'demo_historial_asistido_2', idMedico: 'med_001', fecha: fechaRelativa(-2, 3), hora: '11:00', estado: 'ATENDIDO' as const, modalidad: 'PARTICULAR' as const },
    { idTurno: 'demo_historial_ausente', idMedico: 'med_003', fecha: fechaRelativa(-3, 8), hora: '16:00', estado: 'AUSENTE' as const, modalidad: 'COBERTURA' as const },
    { idTurno: 'demo_historial_cancelado', idMedico: 'med_001', fecha: fechaRelativa(-4, 5), hora: '10:30', estado: 'CANCELADO' as const, modalidad: 'PARTICULAR' as const },
  ]
  for (const turno of turnosDemo) {
    await prisma.turno.upsert({
      where: { idTurno: turno.idTurno },
      update: { idPaciente: paciente.idPaciente, ...turno },
      create: { ...turno, idPaciente: paciente.idPaciente, duracionMinutos: 30 },
    })
  }
  await prisma.pagoTurno.upsert({
    where: { idempotencyKey: 'demo_pago_historial_asistido' },
    update: { estado: 'APROBADO', aprobadoAt: new Date() },
    create: {
      idTurno: 'demo_historial_asistido_2',
      idPaciente: paciente.idPaciente,
      monto: 25000,
      moneda: 'ARS',
      estado: 'APROBADO',
      proveedor: 'SIMULADA',
      transaccionExternaId: 'DEMO-US26-001',
      idempotencyKey: 'demo_pago_historial_asistido',
      aprobadoAt: new Date(),
    },
  })

  console.log(`Paciente de prueba: ${paciente.email} | ID: ${paciente.idPaciente}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
