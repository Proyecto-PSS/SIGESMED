// Configuración centralizada de tarifas y pasarelas de pago para consultas particulares (US-23).

export const PAGOS_CONFIG = {
  // Moneda oficial de cobro
  MONEDA: 'ARS',

  // Aranceles de consulta médica particular según especialidad (representación decimal exacta en formato string)
  ARANCELES: {
    DEFAULT: '15000.00',
    CLINICA_MEDICA: '15000.00',
    PEDIATRIA: '18000.00',
    TRAUMATOLOGIA_ORTOPEDIA: '20000.00',
  } as const,

  // Proveedor configurado para el sistema
  PROVEEDOR: (process.env.PASARELA_PAGO_PROVEEDOR || 'SIMULADA') as 'SIMULADA' | 'MERCADOPAGO',

  // Protección de seguridad: la pasarela simulada nunca debe habilitarse de forma accidental en producción
  PERMITIR_SIMULACION: process.env.NODE_ENV !== 'production' || process.env.ENABLE_MOCK_PAYMENTS === 'true',

  // Timeouts y límites de reintentos
  REQUEST_TIMEOUT_MS: 10000,
  VERIFY_TIMEOUT_MS: 5000,
  MAX_REINTENTOS: 3,
} as const

/**
 * Obtiene la tarifa server-side oficial de la consulta particular basada en la especialidad médica.
 * Nunca se debe aceptar un monto arbitrario enviado por el cliente.
 */
export function obtenerTarifaConsulta(especialidad?: string | null): { monto: string; moneda: string } {
  if (especialidad && especialidad in PAGOS_CONFIG.ARANCELES) {
    return {
      monto: PAGOS_CONFIG.ARANCELES[especialidad as keyof typeof PAGOS_CONFIG.ARANCELES],
      moneda: PAGOS_CONFIG.MONEDA,
    }
  }

  return {
    monto: PAGOS_CONFIG.ARANCELES.DEFAULT,
    moneda: PAGOS_CONFIG.MONEDA,
  }
}
