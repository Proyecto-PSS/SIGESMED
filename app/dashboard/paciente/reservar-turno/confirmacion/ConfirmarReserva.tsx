'use client'

// Ejecuta la confirmación resiliente del turno (US-09 y US-18): idempotencia, retries controlados y verificación.
import Link from 'next/link'
import { useState, useRef } from 'react'
import { RESERVA_CONFIG } from '@/lib/config/reserva-config'
import { esperar, fetchConTimeout } from '@/lib/utils/resilient-fetch'

type Props = {
  idTurno: string
  idMedico: string
}

type EstadoReserva =
  | 'inicial'
  | 'cargando'
  | 'reintentando'
  | 'verificando'
  | 'verificacion_pendiente'
  | 'confirmado'
  | 'conflicto'
  | 'error'

export default function ConfirmarReserva({ idTurno, idMedico }: Props) {
  const [estado, setEstado] = useState<EstadoReserva>('inicial')
  const [mensaje, setMensaje] = useState('')

  const enProcesoRef = useRef(false)
  const idempotencyKeyRef = useRef<string | null>(null)

  function generarClaveIdempotencia(): string {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
    return idempotencyKeyRef.current
  }

  async function verificarEstado(clave?: string) {
    const key = clave || idempotencyKeyRef.current
    if (!key) return

    setEstado('verificando')
    setMensaje('Estamos verificando tu reserva...')
    enProcesoRef.current = true

    for (let v = 0; v < RESERVA_CONFIG.MAX_VERIFY_RETRIES; v++) {
      try {
        if (v > 0) {
          await esperar(RESERVA_CONFIG.VERIFY_INTERVAL_MS)
        }

        const statusRes = await fetchConTimeout(
          `/api/turnos/reservar/status?idempotencyKey=${encodeURIComponent(key)}&turnoId=${idTurno}`,
          {
            method: 'GET',
            headers: {
              'Idempotency-Key': key,
            },
          },
          RESERVA_CONFIG.VERIFY_TIMEOUT_MS
        )

        if (statusRes.ok) {
          const statusData = await statusRes.json()

          if (statusData.status === 'CONFIRMADO') {
            setEstado('confirmado')
            enProcesoRef.current = false
            return
          }

          if (statusData.status === 'RECHAZADO') {
            setMensaje('Este turno ya no está disponible.')
            setEstado('conflicto')
            enProcesoRef.current = false
            idempotencyKeyRef.current = null
            return
          }

          if (statusData.status === 'NO_ENCONTRADO') {
            // El servidor no procesó la reserva; falla segura
            setMensaje('No pudimos confirmar el turno. Por favor, intentá nuevamente.')
            setEstado('error')
            enProcesoRef.current = false
            idempotencyKeyRef.current = null
            return
          }
        }
      } catch {
        // Fallo transitorio en la verificación, continúa el ciclo
      }
    }

    // Si no se pudo determinar el estado tras agotar consultas de verificación
    setMensaje('No pudimos determinar si el turno fue confirmado debido a un error de conexión.')
    setEstado('verificacion_pendiente')
    enProcesoRef.current = false
  }

  async function confirmar() {
    // Prevención estricta de doble click y submits concurrentes
    if (enProcesoRef.current) return
    enProcesoRef.current = true

    const idempotencyKey = generarClaveIdempotencia()
    setMensaje('')
    let intento = 0
    let confirmado = false
    let necesitaVerificacion = false

    // Bucle de solicitud con reintentos controlados para fallas transitorias
    while (intento <= RESERVA_CONFIG.MAX_RETRIES && !confirmado) {
      try {
        if (intento > 0) {
          setEstado('reintentando')
          setMensaje('Error de conexión, reintentando...')
          const delay = RESERVA_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, intento - 1)
          await esperar(delay)
        } else {
          setEstado('cargando')
        }

        const response = await fetchConTimeout(
          `/api/pacientes/turnos/${idTurno}/confirmar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
              idempotencyKey,
              modalidad: 'PARTICULAR',
            }),
          },
          RESERVA_CONFIG.REQUEST_TIMEOUT_MS
        )

        if (response.ok) {
          confirmado = true
          setEstado('confirmado')
          enProcesoRef.current = false
          return
        }

        // Conflicto de concurrencia: turno tomado por otro paciente (US-09)
        if (response.status === 409) {
          setMensaje('Este turno ya no está disponible.')
          setEstado('conflicto')
          enProcesoRef.current = false
          idempotencyKeyRef.current = null
          return
        }

        // Errores transitorios de servidor (502, 503, 504): son aptos para retry
        if ((RESERVA_CONFIG.TRANSIENT_STATUS_CODES as readonly number[]).includes(response.status)) {
          intento++
          if (intento > RESERVA_CONFIG.MAX_RETRIES) {
            necesitaVerificacion = true
            break
          }
          continue
        }

        // Errores cliente no recuperables (400, 401, 403, 404, etc.): no reintentar
        const data = await response.json().catch(() => ({}))
        setMensaje(data.error ?? data.message ?? 'No se pudo confirmar el turno')
        setEstado('error')
        enProcesoRef.current = false
        idempotencyKeyRef.current = null
        return
      } catch {
        // Timeout (AbortError) o desconexión temporal de red: aptos para retry
        intento++
        if (intento > RESERVA_CONFIG.MAX_RETRIES) {
          necesitaVerificacion = true
          break
        }
        continue
      }
    }

    // Recuperación de estado incierto tras agotar reintentos o pérdida de respuesta
    if (necesitaVerificacion) {
      await verificarEstado(idempotencyKey)
    }
  }

  if (estado === 'confirmado') {
    return (
      <section className="space-y-3" role="status" aria-live="polite">
        <div className="border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="mb-1 text-base font-bold">¡Turno confirmado!</p>
          <p>Turno confirmado correctamente. Se registró la reserva a nombre del paciente.</p>
        </div>

        <Link
          href="/dashboard/paciente/mis-citas"
          className="block bg-black px-4 py-3 text-center text-xs font-semibold uppercase text-white hover:bg-slate-800"
        >
          Ver mis turnos (Mis Citas)
        </Link>

        <Link
          href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
          className="block border border-slate-300 bg-white px-4 py-3 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Volver a horarios
        </Link>
      </section>
    )
  }

  if (estado === 'conflicto') {
    return (
      <section className="space-y-3" role="alert">
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="mb-1 font-bold">Turno no disponible</p>
          <p>{mensaje || 'Este turno ya no está disponible.'}</p>
        </div>

        <Link
          href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
          className="block bg-black px-4 py-3 text-center text-xs font-semibold text-white hover:bg-slate-800"
        >
          Ver otros horarios
        </Link>
      </section>
    )
  }

  if (estado === 'verificacion_pendiente') {
    return (
      <section className="space-y-3" role="alert">
        <div className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-1 font-bold">Verificación pendiente</p>
          <p>
            No pudimos determinar si tu reserva fue completada debido a una falla de conexión.
            El turno puede haber sido procesado por el servidor. Por favor, reverificá el estado
            antes de realizar una nueva reserva.
          </p>
        </div>

        <button
          type="button"
          onClick={() => verificarEstado()}
          className="flex w-full items-center justify-center gap-2 bg-black px-4 py-3 text-center text-xs font-semibold uppercase text-white hover:bg-slate-800"
        >
          Reverificar estado de la reserva
        </button>

        <Link
          href="/dashboard/paciente/mis-citas"
          className="block border border-slate-300 bg-white px-4 py-3 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Consultar Mis Citas
        </Link>

        <Link
          href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
          className="block text-center text-xs text-slate-600 no-underline hover:text-slate-900"
        >
          Volver a horarios
        </Link>
      </section>
    )
  }

  if (estado === 'error') {
    return (
      <section className="space-y-3" role="alert">
        <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {mensaje || 'No pudimos confirmar el turno. Por favor, intentá nuevamente.'}
        </p>

        <button
          type="button"
          onClick={confirmar}
          className="w-full bg-black px-4 py-3 text-center text-xs font-semibold uppercase text-white hover:bg-slate-800"
        >
          Intentar nuevamente
        </button>

        <Link
          href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
          className="block text-center text-xs text-slate-600 no-underline hover:text-slate-900"
        >
          Volver a horarios disponibles
        </Link>
      </section>
    )
  }

  const estaProcesando =
    estado === 'cargando' || estado === 'reintentando' || estado === 'verificando'

  return (
    <section className="space-y-3">
      {estado === 'reintentando' && (
        <div
          className="flex items-center gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          <span>Error de conexión, reintentando...</span>
        </div>
      )}

      {estado === 'verificando' && (
        <div
          className="flex items-center gap-2 border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          <span>Estamos verificando tu reserva...</span>
        </div>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={estaProcesando}
        className="flex w-full items-center justify-center gap-2 bg-black px-4 py-3 text-xs font-semibold uppercase text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {estaProcesando && <Spinner />}
        <span>
          {estado === 'cargando'
            ? 'Confirmando...'
            : estado === 'reintentando'
              ? 'Reintentando...'
              : estado === 'verificando'
                ? 'Verificando...'
                : 'Confirmar Turno'}
        </span>
      </button>

      <Link
        href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
        className="block text-center text-xs text-slate-600 no-underline hover:text-slate-900"
      >
        Cancelar / Volver
      </Link>
    </section>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}