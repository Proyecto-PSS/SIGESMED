export const NOMBRES_ESPECIALIDADES_MEDICAS: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y ortopedia',
}

export function nombreEspecialidadMedica(especialidad: string): string {
  return NOMBRES_ESPECIALIDADES_MEDICAS[especialidad] ?? especialidad
}
