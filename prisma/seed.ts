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

async function main() {
  for (const medico of medicos) {
    await prisma.medico.upsert({
      where: { idMedico: medico.idMedico },
      update: medico,
      create: medico,
    })
  }
  console.log(`Seed aplicado: ${medicos.length} médicos de prueba.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
