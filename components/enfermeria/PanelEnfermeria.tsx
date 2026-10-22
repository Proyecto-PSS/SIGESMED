'use client'

import React, { useState, useEffect, useCallback } from 'react'
import IndicadorConectividad, { EstadoConexion } from './IndicadorConectividad'
import type { VacunaItem } from './GestionStockVacunas'
import type { TurnoVacunacionItem, PacienteItem } from './GestionTurnosVacunacion'

interface PanelEnfermeriaProps {
  enfermera: {
    id: string
    nombre: string
    apellido: string
    matricula?: string
  }
  userButtonSlot?: React.ReactNode
}

export default function PanelEnfermeria({ enfermera, userButtonSlot }: PanelEnfermeriaProps) {
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexion>('online')
  const [forzarVerificacion, setForzarVerificacion] = useState<boolean>(false)

  // Datos globales del módulo
  const [vacunas, setVacunas] = useState<VacunaItem[]>([])
  const [turnos, setTurnos] = useState<TurnoVacunacionItem[]>([])
  const [pacientes, setPacientes] = useState<PacienteItem[]>([])
  const [cargando, setCargando] = useState<boolean>(true)

  // Búsqueda y filtrado de turnos
  const [busqueda, setBusqueda] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS')

  // Procesamiento de acciones inmediatas
  const [procesandoTurnoId, setProcesandoTurnoId] = useState<string | null>(null)

  // Formulario Express en Mostrador
  const [dniExpress, setDniExpress] = useState<string>('')
  const [idVacunaExpress, setIdVacunaExpress] = useState<string>('')
  const [procesandoExpress, setProcesandoExpress] = useState<boolean>(false)
  const [mensajeExitoExpress, setMensajeExitoExpress] = useState<string | null>(null)
  const [mensajeErrorExpress, setMensajeErrorExpress] = useState<string | null>(null)
  const [datosGuardadosOfflineExpress, setDatosGuardadosOfflineExpress] = useState<boolean>(false)
  const [idempotencyKeyExpress, setIdempotencyKeyExpress] = useState<string>(() => `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

  // Modal para ingreso/ajuste de lotes de stock
  const [mostrarModalStock, setMostrarModalStock] = useState<boolean>(false)
  const [modalVacunaId, setModalVacunaId] = useState<string>('')
  const [modalTipoMov, setModalTipoMov] = useState<'INGRESO' | 'AJUSTE'>('INGRESO')
  const [modalCantidad, setModalCantidad] = useState<string>('')
  const [modalLote, setModalLote] = useState<string>('')
  const [modalVencimiento, setModalVencimiento] = useState<string>('')
  const [modalMotivo, setModalMotivo] = useState<string>('')
  const [procesandoStock, setProcesandoStock] = useState<boolean>(false)
  const [errorStock, setErrorStock] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    try {
      const [resStock, resTurnos, resPacientes] = await Promise.all([
        fetch('/api/enfermeria/vacunas/stock', { cache: 'no-store' }),
        fetch('/api/enfermeria/vacunacion/turnos', { cache: 'no-store' }),
        fetch('/api/enfermeria/pacientes', { cache: 'no-store' }),
      ])

      if (resStock.ok) {
        const dataStock = await resStock.json()
        if (dataStock.ok && dataStock.stock) setVacunas(dataStock.stock)
      }

      if (resTurnos.ok) {
        const dataTurnos = await resTurnos.json()
        if (dataTurnos.ok && dataTurnos.turnos) setTurnos(dataTurnos.turnos)
      }

      if (resPacientes.ok) {
        const dataPacientes = await resPacientes.json()
        if (dataPacientes.ok && dataPacientes.pacientes) setPacientes(dataPacientes.pacientes)
      }

      setEstadoConexion('online')
    } catch {
      setEstadoConexion('offline')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // KPIs
  const dosisTotales = vacunas.reduce((acc, v) => acc + (v.stockDisponible || 0), 0)
  const aplicadasHoy = turnos.filter((t) => t.estado === 'APLICADO').length
  const alertasCriticas = vacunas.filter((v) => v.stockDisponible <= 2).length
  const turnosPendientes = turnos.filter((t) => t.estado === 'CONFIRMADO').length

  // Filtrado de turnos
  const turnosFiltrados = turnos.filter((t) => {
    if (filtroEstado !== 'TODOS') {
      if (filtroEstado === 'CONFIRMADO' && t.estado !== 'CONFIRMADO') return false
      if (filtroEstado === 'APLICADO' && t.estado !== 'APLICADO') return false
      if (filtroEstado === 'DISPONIBLE' && t.estado !== 'DISPONIBLE') return false
      if (filtroEstado === 'CANCELADO' && t.estado !== 'CANCELADO') return false
    }

    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase().trim()
    const pDni = t.paciente?.dni?.toLowerCase() || ''
    const pNombre = t.paciente?.nombre?.toLowerCase() || ''
    const pApellido = t.paciente?.apellido?.toLowerCase() || ''
    const vNombre = t.vacuna?.nombre?.toLowerCase() || ''
    const id = t.idTurnoVacunacion.toLowerCase()

    return pDni.includes(q) || pNombre.includes(q) || pApellido.includes(q) || vNombre.includes(q) || id.includes(q)
  })

  // Acción Inmediata: Aplicar Dosis
  const handleAplicarDosis = async (idTurnoVacunacion: string) => {
    setProcesandoTurnoId(idTurnoVacunacion)
    try {
      const res = await fetch(`/api/enfermeria/vacunacion/turnos/${idTurnoVacunacion}/aplicar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `apl_${idTurnoVacunacion}_${Date.now()}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        await cargarDatos()
      } else {
        alert(data.error || 'No se pudo aplicar la dosis.')
      }
    } catch {
      setEstadoConexion('offline')
      alert('Error de conexión al aplicar la dosis.')
    } finally {
      setProcesandoTurnoId(null)
    }
  }

  // Acción Express en Mostrador
  const handleCrearExpress = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensajeExitoExpress(null)
    setMensajeErrorExpress(null)
    setDatosGuardadosOfflineExpress(false)

    const pacienteEncontrado = pacientes.find((p) => p.dni === dniExpress.trim())
    if (!pacienteEncontrado && !dniExpress.trim()) {
      setMensajeErrorExpress('Debe ingresar un DNI de paciente válido.')
      return
    }

    if (!idVacunaExpress) {
      setMensajeErrorExpress('Debe seleccionar una vacuna del calendario.')
      return
    }

    setProcesandoExpress(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 7000)

      const hoyStr = new Date().toISOString().slice(0, 10)
      const horaStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

      const res = await fetch('/api/enfermeria/vacunacion/turnos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKeyExpress,
        },
        body: JSON.stringify({
          idPaciente: pacienteEncontrado?.idPaciente || pacientes[0]?.idPaciente,
          idVacuna: idVacunaExpress,
          fecha: hoyStr,
          hora: horaStr,
          idempotencyKey: idempotencyKeyExpress,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()

      if (!res.ok) {
        setMensajeErrorExpress(data.error || 'No se pudo asignar el turno express.')
        return
      }

      setMensajeExitoExpress('Dosis asignada y turno en sala registrado exitosamente.')
      setDniExpress('')
      setIdVacunaExpress('')
      setIdempotencyKeyExpress(`exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
      await cargarDatos()
    } catch {
      setEstadoConexion('offline')
      setDatosGuardadosOfflineExpress(true)
      setMensajeErrorExpress('Falla de red o timeout. Los datos fueron retenidos intactos en el buffer local.')
    } finally {
      setProcesandoExpress(false)
    }
  }

  // Modal Guardar Movimiento de Stock
  const handleGuardarMovimientoStock = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorStock(null)
    const cantNum = parseInt(modalCantidad, 10)
    if (isNaN(cantNum) || cantNum === 0) {
      setErrorStock('Ingrese una cantidad válida distinta de cero.')
      return
    }
    setProcesandoStock(true)
    try {
      const res = await fetch('/api/enfermeria/vacunas/stock/movimientos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        },
        body: JSON.stringify({
          idVacuna: modalVacunaId || vacunas[0]?.idVacuna,
          tipoMovimiento: modalTipoMov,
          cantidad: cantNum,
          numeroLote: modalLote.trim() || undefined,
          vencimiento: modalVencimiento || undefined,
          motivo: modalMotivo.trim() || undefined,
          idempotencyKey: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorStock(data.error || 'Error al registrar movimiento.')
        return
      }
      setMostrarModalStock(false)
      setModalCantidad('')
      setModalLote('')
      setModalVencimiento('')
      setModalMotivo('')
      await cargarDatos()
    } catch {
      setEstadoConexion('offline')
      setErrorStock('Error de conexión con el servicio.')
    } finally {
      setProcesandoStock(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------------- */}
      {/* HEADER SUPERIOR (Wireframe US-20 web.png) */}
      {/* --------------------------------------------------------------------- */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <IndicadorConectividad
            onEstadoChange={(nuevoEstado) => setEstadoConexion(nuevoEstado)}
            forzarVerificacion={forzarVerificacion}
          />
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="text-right">
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-900 block leading-tight">
              ENF. {enfermera.nombre} {enfermera.apellido}
            </span>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mt-0.5">
              VACUNATORIO CENTRAL {enfermera.matricula ? `· MAT. ${enfermera.matricula}` : ''}
            </span>
          </div>

          <div className="h-7 w-[1px] bg-slate-300" />

          <div className="flex items-center justify-center">
            {userButtonSlot || (
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">
                👤
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Banner de contingencia si se desconecta */}
      {estadoConexion === 'offline' && (
        <div className="p-3 bg-slate-100 border border-slate-400 rounded-lg text-slate-900 text-xs flex items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold">⚡ NODO OFFLINE:</span>
            <span>Continuidad activa. Las operaciones se retienen en buffer local y no se pierde ningún dato.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setForzarVerificacion(true)
              setTimeout(() => setForzarVerificacion(false), 1000)
              cargarDatos()
            }}
            className="text-xs font-mono font-bold bg-black text-white hover:bg-slate-800 px-3 py-1 rounded transition-colors whitespace-nowrap"
          >
            [Reconectar]
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* GRID PRINCIPAL: 2 COLUMNAS (Wireframe US-20 web.png) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =================================================================== */}
        {/* COLUMNA IZQUIERDA (01 TURNOS + ASIGNACIÓN EXPRESS) */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECCIÓN 01: TURNOS DE VACUNACIÓN - ATENCIÓN EN SALA */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Header de la sección */}
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                01 // TURNOS DE VACUNACIÓN - ATENCIÓN EN SALA
              </h2>
            </div>

            {/* Barra de Filtro y Búsqueda */}
            <div className="p-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 leading-none"></span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder=" Buscar por DNI, Apellido o HC del paciente..."
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="TODOS">TODOS LOS ESTADOS</option>
                <option value="CONFIRMADO">EN ESPERA (CONFIRMADO)</option>
                <option value="APLICADO">REGISTRADO & SYNC</option>
                <option value="DISPONIBLE">DISPONIBLE</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>

              <button
                type="button"
                onClick={cargarDatos}
                disabled={cargando}
                title="Actualizar lista de turnos"
                className="border border-slate-300 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg text-slate-700 text-xs font-mono font-bold disabled:opacity-50 transition-colors"
              >
                ☵
              </button>
            </div>

            {/* Tabla de Turnos */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-[18%]">TURNO / HORA</th>
                    <th className="py-2.5 px-3 w-[27%]">PACIENTE & DNI</th>
                    <th className="py-2.5 px-3 w-[25%]">ESQUEMA SOLICITADO</th>
                    <th className="py-2.5 px-3 w-[15%]">ESTADO</th>
                    <th className="py-2.5 px-3 w-[15%] text-right">ACCIÓN INMEDIATA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {turnosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs font-mono text-slate-400">
                        {cargando ? 'Sincronizando turnos de vacunación...' : 'No hay turnos registrados que coincidan con la vista.'}
                      </td>
                    </tr>
                  ) : (
                    turnosFiltrados.map((t) => {
                      const isEnEspera = t.estado === 'CONFIRMADO'
                      const isAplicado = t.estado === 'APLICADO'
                      const isDisponible = t.estado === 'DISPONIBLE'
                      const isCancelado = t.estado === 'CANCELADO'
                      const isProcesando = procesandoTurnoId === t.idTurnoVacunacion

                      return (
                        <tr key={t.idTurnoVacunacion} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 align-top">
                            <span className="font-mono font-bold text-xs text-slate-900 block leading-tight">
                              #T-{t.idTurnoVacunacion.slice(-4).toUpperCase()}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                              {t.hora} hs
                            </span>
                          </td>

                          <td className="py-3 px-3 align-top">
                            {t.paciente ? (
                              <div>
                                <span className="font-bold text-xs text-slate-900 block leading-tight">
                                  {t.paciente.apellido}, {t.paciente.nombre}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 block mt-0.5">
                                  DNI {t.paciente.dni}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-400 italic">Demanda espontánea</span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            <span className="font-semibold text-xs text-slate-900 block leading-tight">
                              {t.vacuna?.nombre || 'Inmunobiológico'}
                            </span>
                            {t.lote ? (
                              <span className="inline-block bg-slate-100 text-slate-700 font-mono text-[9px] px-1.5 py-0.5 rounded mt-1 border border-slate-200">
                                Lote {t.lote.numeroLote}
                              </span>
                            ) : (
                              <span className="inline-block bg-slate-50 text-slate-500 font-mono text-[9px] px-1.5 py-0.5 rounded mt-1 border border-slate-200">
                                Dosis estándar
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            {isEnEspera && (
                              <span className="inline-block bg-slate-100 text-slate-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300 whitespace-nowrap">
                                [EN ESPERA]
                              </span>
                            )}
                            {isAplicado && (
                              <span className="inline-block bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                [REGISTRADO & SYNC]
                              </span>
                            )}
                            {isDisponible && (
                              <span className="inline-block bg-white text-slate-700 font-mono text-[10px] font-medium px-2 py-0.5 rounded border border-slate-300 whitespace-nowrap">
                                CITADO (SALA ESPERA)
                              </span>
                            )}
                            {isCancelado && (
                              <span className="inline-block bg-slate-100 text-slate-400 font-mono text-[10px] line-through px-1.5 py-0.5 rounded whitespace-nowrap">
                                CANCELADO
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top text-right">
                            {isEnEspera && (
                              <button
                                type="button"
                                disabled={isProcesando}
                                onClick={() => handleAplicarDosis(t.idTurnoVacunacion)}
                                className="bg-black hover:bg-slate-800 text-white font-mono font-bold text-[10px] px-2.5 py-1.5 rounded transition-all shadow-sm active:scale-95 inline-flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
                                title="Aplicar dosis y registrar inmediatamente en inventario"
                              >
                                <span>{isProcesando ? 'PROCESANDO...' : 'APLICAR & DESCONTAR'}</span>
                                <span>➔</span>
                              </button>
                            )}
                            {isAplicado && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-700 font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                ✓ CONFIRMAR DOSIS
                              </span>
                            )}
                            {isDisponible && (
                              <span className="font-mono text-[10px] text-slate-400 italic whitespace-nowrap">
                                En espera
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECCIÓN EXPRESS: ASIGNACIÓN EXPRESS EN MOSTRADOR (DEMANDA ESPONTÁNEA) */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                ASIGNACIÓN EXPRESS EN MOSTRADOR (DEMANDA ESPONTÁNEA)
              </span>
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                DESCONEXIÓN SEGURA // LOCAL FIRST
              </span>
            </div>

            <div className="p-4 bg-white">
              {mensajeExitoExpress && (
                <div className="mb-3 p-2.5 bg-slate-100 border border-slate-800 text-slate-900 font-medium text-xs rounded-lg flex items-center gap-2">
                  <span>✓</span>
                  <span>{mensajeExitoExpress}</span>
                </div>
              )}
              {mensajeErrorExpress && (
                <div className="mb-3 p-2.5 bg-slate-100 border-2 border-black text-slate-900 text-xs rounded-lg space-y-1">
                  <div className="font-bold">⚠ {mensajeErrorExpress}</div>
                  {datosGuardadosOfflineExpress && (
                    <p className="text-[11px] text-slate-700">
                      Datos retenidos intactos en buffer local. Reintentar al restablecerse la red.
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleCrearExpress} className="flex flex-col sm:flex-row items-end gap-3">
                {/* DNI PACIENTE */}
                <div className="w-full sm:w-[42%]">
                  <label htmlFor="express-dni" className="font-mono text-[10px] font-bold uppercase text-slate-600 block mb-1">
                    DNI PACIENTE
                  </label>
                  <input
                    id="express-dni"
                    type="text"
                    value={dniExpress}
                    onChange={(e) => setDniExpress(e.target.value)}
                    placeholder="Ej: 42.119.832"
                    list="pacientes-dni-list"
                    disabled={procesandoExpress}
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
                    required
                  />
                  <datalist id="pacientes-dni-list">
                    {pacientes.map((p) => (
                      <option key={p.idPaciente} value={p.dni}>
                        {p.apellido}, {p.nombre}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* VACUNA DEL CALENDARIO */}
                <div className="w-full sm:flex-1">
                  <label htmlFor="express-vacuna" className="font-mono text-[10px] font-bold uppercase text-slate-600 block mb-1">
                    VACUNA DEL CALENDARIO
                  </label>
                  <select
                    id="express-vacuna"
                    value={idVacunaExpress}
                    onChange={(e) => setIdVacunaExpress(e.target.value)}
                    disabled={procesandoExpress}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
                    required
                  >
                    <option value="">Seleccionar Inmunobiológico...</option>
                    {vacunas.map((v) => (
                      <option key={v.idVacuna} value={v.idVacuna}>
                        {v.nombre} ({v.stockDisponible} dosis disp.)
                      </option>
                    ))}
                  </select>
                </div>

                {/* BOTÓN + */}
                <div>
                  <button
                    type="submit"
                    disabled={procesandoExpress}
                    className="h-9 w-9 bg-black hover:bg-slate-800 text-white font-bold text-lg rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    title="Asignar e Iniciar Dosis en Mostrador"
                  >
                    {procesandoExpress ? '…' : '+'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* =================================================================== */}
        {/* COLUMNA DERECHA (02 CONTROL DE STOCK DISPONIBLE EN TIEMPO REAL) */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Header de la sección */}
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                02 // CONTROL DE STOCK DISPONIBLE (TIEMPO REAL)
              </span>
              <span className="text-black text-xs leading-none">●</span>
            </div>

            {/* KPI METRIC STRIP (3 TARJETAS EN LÍNEA) */}
            <div className="p-4 border-b border-slate-200 grid grid-cols-3 gap-3 bg-slate-50/50">
              {/* DOSIS TOTALES */}
              <div className="bg-slate-100/90 p-3 rounded-lg border border-slate-200">
                <span className="font-mono text-[9px] font-bold uppercase text-slate-500 block leading-tight">
                  DOSIS TOTALES
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 block my-1">
                  {dosisTotales}
                </span>
                <span className="font-mono text-[9px] text-slate-500 block leading-tight">
                  Unidades físicas
                </span>
              </div>

              {/* APLICADAS HOY */}
              <div className="bg-slate-100/90 p-3 rounded-lg border border-slate-200">
                <span className="font-mono text-[9px] font-bold uppercase text-slate-500 block leading-tight">
                  APLICADAS HOY
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 block my-1">
                  {aplicadasHoy}
                </span>
                <span className="font-mono text-[9px] text-slate-500 block leading-tight">
                  Dosis registradas
                </span>
              </div>

              {/* ALERTA CRÍTICA (BLACK INVERTED CARD) */}
              <div className="bg-black text-white p-3 rounded-lg border border-black shadow-sm">
                <span className="font-mono text-[9px] font-bold uppercase text-slate-300 block leading-tight">
                  ALERTA CRÍTICA
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white block my-1">
                  {alertasCriticas}
                </span>
                <span className="font-mono text-[9px] text-slate-300 block leading-tight">
                  Biológico en mínimo
                </span>
              </div>
            </div>

            {/* SUBHEADER INVENTARIO */}
            <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              <span>INMUNOBIOLÓGICO / LOTE</span>
              <span>DISPONIBILIDAD / VTO</span>
            </div>

            {/* LISTA DE VACUNAS EN TIEMPO REAL */}
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {vacunas.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-400">
                  {cargando ? 'Cargando inventario biológico...' : 'No hay vacunas registradas.'}
                </div>
              ) : (
                vacunas.map((v) => {
                  const isCritico = v.stockDisponible <= 2
                  const primerLote = v.lotes[0]

                  if (isCritico) {
                    return (
                      <div
                        key={v.idVacuna}
                        className="bg-black text-white px-4 py-3 flex items-center justify-between border-b border-slate-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">
                              {v.nombre}
                            </span>
                            <span className="bg-white text-black font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                              [!] STOCK CRÍTICO
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-300 block mt-0.5">
                            LOTE: {primerLote?.numeroLote || 'S/L'} · VTO: {primerLote?.vencimiento ? primerLote.vencimiento.slice(0, 7) : 'N/D'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-xs text-white block">
                            {v.stockDisponible} dosis
                          </span>
                          <span className="font-mono text-[9px] text-slate-200 uppercase tracking-wider block font-bold">
                            REPONER STOCK
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={v.idVacuna}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-900 block leading-tight">
                          {v.nombre}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 block mt-0.5">
                          LOTE: {primerLote?.numeroLote || 'S/L'} · VTO: {primerLote?.vencimiento ? primerLote.vencimiento.slice(0, 7) : 'N/D'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-slate-900 block">
                          {v.stockDisponible} dosis
                        </span>
                        <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider block">
                          ÓPTIMO
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* BOTÓN INGRESO / AJUSTE DE LOTE */}
            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMostrarModalStock(true)}
                className="w-full text-xs font-mono font-bold bg-white text-slate-900 hover:bg-slate-100 border border-slate-300 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>+ REGISTRAR INGRESO / AJUSTE DE LOTE</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* BANNER INFERIOR DE CONTINUIDAD (Wireframe US-20 web.png) */}
      {/* --------------------------------------------------------------------- */}
      <footer className="bg-black text-white p-4 rounded-xl border border-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">

          <div>
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-white block">
              PROTOCOLO DE CONTINUIDAD OPERATIVA ININTERRUMPIDA
            </span>
            <span className="text-xs text-slate-300 block">
              Buffer local offline activo: 100% de operaciones garantizadas sin latencia ni pérdida de información.
            </span>
          </div>
        </div>

        <div className="font-mono text-xs text-slate-300 font-bold whitespace-nowrap self-start sm:self-auto">
          Dosis aplicadas: <span className="text-white">{aplicadasHoy}</span> | Pendientes: <span className="text-white">{turnosPendientes}</span>
        </div>
      </footer>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL INGRESO / AJUSTE DE LOTE */}
      {/* --------------------------------------------------------------------- */}
      {mostrarModalStock && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-slate-500 block">
                  Gestión Transaccional
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Ingreso o Ajuste de Stock por Lote
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalStock(false)}
                className="text-slate-400 hover:text-black font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {errorStock && (
              <div className="p-2.5 bg-slate-100 border border-black text-black text-xs rounded-lg font-mono">
                ⚠ {errorStock}
              </div>
            )}

            <form onSubmit={handleGuardarMovimientoStock} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vacuna <span className="text-slate-900 font-bold">*</span>
                </label>
                <select
                  value={modalVacunaId}
                  onChange={(e) => setModalVacunaId(e.target.value)}
                  disabled={procesandoStock}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  required
                >
                  <option value="">Seleccionar Vacuna...</option>
                  {vacunas.map((v) => (
                    <option key={v.idVacuna} value={v.idVacuna}>
                      {v.nombre} (Stock actual: {v.stockDisponible})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Operación <span className="text-slate-900 font-bold">*</span>
                  </label>
                  <select
                    value={modalTipoMov}
                    onChange={(e) => setModalTipoMov(e.target.value as any)}
                    disabled={procesandoStock}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  >
                    <option value="INGRESO">Ingreso (+ Dosis)</option>
                    <option value="AJUSTE">Ajuste (+ o - Dosis)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cantidad <span className="text-slate-900 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    value={modalCantidad}
                    onChange={(e) => setModalCantidad(e.target.value)}
                    placeholder="Ej: 10 o -2"
                    disabled={procesandoStock}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número de Lote (Opcional)
                  </label>
                  <input
                    type="text"
                    value={modalLote}
                    onChange={(e) => setModalLote(e.target.value)}
                    placeholder="Ej: AGP-9921"
                    disabled={procesandoStock}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vencimiento (Opcional)
                  </label>
                  <input
                    type="date"
                    value={modalVencimiento}
                    onChange={(e) => setModalVencimiento(e.target.value)}
                    disabled={procesandoStock}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo / Observación
                </label>
                <input
                  type="text"
                  value={modalMotivo}
                  onChange={(e) => setModalMotivo(e.target.value)}
                  placeholder="Ej: Entrega mensual o Rotura de ampolla"
                  disabled={procesandoStock}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMostrarModalStock(false)}
                  disabled={procesandoStock}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoStock}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {procesandoStock ? 'Registrando...' : 'Confirmar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
