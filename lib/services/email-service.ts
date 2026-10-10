export class EmailService {
  /**
   * Simula el envío de un correo de notificación de cancelación a un paciente.
   * @param email Correo electrónico del paciente
   * @param paciente Nombre del paciente
   * @param fecha_hora Fecha y hora del turno cancelado
   * @param medico Nombre del médico
   * @param motivo Motivo de la cancelación
   */
  static async enviarNotificacionCancelacion(
    email: string,
    paciente: string,
    fecha_hora: string,
    medico: string,
    motivo: string
  ): Promise<void> {
    // Simular latencia de red
    await new Promise((resolve) => setTimeout(resolve, 100))
    console.log(`[EMAIL] A: ${email}`)
    console.log(`[EMAIL] Asunto: Cancelación de turno - SIGESMED`)
    console.log(
      `[EMAIL] Mensaje: Hola ${paciente},\nTu turno del ${fecha_hora} con el Dr./Dra. ${medico} ha sido cancelado.\nMotivo: ${motivo}\nPor favor, ingresa al sistema para solicitar un nuevo turno.`
    )
  }
}
