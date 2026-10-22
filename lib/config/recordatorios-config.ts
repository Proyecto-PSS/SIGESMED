// Configuración centralizada para el sistema de recordatorios de turnos (US-15).

export const RECORDATORIOS_CONFIG = {
  // Horas de anticipación predeterminadas para el envío del recordatorio (por defecto 24 horas antes del turno)
  HORAS_ANTICIPACION_DEFECTO: 24,

  // Ventana mínima en minutos antes del turno para considerar admisible el envío de un recordatorio.
  // Si faltan menos de este tiempo (ej. 30 min) cuando se reserva o procesa, se omite el recordatorio para no enviar avisos tardíos indiscriminadamente.
  VENTANA_MINIMA_ENVIO_MINUTOS: 30,

  // Cantidad máxima de reintentos ante errores temporales del proveedor de correo
  MAX_INTENTOS: 5,

  // Intervalos de backoff exponencial en minutos para cada reintento:
  // Intento 1: 1 min, Intento 2: 2 min, Intento 3: 4 min, Intento 4: 8 min, Intento 5: 16 min
  INTERVALOS_BACKOFF_MINUTOS: [1, 2, 4, 8, 16],

  // Intervalo máximo de backoff en minutos como tope de seguridad
  INTERVALO_MAX_BACKOFF_MINUTOS: 30,

  // Tiempo límite en minutos tras el cual un recordatorio bloqueado en 'PROCESANDO' se considera huérfano/interrumpido y puede ser reclamado nuevamente
  STALE_PROCESSING_TIMEOUT_MINUTOS: 10,

  // Cantidad de recordatorios a procesar por lote en cada ejecución programada
  TAMANO_LOTE_PROCESAMIENTO: 50,

  // Zona horaria de referencia para la interpretación de fechas y horarios médicos de SIGESMED (Argentina UTC-3)
  TIMEZONE_OFFSET_HOURS: -3,
} as const

export type RecordatoriosConfig = typeof RECORDATORIOS_CONFIG
