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
    consultorio: 'Consultorio 104 - Sede Central',
  },
  {
    idMedico: 'med_002',
    nombre: 'Juan Carlos',
    apellido: 'Rossi',
    especialidad: 'CLINICA_MEDICA',
    matricula: 'MN-72154',
    consultorio: 'Consultorio 204 - Sede Central',
  },
  {
    idMedico: 'med_003',
    nombre: 'Elena',
    apellido: 'Martínez',
    especialidad: 'PEDIATRIA',
    matricula: 'MN-91203',
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
  console.log(`Paciente de prueba: ${paciente.email} | ID: ${paciente.idPaciente}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
