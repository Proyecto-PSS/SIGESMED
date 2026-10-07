import fs from 'fs'
import path from 'path'
import { DisponibilidadMedica, Turno } from '../types/agenda'

interface DatabaseSchema {
  disponibilidades: DisponibilidadMedica[]
  turnos: Turno[]
}

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'sigesmed_db.json')

// Estado inicial con persistencia resiliente
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData: DatabaseSchema = {
      disponibilidades: [],
      turnos: [],
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8')
  }
}

export function readDb(): DatabaseSchema {
  ensureDataDir()
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8')
    return JSON.parse(content) as DatabaseSchema
  } catch (error) {
    console.error('Error leyendo base de datos SIGESMED:', error)
    return { disponibilidades: [], turnos: [] }
  }
}

export function writeDb(data: DatabaseSchema): void {
  ensureDataDir()
  const tempFile = `${DB_FILE}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tempFile, DB_FILE)
}
