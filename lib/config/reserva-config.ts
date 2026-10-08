// Configuración centralizada de resiliencia y reintentos para la reserva de turnos (US-18).
export const RESERVA_CONFIG = {
  // Cantidad máxima de reintentos automáticos ante fallas transitorias de red o errores de servidor (5xx)
  MAX_RETRIES: 3,

  // Tiempo base de espera entre reintentos en milisegundos (con backoff exponencial)
  RETRY_BASE_DELAY_MS: 1000,

  // Timeout para una solicitud individual de reserva (en milisegundos)
  REQUEST_TIMEOUT_MS: 8000,

  // Timeout para la solicitud de verificación de estado (en milisegundos)
  VERIFY_TIMEOUT_MS: 6000,

  // Cantidad máxima de intentos de verificación tras timeout o fallo ambiguo
  MAX_VERIFY_RETRIES: 3,

  // Intervalo de espera entre consultas de verificación (en milisegundos)
  VERIFY_INTERVAL_MS: 1500,

  // Códigos de estado HTTP transitorios que habilitan retry automático
  TRANSIENT_STATUS_CODES: [502, 503, 504],
} as const
