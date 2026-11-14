'use client'

// Ejecuta la confirmación resiliente del turno (US-09 y US-18): idempotencia, retries controlados y verificación.
import Link from 'next/link'
import { useState, useRef } from 'react'
import { RESERVA_CONFIG } from '@/lib/config/reserva-config'
import { esperar, fetchConTimeout } from '@/lib/utils/resilient-fetch'
import ui from '@/components/paciente/ui/ui.module.css'

type Props = {
  idTurno: string
  idMedico: string
  modalidad: 'PARTICULAR' | 'COBERTURA'
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

export default function ConfirmarReserva({ idTurno, idMedico, modalidad }: Props) {
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
              modalidad,
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

  const urlHorarios = `/dashboard/paciente/reservar-turno/horarios/${idMedico}`

  if (estado === 'confirmado') {
    return (
      <section className={ui.pila} role="status" aria-live="polite">
        <div className={`${ui.alerta} ${ui.alertaExito}`}>
          <strong>¡Turno confirmado!</strong>
          <br />
          La reserva quedó registrada a tu nombre.
        </div>

        {modalidad === 'PARTICULAR' ? (
          <Link href={`/dashboard/paciente/pagos/${idTurno}`} className={`${ui.botonPrimario} ${ui.botonAncho}`}>
            Continuar al pago
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <p className={`${ui.alerta} ${ui.alertaInfo}`}>Tu obra social quedó asociada a este turno.</p>
        )}

        <Link
          href="/dashboard/paciente/mis-citas"
          className={`${modalidad === 'PARTICULAR' ? ui.botonSecundario : ui.botonPrimario} ${ui.botonAncho}`}
        >
          Ver mis turnos
        </Link>
      </section>
    )
  }

  if (estado === 'conflicto') {
    return (
      <section className={ui.pila} role="alert">
        <div className={`${ui.alerta} ${ui.alertaError}`}>
          <strong>Turno no disponible</strong>
          <br />
          {mensaje || 'Este turno ya no está disponible.'}
        </div>
        <Link href={urlHorarios} className={`${ui.botonPrimario} ${ui.botonAncho}`}>
          Ver otros horarios
        </Link>
      </section>
    )
  }

  if (estado === 'verificacion_pendiente') {
    return (
      <section className={ui.pila} role="alert">
        <div className={`${ui.alerta} ${ui.alertaAviso}`}>
          <strong>Verificación pendiente</strong>
          <br />
          No pudimos saber si tu reserva se completó por una falla de conexión. Puede que el turno ya esté
          registrado: verificá el estado antes de intentar reservar de nuevo.
        </div>
        <button type="button" onClick={() => verificarEstado()} className={`${ui.botonPrimario} ${ui.botonAncho}`}>
          Verificar estado de la reserva
        </button>
        <Link href="/dashboard/paciente/mis-citas" className={`${ui.botonSecundario} ${ui.botonAncho}`}>
          Consultar mis turnos
        </Link>
        <Link href={urlHorarios} className={ui.linkSuave}>
          Volver a horarios
        </Link>
      </section>
    )
  }

  if (estado === 'error') {
    return (
      <section className={ui.pila} role="alert">
        <p className={`${ui.alerta} ${ui.alertaError}`}>
          {mensaje || 'No pudimos confirmar el turno. Por favor, intentá nuevamente.'}
        </p>
        <button type="button" onClick={confirmar} className={`${ui.botonPrimario} ${ui.botonAncho}`}>
          Intentar nuevamente
        </button>
        <Link href={urlHorarios} className={ui.linkSuave}>
          Volver a horarios disponibles
        </Link>
      </section>
    )
  }

  const estaProcesando =
    estado === 'cargando' || estado === 'reintentando' || estado === 'verificando'

  return (
    <section className={ui.pila}>
      {estado === 'reintentando' && (
        <div className={`${ui.alerta} ${ui.alertaAviso} ${ui.conIcono}`} role="status" aria-live="polite">
          <span className={ui.spinner} aria-hidden="true" />
          <span>Error de conexión, reintentando…</span>
        </div>
      )}

      {estado === 'verificando' && (
        <div className={`${ui.alerta} ${ui.alertaInfo} ${ui.conIcono}`} role="status" aria-live="polite">
          <span className={ui.spinner} aria-hidden="true" />
          <span>Estamos verificando tu reserva…</span>
        </div>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={estaProcesando}
        className={`${ui.botonPrimario} ${ui.botonAncho}`}
      >
        {estaProcesando && <span className={ui.spinner} aria-hidden="true" />}
        <span>
          {estado === 'cargando'
            ? 'Confirmando…'
            : estado === 'reintentando'
              ? 'Reintentando…'
              : estado === 'verificando'
                ? 'Verificando…'
                : 'Confirmar turno'}
        </span>
      </button>

      <Link href={urlHorarios} className={ui.linkSuave}>
        Cancelar y volver a horarios
      </Link>
    </section>
  )
}
