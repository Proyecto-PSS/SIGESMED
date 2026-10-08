export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 // 1: Lunes, 2: Martes, 3: Miércoles, 4: Jueves, 5: Viernes, 6: Sábado

export type DuracionTurno = 20 | 30 | 45

export type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'ATENDIDO'

export interface DisponibilidadMedica {
  id: string
  id_medico: string
  mes_vigencia: string // Formato YYYY-MM (ej. "2024-11")
  dia_semana: DiaSemana
  hora_desde: string // Formato HH:mm
  hora_hasta: string // Formato HH:mm
  duracion_turno_minutos: DuracionTurno
  cantidad_turnos: number
  created_at: string
  updated_at: string
}

export interface Turno {
  id: string
  id_medico: string
  id_paciente: string | null
  fecha_hora: string // ISO string "YYYY-MM-DDTHH:mm:ss"
  duracion_minutos: number
  estado: EstadoTurno
  modalidad: 'PARTICULAR' | 'COBERTURA' | null
  motivo_cancelacion: string | null
  created_at: string
}

export interface MedicoPerfil {
  id: string
  nombre: string
  apellido: string
  rol: 'MEDICO'
  especialidad: string
  matricula: string
  consultorio?: string
}

export interface ResumenPublicacion {
  mes_vigencia: string
  total_jornadas: number
  total_turnos: number
  jornadas_detalle: {
    dia_semana: DiaSemana
    dia_nombre: string
    hora_desde: string
    hora_hasta: string
    duracion_minutos: DuracionTurno
    turnos_por_dia: number
    ocurrencias_en_mes: number
    subtotal_turnos: number
  }[]
}
