'use server'

import { getCurrentNurseUser } from '@/lib/auth'
import { VacunacionService, type HabilitarDiaVacunacionInput } from '@/lib/services/vacunacion-service'

export async function habilitarDiaAction(input: HabilitarDiaVacunacionInput) {
  try {
    const enfermera = await getCurrentNurseUser()
    const resultado = await VacunacionService.habilitarDiaVacunacion(input, enfermera.id)
    return { ok: true, data: resultado }
  } catch (error: any) {
    return {
      ok: false,
      error: error.message || 'Error al habilitar el día de vacunación.',
      code: error.code,
    }
  }
}
