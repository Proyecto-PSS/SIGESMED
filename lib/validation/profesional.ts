export type TipoProfesional = 'medico' | 'enfermera'
export type EspecialidadProfesional = 'CLINICA_MEDICA' | 'PEDIATRIA' | 'TRAUMATOLOGIA_ORTOPEDIA'

export interface DatosAltaProfesional {
  nombre: string
  apellido: string
  email: string
  matricula: string
  especialidad?: EspecialidadProfesional
}

export type ResultadoValidacion =
  | { ok: true; datos: DatosAltaProfesional }
  | { ok: false; error: string }

const especialidades: EspecialidadProfesional[] = [
  'CLINICA_MEDICA', 'PEDIATRIA', 'TRAUMATOLOGIA_ORTOPEDIA',
]

export function validarAltaProfesional(rol: TipoProfesional, input: unknown): ResultadoValidacion {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Ingresá los datos del profesional.' }
  const body = input as Record<string, unknown>
  const nombre = String(body.nombre ?? '').trim()
  const apellido = String(body.apellido ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const matricula = String(body.matricula ?? '').trim()
  const especialidadInput = String(body.especialidad ?? '')

  if (!nombre || !apellido || !/^\S+@\S+\.\S+$/.test(email) || !matricula) {
    return { ok: false, error: 'Completá nombre, apellido, email y matrícula o legajo válido.' }
  }
  if (rol === 'medico' && !especialidades.includes(especialidadInput as EspecialidadProfesional)) {
    return { ok: false, error: 'Seleccioná una especialidad médica válida.' }
  }

  return {
    ok: true,
    datos: {
      nombre, apellido, email, matricula,
      ...(rol === 'medico' ? { especialidad: especialidadInput as EspecialidadProfesional } : {}),
    },
  }
}

export function puedeRegistrarProfesionales(rolAutenticado: unknown): boolean {
  return rolAutenticado === 'admin'
}
