import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import type { MedicoPerfil } from './types/agenda'

export interface SessionUser {
  id: string
  nombre: string
  apellido: string
  rol: 'MEDICO' | 'PACIENTE' | 'ENFERMERA' | 'ADMIN'
  especialidad?: string
  matricula?: string
}

type ClerkRole = 'medico' | 'paciente' | 'enfermera' | 'admin'
const rolPorMetadata: Record<ClerkRole, SessionUser['rol']> = {
  medico: 'MEDICO', paciente: 'PACIENTE', enfermera: 'ENFERMERA', admin: 'ADMIN',
}

function errorConEstado(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

/** Obtiene el perfil de dominio asociado a la identidad Clerk autenticada. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const identity = await currentUser()
  if (!identity) return null
  const metadata = identity.publicMetadata as { role?: string }
  const role = metadata.role as ClerkRole | undefined
  if (!role || !rolPorMetadata[role]) return null

  const nombreClerk = identity.firstName || ''
  const apellidoClerk = identity.lastName || ''
  const base = { id: userId, nombre: nombreClerk, apellido: apellidoClerk, rol: rolPorMetadata[role] }

  if (role === 'medico') {
    const medico = await prisma.medico.findUnique({ where: { idMedico: userId } })
    if (!medico) return null
    const especialidades = {
      CLINICA_MEDICA: 'Clínica Médica',
      PEDIATRIA: 'Pediatría',
      TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
    } as const
    return {
      ...base, nombre: medico.nombre, apellido: medico.apellido,
      especialidad: especialidades[medico.especialidad], matricula: medico.matricula,
    }
  }

  if (role === 'enfermera') {
    const enfermera = await prisma.enfermero.findUnique({ where: { idEnfermero: userId } })
    return enfermera ? { ...base, nombre: enfermera.nombre, apellido: enfermera.apellido, matricula: enfermera.matricula } : null
  }

  if (role === 'paciente') {
    const paciente = await prisma.paciente.findUnique({ where: { idPaciente: userId } })
    return paciente ? { ...base, nombre: paciente.nombre, apellido: paciente.apellido } : null
  }

  return base
}

/** Obtiene el médico actual y garantiza que el perfil exista en la base. */
export async function getCurrentMedicalUser(): Promise<MedicoPerfil> {
  const user = await getCurrentUser()
  if (!user) throw errorConEstado('No autorizado: sesión no encontrada o perfil inexistente.', 401)
  if (user.rol !== 'MEDICO') throw errorConEstado('Acceso denegado: se requiere perfil médico.', 403)

  return {
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    rol: 'MEDICO',
    especialidad: user.especialidad || 'Clínica Médica',
    matricula: user.matricula || '',
  }
}

export async function getCurrentNurseUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw errorConEstado('No autorizado: sesión no encontrada o perfil inexistente.', 401)
  if (user.rol !== 'ENFERMERA') throw errorConEstado('Acceso denegado: se requiere perfil de enfermería.', 403)
  return user
}

/** Resuelve exclusivamente el paciente vinculado al ID Clerk de la sesión. */
export async function getCurrentPatient() {
  const user = await getCurrentUser()
  if (!user) throw errorConEstado('No autorizado: sesión de paciente no encontrada.', 401)
  if (user.rol !== 'PACIENTE') throw errorConEstado('Acceso denegado: se requiere perfil de paciente.', 403)

  const paciente = await prisma.paciente.findUnique({ where: { idPaciente: user.id } })
  if (!paciente) throw errorConEstado('No se encontró un paciente asociado a la sesión actual.', 404)
  return paciente
}
