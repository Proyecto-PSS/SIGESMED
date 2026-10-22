'use client'

import React, { useState, useEffect } from 'react'
import type { VacunaItem } from './GestionStockVacunas'

export interface TurnoVacunacionItem {
  idTurnoVacunacion: string
  fecha: string
  hora: string
  estado: 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'APLICADO'
  vacuna: {
    idVacuna: string
    nombre: string
    stock: number
  }
  lote?: {
    idLote: string
    numeroLote: string
  } | null
  paciente?: {
    idPaciente: string
    nombre: string
    apellido: string
    dni: string
    email: string
  } | null
}

export interface PacienteItem {
  idPaciente: string
  nombre: string
  apellido: string
  dni: string
  email: string
}

interface GestionTurnosVacunacionProps {
  vacunas: VacunaItem[]
  turnos: TurnoVacunacionItem[]
  pacientes: PacienteItem[]
  cargando: boolean
  onActualizacionNecesaria: () => void
  onNotificarDesconexion?: () => void
}

export default function GestionTurnosVacunacion({
  vacunas,
  turnos,
  pacientes,
  cargando,
  onActualizacionNecesaria,
  onNotificarDesconexion,
}: GestionTurnosVacunacionProps) {
  // Formulario de asignación express / mostrador
  const [idPaciente, setIdPaciente] = useState<string>('')
  const [idVacuna, setIdVacuna] = useState<string>('')
  const [idLote, setIdLote] = useState<string>('')
  const [idTurnoSeleccionado, setIdTurnoSeleccionado] = useState<string>('')
  const [modoCrearExpress, setModoCrearExpress] = useState<boolean>(false)
  const [fechaExpress, setFechaExpress] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [horaExpress, setHoraExpress] = useState<string>('09:00')

  // Clave de idempotencia y retención resiliente
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `asig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const [procesando, setProcesando] = useState<boolean>(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [datosGuardadosOffline, setDatosGuardadosOffline] = useState<boolean>(false)

  // Filtro de lista
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')

  useEffect(() => {
    if (!idVacuna && vacunas.length > 0) {
      setIdVacuna(vacunas[0].idVacuna)
    }
  }, [vacunas, idVacuna])

  useEffect(() => {
    if (!idPaciente && pacientes.length > 0) {
      setIdPaciente(pacientes[0].idPaciente)
    }
  }, [pacientes, idPaciente])

  const vacunaSeleccionada = vacunas.find((v) => v.idVacuna === idVacuna)
  const turnosDisponibles = turnos.filter((t) => t.estado === 'DISPONIBLE')

  const handleAsignarTurno = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensajeExito(null)
    setMensajeError(null)
    setDatosGuardadosOffline(false)

    if (!idPaciente) {
      setMensajeError('Debe seleccionar un paciente.')
      return
    }

    if (!idVacuna) {
      setMensajeError('Debe seleccionar una vacuna.')
      return
    }

    setProcesando(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 7000)

      let res: Response

      if (modoCrearExpress || !idTurnoSeleccionado) {
        // Asignación express por demanda espontánea
        res = await fetch('/api/enfermeria/vacunacion/turnos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({
            idPaciente,
            idVacuna,
            idLote: idLote || undefined,
            fecha: fechaExpress,
            hora: horaExpress,
            idempotencyKey,
          }),
          signal: controller.signal,
        })
      } else {
        // Asignación de turno existente disponible
        res = await fetch(`/api/enfermeria/vacunacion/turnos/${idTurnoSeleccionado}/asignar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({
            idPaciente,
            idVacuna,
            idLote: idLote || undefined,
            idempotencyKey,
          }),
          signal: controller.signal,
        })
      }

      clearTimeout(timeoutId)
      const data = await res.json()

      if (!res.ok) {
        // RF-20.6 / RF-20.7: Error de negocio (ej. Stock insuficiente o turno ocupado)
        setMensajeError(data.error || 'No se pudo completar la asignación del turno.')
        // RF-20.5: NO se borran los datos del formulario
        return
      }

      // ÉXITO CONFIRMADO
      setMensajeExito('Turno de vacunación asignado y dosis comprometida exitosamente.')
      setIdTurnoSeleccionado('')
      setIdLote('')
      // Generar nueva clave para la próxima asignación
      setIdempotencyKey(`asig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

      // Refrescar inventario y lista de turnos
      onActualizacionNecesaria()
    } catch (err: any) {
      // Error de red, desconexión o timeout
      onNotificarDesconexion?.()
      setDatosGuardadosOffline(true)
      setMensajeError(
        'Falla de conexión o timeout con el servidor. Los datos seleccionados fueron CONSERVADOS intactos. Puede reintentar cuando vuelva la conexión.'
      )
    } finally {
      setProcesando(false)
    }
  }

  const handleAplicarDosis = async (idTurnoVacunacion: string) => {
    setProcesando(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const res = await fetch(`/api/enfermeria/vacunacion/turnos/${idTurnoVacunacion}/aplicar`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || 'No se pudo registrar la aplicación.')
        return
      }

      setMensajeExito('Dosis registrada como efectivamente APLICADA al paciente.')
      onActualizacionNecesaria()
    } catch {
      onNotificarDesconexion?.()
      setMensajeError('Error de conexión al registrar la aplicación de la dosis.')
    } finally {
      setProcesando(false)
    }
  }

  const handleCancelarTurno = async (idTurnoVacunacion: string) => {
    if (!confirm('¿Confirma que desea cancelar este turno? La dosis de stock comprometida será restituida al inventario.')) {
      return
    }

    setProcesando(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const res = await fetch(`/api/enfermeria/vacunacion/turnos/${idTurnoVacunacion}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Cancelado por enfermería' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensajeError(data.error || 'No se pudo cancelar el turno.')
        return
      }

      setMensajeExito('Turno cancelado y dosis de vacuna devuelta al stock disponible.')
      onActualizacionNecesaria()
    } catch {
      onNotificarDesconexion?.()
      setMensajeError('Error de conexión al cancelar el turno.')
    } finally {
      setProcesando(false)
    }
  }

  const turnosFiltrados = turnos.filter((t) => {
    if (filtroEstado === 'TODOS') return true
    return t.estado === filtroEstado
  })

  return (
    <div className="space-y-6">
      {/* Formulario de Asignación de Turno (Resiliente y Concurrente) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="mb-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Atención Express y Mostrador
            </span>
            <h2 className="text-lg font-bold text-slate-900">Asignación de Turno de Vacunación</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModoCrearExpress(!modoCrearExpress)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              {modoCrearExpress ? 'Modo: Usar Turno de Agenda' : 'Modo: Demanda Espontánea Express'}
            </button>
          </div>
        </div>

        {mensajeExito && (
          <div className="mb-4 p-3 bg-slate-100 border border-slate-800 text-slate-900 font-medium text-xs rounded-lg flex items-center gap-2">
            <span className="font-bold">✓</span>
            <span>{mensajeExito}</span>
          </div>
        )}

        {mensajeError && (
          <div className="mb-4 p-3 bg-slate-100 border-2 border-black text-slate-900 text-xs rounded-lg space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <span>⚠</span>
              <span>{mensajeError}</span>
            </div>
            {datosGuardadosOffline && (
              <p className="text-[11px] text-slate-700">
                Sus datos están retenidos intactos en este formulario. Presione &quot;Reintentar Asignación&quot; al restablecerse la red.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleAsignarTurno} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Paciente */}
            <div>
              <label htmlFor="paciente-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Paciente <span className="text-slate-900 font-bold">*</span>
              </label>
              <select
                id="paciente-select"
                value={idPaciente}
                onChange={(e) => setIdPaciente(e.target.value)}
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              >
                {pacientes.map((p) => (
                  <option key={p.idPaciente} value={p.idPaciente}>
                    {p.apellido}, {p.nombre} (DNI: {p.dni})
                  </option>
                ))}
              </select>
            </div>

            {/* Vacuna */}
            <div>
              <label htmlFor="vacuna-turno-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Vacuna Biológica <span className="text-slate-900 font-bold">*</span>
              </label>
              <select
                id="vacuna-turno-select"
                value={idVacuna}
                onChange={(e) => {
                  setIdVacuna(e.target.value)
                  setIdLote('')
                }}
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              >
                {vacunas.map((v) => (
                  <option key={v.idVacuna} value={v.idVacuna}>
                    {v.nombre} — Stock Disp: {v.stockDisponible}
                  </option>
                ))}
              </select>
            </div>

            {/* Lote (opcional) */}
            <div>
              <label htmlFor="lote-turno-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Lote de Dosis <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <select
                id="lote-turno-select"
                value={idLote}
                onChange={(e) => setIdLote(e.target.value)}
                disabled={procesando || !vacunaSeleccionada || vacunaSeleccionada.lotes.length === 0}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Cualquier lote disponible</option>
                {vacunaSeleccionada?.lotes.map((l) => (
                  <option key={l.idLote} value={l.idLote}>
                    {l.numeroLote} ({l.stock} dosis)
                  </option>
                ))}
              </select>
            </div>

            {modoCrearExpress ? (
              <>
                {/* Fecha express */}
                <div>
                  <label htmlFor="fecha-express" className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Atención <span className="text-slate-900 font-bold">*</span>
                  </label>
                  <input
                    id="fecha-express"
                    type="date"
                    value={fechaExpress}
                    onChange={(e) => setFechaExpress(e.target.value)}
                    disabled={procesando}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                {/* Hora express */}
                <div>
                  <label htmlFor="hora-express" className="block text-xs font-semibold text-slate-700 mb-1">
                    Horario de Atención <span className="text-slate-900 font-bold">*</span>
                  </label>
                  <input
                    id="hora-express"
                    type="time"
                    value={horaExpress}
                    onChange={(e) => setHoraExpress(e.target.value)}
                    disabled={procesando}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>
              </>
            ) : (
              /* Turno de agenda disponible */
              <div className="sm:col-span-2">
                <label htmlFor="turno-disponible-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Franja Horaria Disponible <span className="text-slate-900 font-bold">*</span>
                </label>
                <select
                  id="turno-disponible-select"
                  value={idTurnoSeleccionado}
                  onChange={(e) => setIdTurnoSeleccionado(e.target.value)}
                  disabled={procesando}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">
                    {turnosDisponibles.length > 0
                      ? 'Seleccione una franja horaria existente...'
                      : 'No hay franjas preconfiguradas (use Demanda Espontánea Express)'}
                  </option>
                  {turnosDisponibles.map((t) => (
                    <option key={t.idTurnoVacunacion} value={t.idTurnoVacunacion}>
                      Fecha: {t.fecha.slice(0, 10)} | Hora: {t.hora} hs | Vacuna: {t.vacuna.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px]">
              {vacunaSeleccionada && (
                <span
                  className={`font-semibold ${
                    vacunaSeleccionada.stockDisponible === 0
                      ? 'text-slate-900 font-bold underline'
                      : vacunaSeleccionada.stockDisponible <= 2
                      ? 'text-slate-800'
                      : 'text-slate-600'
                  }`}
                >
                  Disponibilidad actual: {vacunaSeleccionada.stockDisponible} dosis.
                  {vacunaSeleccionada.stockDisponible === 0 && ' (¡Sin stock para asignar!)'}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={procesando || (vacunaSeleccionada && vacunaSeleccionada.stockDisponible === 0)}
              className={`text-xs font-bold px-4 py-2 rounded-lg text-white transition-all shadow-sm ${
                procesando || (vacunaSeleccionada && vacunaSeleccionada.stockDisponible === 0)
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95'
              }`}
            >
              {procesando
                ? 'Asignando Dosis en BD...'
                : datosGuardadosOffline
                ? 'Reintentar Asignación'
                : 'Confirmar Asignación de Turno'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Turnos de Vacunación */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Fila y Agenda
            </span>
            <h2 className="text-lg font-bold text-slate-900">Turnos de Vacunación Programados</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filtrar:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="CONFIRMADO">Confirmados (Pendiente Dosis)</option>
              <option value="APLICADO">Aplicados</option>
              <option value="DISPONIBLE">Disponibles</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </div>
        </div>

        {cargando && turnos.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">Cargando turnos de vacunación...</div>
        ) : turnosFiltrados.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No hay turnos registrados que coincidan con el filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase text-[10px] font-mono font-bold">
                <tr>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Vacuna</th>
                  <th className="py-2.5 px-3">Paciente</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {turnosFiltrados.map((t) => {
                  const badgeColor =
                    t.estado === 'CONFIRMADO'
                      ? 'bg-slate-900 text-white border-black'
                      : t.estado === 'APLICADO'
                      ? 'bg-slate-200 text-slate-900 border-slate-400 font-semibold'
                      : t.estado === 'DISPONIBLE'
                      ? 'bg-white text-slate-700 border-slate-300'
                      : 'bg-slate-100 text-slate-500 border-slate-300'

                  return (
                    <tr key={t.idTurnoVacunacion} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {t.fecha.slice(0, 10)} - {t.hora} hs
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{t.vacuna?.nombre}</span>
                        {t.lote && <span className="text-[10px] font-mono text-slate-500 block">Lote: {t.lote.numeroLote}</span>}
                      </td>
                      <td className="py-3 px-3">
                        {t.paciente ? (
                          <div>
                            <span className="font-medium text-slate-900 block">
                              {t.paciente.apellido}, {t.paciente.nombre}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 block">DNI: {t.paciente.dni}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin paciente asignado</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        {t.estado === 'CONFIRMADO' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAplicarDosis(t.idTurnoVacunacion)}
                              disabled={procesando}
                              className="text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-800 px-2.5 py-1 rounded border border-black transition-colors"
                              title="Marcar dosis como administrada (no duplica descuento de stock)"
                            >
                              ✓ Aplicar Dosis
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelarTurno(t.idTurnoVacunacion)}
                              disabled={procesando}
                              className="text-[11px] font-semibold bg-white text-slate-900 hover:bg-slate-100 px-2.5 py-1 rounded border border-slate-300 transition-colors"
                              title="Cancelar y restituir dosis al stock"
                            >
                              ✕ Cancelar
                            </button>
                          </>
                        )}
                        {t.estado === 'DISPONIBLE' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIdTurnoSeleccionado(t.idTurnoVacunacion)
                              setModoCrearExpress(false)
                              window.scrollTo({ top: 200, behavior: 'smooth' })
                            }}
                            className="text-[11px] font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-300 transition-colors"
                          >
                            Asignar...
                          </button>
                        )}
                        {t.estado === 'APLICADO' && (
                          <span className="text-[11px] text-slate-600 font-mono font-medium">Completado</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
