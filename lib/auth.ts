import { headers, cookies } from 'next/headers'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { MedicoPerfil } from './types/agenda'

export interface SessionUser {
  id: string
  nombre: string
  apellido: string
  rol: 'MEDICO' | 'PACIENTE' | 'ENFERMERA' | 'ADMIN'
  especialidad?: string
  matricula?: string
}

// Perfiles médicos registrados en el sistema (según especificación y wireframes)
export const MEDICOS_REGISTRADOS: Record<string, MedicoPerfil> = {
  med_001: {
    id: 'med_001',
    nombre: 'Martín',
    apellido: 'Gómez',
    rol: 'MEDICO',
    especialidad: 'Traumatología y Ortopedia',
    matricula: 'MN-84920',
    consultorio: 'Consultorio 104 - Sede Central',
  },
  med_002: {
    id: 'med_002',
    nombre: 'Juan Carlos',
    apellido: 'Rossi',
    rol: 'MEDICO',
    especialidad: 'Clínica Médica',
    matricula: 'MN-72154',
    consultorio: 'Consultorio 204 - Sede Central',
  },
  med_003: {
    id: 'med_003',
    nombre: 'Elena',
    apellido: 'Martínez',
    rol: 'MEDICO',
    especialidad: 'Pediatría',
    matricula: 'MN-91203',
    consultorio: 'Centro Pediátrico Norte',
  },
}

/**
 * Abstracción unificada para obtener el usuario actual en el servidor.
 * Preparada para conectarse directamente a JWT/Cookies en US-01 y US-02 sin modificar la lógica de negocio.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // 1. Si existe header o cookie de sesión (o id de prueba), la respetamos
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sigesmed_session')?.value
    if (sessionCookie && MEDICOS_REGISTRADOS[sessionCookie]) {
      return MEDICOS_REGISTRADOS[sessionCookie]
    }
  } catch {
    // Si se llama fuera de contexto de request Next.js
  }

  try {
    const headersList = await headers()
    const headerUserId = headersList.get('x-user-id')
    if (headerUserId && MEDICOS_REGISTRADOS[headerUserId]) {
      return MEDICOS_REGISTRADOS[headerUserId]
    }
  } catch {
    // Si se llama fuera de contexto de request Next.js
  }

  // 2. Fallback por defecto mientras US-01/US-02 se desarrollan: Dr. Martín Gómez (Traumatología)
  return MEDICOS_REGISTRADOS['med_001']
}

/**
 * Obtiene el médico autenticado actual y valida su rol.
 * Lanza error o retorna null si el usuario no tiene rol MEDICO.
 */
export async function getCurrentMedicalUser(): Promise<MedicoPerfil> {
  const user = await getCurrentUser()
  if (!user) {
    const error = new Error('No autorizado: sesión no encontrada')
    ;(error as any).statusCode = 401
    throw error
  }

  if (user.rol !== 'MEDICO') {
    const error = new Error('Acceso denegado: se requiere perfil médico')
    ;(error as any).statusCode = 403
    throw error
  }

  const medico = MEDICOS_REGISTRADOS[user.id] || {
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    rol: 'MEDICO' as const,
    especialidad: user.especialidad || 'Clínica General',
    matricula: user.matricula || 'MN-00000',
  }

  return medico
}

export async function getCurrentPatient() {
  const { userId } = await auth()
  if (!userId) {
    throw new Error('No autorizado: sesión de paciente no encontrada')
  }

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress
  const paciente = await prisma.paciente.findFirst({
    where: {
      OR: [
        { idPaciente: userId },
        ...(email ? [{ email }] : []),
      ],
    },
  })

  if (!paciente) {
    throw new Error('No se encontró un paciente asociado a la sesión actual')
  }

  return paciente
}
