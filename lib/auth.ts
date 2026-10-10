import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
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

type ClerkRole = 'medico' | 'paciente' | 'enfermera' | 'enfermero' | 'admin'
const rolPorMetadata: Record<string, SessionUser['rol']> = {
  medico: 'MEDICO',
  paciente: 'PACIENTE',
  enfermera: 'ENFERMERA',
  enfermero: 'ENFERMERA',
  admin: 'ADMIN',
}

function errorConEstado(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

/** Obtiene el perfil de dominio asociado a la identidad Clerk autenticada. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  let identity = await currentUser()
  let metadata = (identity?.publicMetadata ?? {}) as { role?: string }
  let role = metadata.role as ClerkRole | undefined
  let emailClerk = identity?.emailAddresses?.[0]?.emailAddress?.toLowerCase()

  // Si la sesión no trae metadata en el token (caso común si no hay session claim configurado),
  // se consulta directamente la identidad desde el backend de Clerk (igual que en proxy.ts)
  if (!role || !rolPorMetadata[role]) {
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(userId)
      metadata = (user.publicMetadata ?? {}) as { role?: string }
      role = metadata.role as ClerkRole | undefined
      if (!identity) {
        identity = user as any
      }
      if (!emailClerk) {
        emailClerk = user.emailAddresses?.[0]?.emailAddress?.toLowerCase()
      }
    } catch {
      // Ignorar fallo de fetch a Clerk
    }
  }

  if (!role || !rolPorMetadata[role]) return null

  const nombreClerk = identity?.firstName || ''
  const apellidoClerk = identity?.lastName || ''
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

  if (role === 'enfermera' || role === 'enfermero') {
    const enfermera = await prisma.enfermero.findUnique({ where: { idEnfermero: userId } })
    return enfermera ? { ...base, nombre: enfermera.nombre, apellido: enfermera.apellido, matricula: enfermera.matricula } : null
  }

  if (role === 'paciente') {
    // 1. Intentar buscar por idPaciente (ID Clerk)
    let paciente = await prisma.paciente.findUnique({ where: { idPaciente: userId } })

    // 2. Si no se encontró por ID pero tenemos el email de Clerk, buscar por email
    if (!paciente && emailClerk) {
      paciente = await prisma.paciente.findUnique({ where: { email: emailClerk } })

      // Si existe con ese email pero tenía otro idPaciente (p. ej. "pac_demo"),
      // lo vinculamos al userId de Clerk para que futuras búsquedas coincidan
      if (paciente && paciente.idPaciente !== userId) {
        try {
          paciente = await prisma.paciente.update({
            where: { email: emailClerk },
            data: { idPaciente: userId },
          })
        } catch {
          // Si no se puede actualizar por restricciones foráneas existentes, mantenemos el paciente encontrado
        }
      }
    }

    // 3. Si el usuario tiene rol paciente en Clerk pero aún no tiene fila en la tabla pacientes,
    // garantizamos su perfil para no bloquear el flujo de atención
    if (!paciente) {
      try {
        const dniDefault = (metadata as any)?.dni || userId.replace(/\D/g, '').slice(-8).padStart(8, '0') || '30000000'
        paciente = await prisma.paciente.create({
          data: {
            idPaciente: userId,
            nombre: nombreClerk || 'Paciente',
            apellido: apellidoClerk || 'Usuario',
            dni: dniDefault,
            email: emailClerk || `${userId}@paciente.sigesmed.test`,
            telefono: null,
            obraSocial: 'Particular',
            numeroAfiliado: null,
          },
        })
      } catch {
        if (emailClerk) {
          paciente = await prisma.paciente.findUnique({ where: { email: emailClerk } })
        }
      }
    }

    if (paciente) {
      return {
        ...base,
        id: paciente.idPaciente,
        nombre: paciente.nombre,
        apellido: paciente.apellido,
      }
    }

    return base
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

  let paciente = await prisma.paciente.findUnique({ where: { idPaciente: user.id } })

  if (!paciente) {
    const identity = await currentUser()
    const email = identity?.emailAddresses?.[0]?.emailAddress?.toLowerCase()
    if (email) {
      paciente = await prisma.paciente.findUnique({ where: { email } })
    }
  }

  if (!paciente) {
    // Si aún no existe, asegurar perfil básico de paciente en la base de datos
    try {
      const identity = await currentUser()
      const email = identity?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || `${user.id}@paciente.sigesmed.test`
      const dni = (identity?.publicMetadata as any)?.dni || user.id.replace(/\D/g, '').slice(-8).padStart(8, '0') || '30000000'
      paciente = await prisma.paciente.create({
        data: {
          idPaciente: user.id,
          nombre: user.nombre || 'Paciente',
          apellido: user.apellido || 'Usuario',
          dni,
          email,
          obraSocial: 'Particular',
        },
      })
    } catch {
      // fallback
    }
  }

  if (!paciente) throw errorConEstado('No se encontró un paciente asociado a la sesión actual.', 404)
  return paciente
}
