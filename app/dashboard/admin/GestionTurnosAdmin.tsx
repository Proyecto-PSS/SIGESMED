'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import styles from './turnos.module.css'
import type { TurnoAdminDTO } from '@/lib/services/admin-turnos-service'

const ESTADOS_DISPONIBLES = [
  { value: '', label: 'Todos los estados' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'CANCELADO', label: 'Cancelado' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'ATENDIDO', label: 'Atendido' },
  { value: 'AUSENTE', label: 'Ausente' },
]

export default function GestionTurnosAdmin() {
  const [turnos, setTurnos] = useState<TurnoAdminDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filtros
  const [pacienteFiltro, setPacienteFiltro] = useState('')
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  // Modales
  const [turnoParaCancelar, setTurnoParaCancelar] = useState<TurnoAdminDTO | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const [turnoParaNotificar, setTurnoParaNotificar] = useState<TurnoAdminDTO | null>(null)
  const [isNotifying, setIsNotifying] = useState(false)
  const handleMarcarAusente = async (idTurno: string) => {
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/turnos/${idTurno}/ausente`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar la ausencia.')
      setTurnos((current) => current.map((turno) => turno.idTurno === idTurno ? { ...turno, estado: 'AUSENTE' } : turno))
      setSuccess('El turno quedó registrado como ausente.')
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar la ausencia.')
    }
  }

  const cargarTurnos = useCallback(
    async (filtros?: { paciente?: string; fecha?: string; estado?: string }) => {
      setIsLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams()
        const p = filtros?.paciente ?? pacienteFiltro
        const f = filtros?.fecha ?? fechaFiltro
        const e = filtros?.estado ?? estadoFiltro

        if (p.trim()) queryParams.set('paciente', p.trim())
        if (f.trim()) queryParams.set('fecha', f.trim())
        if (e.trim()) queryParams.set('estado', e.trim())

        const res = await fetch(`/api/admin/turnos?${queryParams.toString()}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Error al obtener el listado de turnos.')
        }

        setTurnos(data.turnos || [])
      } catch (err: any) {
        setError(err.message || 'Error al conectar con el servidor.')
      } finally {
        setIsLoading(false)
      }
    },
    [pacienteFiltro, fechaFiltro, estadoFiltro]
  )

  useEffect(() => {
    cargarTurnos()
  }, [cargarTurnos])

  const handleBuscar = (e: FormEvent) => {
    e.preventDefault()
    cargarTurnos()
  }

  const handleResetFiltros = () => {
    setPacienteFiltro('')
    setFechaFiltro('')
    setEstadoFiltro('')
    cargarTurnos({ paciente: '', fecha: '', estado: '' })
  }

  // Cancelación administrativa
  const handleConfirmarCancelacion = async () => {
    if (!turnoParaCancelar) return
    setIsCancelling(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/admin/turnos/${turnoParaCancelar.idTurno}/cancelar`, {
        method: 'PUT',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cancelar el turno.')
      }

      setTurnos((prev) =>
        prev.map((t) =>
          t.idTurno === turnoParaCancelar.idTurno
            ? {
                ...t,
                estado: 'CANCELADO',
                motivoCancelacion: 'Cancelación administrativa por modificación de la agenda médica',
                estadoNotificacionCancelacion: 'PENDIENTE',
              }
            : t
        )
      )

      setSuccess('El turno fue cancelado correctamente. Ahora puede notificar al paciente afectado.')
      setTurnoParaCancelar(null)
    } catch (err: any) {
      setError(err.message || 'Error al procesar la cancelación.')
    } finally {
      setIsCancelling(false)
    }
  }

  // Notificación de aviso al paciente
  const handleConfirmarNotificacion = async () => {
    if (!turnoParaNotificar) return
    setIsNotifying(true)
    setError(null)
    setSuccess(null)

    // Marcamos localmente como PROCESANDO
    setTurnos((prev) =>
      prev.map((t) =>
        t.idTurno === turnoParaNotificar.idTurno
          ? { ...t, estadoNotificacionCancelacion: 'PROCESANDO' }
          : t
      )
    )

    try {
      const res = await fetch(`/api/admin/turnos/${turnoParaNotificar.idTurno}/notificar`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar el aviso por correo.')
      }

      setTurnos((prev) =>
        prev.map((t) =>
          t.idTurno === turnoParaNotificar.idTurno
            ? {
                ...t,
                estadoNotificacionCancelacion: 'ENVIADA',
                notificacionCancelacionEnviadaAt: data.notificacion?.enviadaAt || new Date().toISOString(),
              }
            : t
        )
      )

      setSuccess(
        `Aviso de cancelación enviado con éxito al correo ${data.notificacion?.destinatario || turnoParaNotificar.paciente?.email}.`
      )
      setTurnoParaNotificar(null)
    } catch (err: any) {
      setTurnos((prev) =>
        prev.map((t) =>
          t.idTurno === turnoParaNotificar.idTurno
            ? { ...t, estadoNotificacionCancelacion: 'FALLIDA' }
            : t
        )
      )
      setError(err.message || 'Error al intentar notificar al paciente.')
      setTurnoParaNotificar(null)
    } finally {
      setIsNotifying(false)
    }
  }

  const renderBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'CONFIRMADO':
        return <span className={`${styles.badge} ${styles.badgeConfirmado}`}>Confirmado</span>
      case 'CANCELADO':
        return <span className={`${styles.badge} ${styles.badgeCancelado}`}>Cancelado</span>
      case 'DISPONIBLE':
        return <span className={`${styles.badge} ${styles.badgeDisponible}`}>Disponible</span>
      case 'ATENDIDO':
        return <span className={`${styles.badge} ${styles.badgeAtendido}`}>Atendido</span>
      case 'AUSENTE':
        return <span className={`${styles.badge} ${styles.badgeCancelado}`}>Ausente</span>
      default:
        return <span className={styles.badge}>{estado}</span>
    }
  }

  const renderBadgeNotificacion = (turno: TurnoAdminDTO) => {
    if (turno.estado !== 'CANCELADO' || !turno.paciente) return null

    switch (turno.estadoNotificacionCancelacion) {
      case 'ENVIADA':
        const fechaHora = turno.notificacionCancelacionEnviadaAt
          ? new Date(turno.notificacionCancelacionEnviadaAt).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : ''
        return (
          <span className={`${styles.notifBadge} ${styles.notifEnviada}`}>
            ✓ Aviso enviado {fechaHora ? `(${fechaHora})` : ''}
          </span>
        )
      case 'PROCESANDO':
        return (
          <span className={`${styles.notifBadge} ${styles.notifProcesando}`}>
            Enviando aviso...
          </span>
        )
      case 'FALLIDA':
        return (
          <span className={`${styles.notifBadge} ${styles.notifFallida}`}>
            ⚠ Falló el envío
          </span>
        )
      case 'PENDIENTE':
      default:
        return (
          <span className={`${styles.notifBadge} ${styles.notifPendiente}`}>
            ● Aviso pendiente
          </span>
        )
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.eyebrow}>Gestión Administrativa</span>
        <h2 className={styles.title}>Gestión de turnos</h2>
        <p className={styles.description}>
          Búsqueda, cancelación administrativa y notificación por correo de turnos afectados por
          modificaciones en la agenda de los profesionales.
        </p>
      </div>

      {success && (
        <div className={styles.alertSuccess} role="alert">
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className={styles.alertError} role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Formulario de Filtros */}
      <form onSubmit={handleBuscar} className={styles.filtersForm} role="search" aria-label="Filtros de turnos">
        <div className={styles.filterGroup}>
          <label htmlFor="filtro-paciente" className={styles.filterLabel}>
            Paciente (Nombre, DNI o Email)
          </label>
          <input
            id="filtro-paciente"
            type="text"
            className={styles.filterInput}
            placeholder="Ej: Juan Pérez o 34891204"
            value={pacienteFiltro}
            onChange={(e) => setPacienteFiltro(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="filtro-fecha" className={styles.filterLabel}>
            Fecha exacta
          </label>
          <input
            id="filtro-fecha"
            type="date"
            className={styles.filterInput}
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="filtro-estado" className={styles.filterLabel}>
            Estado
          </label>
          <select
            id="filtro-estado"
            className={styles.filterSelect}
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
          >
            {ESTADOS_DISPONIBLES.map((est) => (
              <option key={est.value} value={est.value}>
                {est.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className={styles.filterButtonSearch} disabled={isLoading}>
          {isLoading ? 'Buscando...' : 'Buscar'}
        </button>

        <button
          type="button"
          onClick={handleResetFiltros}
          className={styles.filterButtonReset}
          disabled={isLoading}
        >
          Limpiar filtros
        </button>
      </form>

      {/* Tabla de Resultados */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Médico</th>
              <th>Fecha y Hora</th>
              <th>Estado</th>
              <th>Aviso por Email</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Cargando turnos...
                </td>
              </tr>
            ) : turnos.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  No se encontraron turnos para los criterios seleccionados.
                </td>
              </tr>
            ) : (
              turnos.map((turno) => (
                <tr key={turno.idTurno}>
                  <td>
                    {turno.paciente ? (
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {turno.paciente.nombre} {turno.paciente.apellido}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          DNI {turno.paciente.dni} • {turno.paciente.email}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin paciente asignado</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      Dr./Dra. {turno.medico.nombre} {turno.medico.apellido}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {turno.medico.especialidad.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {turno.fecha}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {turno.hora} hs ({turno.duracionMinutos} min)
                    </div>
                  </td>
                  <td>
                    {renderBadgeEstado(turno.estado)}
                    {turno.motivoCancelacion && (
                      <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
                        {turno.motivoCancelacion}
                      </div>
                    )}
                  </td>
                  <td>{renderBadgeNotificacion(turno)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {turno.estado === 'CONFIRMADO' && turno.paciente && new Date(`${turno.fecha}T${turno.hora}:00-03:00`).getTime() < Date.now() && (
                      <button type="button" onClick={() => handleMarcarAusente(turno.idTurno)} className={styles.btnActionRetry}>
                        Marcar ausente
                      </button>
                    )}
                    {turno.estado === 'CONFIRMADO' && (
                      <button
                        type="button"
                        onClick={() => setTurnoParaCancelar(turno)}
                        className={styles.btnActionCancel}
                      >
                        Cancelar turno
                      </button>
                    )}

                    {turno.estado === 'CANCELADO' && turno.paciente && (
                      <>
                        {turno.estadoNotificacionCancelacion === 'ENVIADA' ? (
                          <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                            Completado
                          </span>
                        ) : turno.estadoNotificacionCancelacion === 'FALLIDA' ? (
                          <button
                            type="button"
                            onClick={() => setTurnoParaNotificar(turno)}
                            className={styles.btnActionRetry}
                          >
                            Reintentar aviso
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setTurnoParaNotificar(turno)}
                            className={styles.btnActionNotify}
                            disabled={turno.estadoNotificacionCancelacion === 'PROCESANDO'}
                          >
                            {turno.estadoNotificacionCancelacion === 'PROCESANDO'
                              ? 'Enviando...'
                              : 'Notificar paciente'}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmación de Cancelación (RF-21.5) */}
      {turnoParaCancelar && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-cancel-title">
          <div className={styles.modalContent}>
            <h3 id="modal-cancel-title" className={styles.modalTitle}>
              Confirmar cancelación administrativa
            </h3>

            <div className={styles.modalWarning}>
              <strong>Atención:</strong> Se cancelará el turno debido a una modificación de la agenda
              médica. El turno permanecerá asociado al paciente para permitir su posterior notificación y
              no volverá a estar disponible para reserva.
            </div>

            <div className={styles.modalInfoGrid}>
              <span className={styles.modalInfoLabel}>Paciente:</span>
              <span className={styles.modalInfoValue}>
                {turnoParaCancelar.paciente?.nombre} {turnoParaCancelar.paciente?.apellido} (DNI{' '}
                {turnoParaCancelar.paciente?.dni})
              </span>

              <span className={styles.modalInfoLabel}>Profesional:</span>
              <span className={styles.modalInfoValue}>
                Dr./Dra. {turnoParaCancelar.medico.nombre} {turnoParaCancelar.medico.apellido}
              </span>

              <span className={styles.modalInfoLabel}>Cita:</span>
              <span className={styles.modalInfoValue}>
                {turnoParaCancelar.fecha} a las {turnoParaCancelar.hora} hs
              </span>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setTurnoParaCancelar(null)}
                className={styles.modalBtnSecondary}
                disabled={isCancelling}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmarCancelacion}
                className={styles.modalBtnDanger}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Notificación (US-22) */}
      {turnoParaNotificar && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="modal-notif-title">
          <div className={styles.modalContent}>
            <h3 id="modal-notif-title" className={styles.modalTitle}>
              Notificar cancelación al paciente
            </h3>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: '16px' }}>
              Se enviará un correo formal institucional informando al paciente que su turno fue cancelado
              debido a modificaciones en los horarios de atención del profesional.
            </p>

            <div className={styles.modalInfoGrid}>
              <span className={styles.modalInfoLabel}>Destinatario:</span>
              <span className={styles.modalInfoValue}>
                {turnoParaNotificar.paciente?.email} ({turnoParaNotificar.paciente?.nombre}{' '}
                {turnoParaNotificar.paciente?.apellido})
              </span>

              <span className={styles.modalInfoLabel}>Profesional:</span>
              <span className={styles.modalInfoValue}>
                Dr./Dra. {turnoParaNotificar.medico.nombre} {turnoParaNotificar.medico.apellido}
              </span>

              <span className={styles.modalInfoLabel}>Fecha y Hora:</span>
              <span className={styles.modalInfoValue}>
                {turnoParaNotificar.fecha} a las {turnoParaNotificar.hora} hs
              </span>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setTurnoParaNotificar(null)}
                className={styles.modalBtnSecondary}
                disabled={isNotifying}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmarNotificacion}
                className={styles.modalBtnPrimary}
                disabled={isNotifying}
              >
                {isNotifying ? 'Enviando aviso...' : 'Enviar aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
