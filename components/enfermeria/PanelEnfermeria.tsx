'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { nivelStock } from '@/lib/utils/inventario-vacunas'
import ui from '@/components/paciente/ui/ui.module.css'
import IndicadorConectividad, { EstadoConexion } from './IndicadorConectividad'
import type { VacunaItem } from './GestionStockVacunas'
import type { TurnoVacunacionItem, PacienteItem } from './GestionTurnosVacunacion'
import styles from './panel-enfermeria.module.css'

const FILTROS_TURNO = [
  ['TODOS', 'Todos'],
  ['CONFIRMADO', 'En espera'],
  ['APLICADO', 'Aplicados'],
  ['DISPONIBLE', 'Libres'],
  ['CANCELADO', 'Cancelados'],
] as const

const ESTADOS_TURNO: Record<string, { texto: string; clase: string }> = {
  CONFIRMADO: { texto: 'En espera', clase: styles.estadoEspera },
  APLICADO: { texto: '✓ Aplicada', clase: styles.estadoAplicada },
  DISPONIBLE: { texto: 'Libre', clase: styles.estadoLibre },
  CANCELADO: { texto: 'Cancelado', clase: styles.estadoCancelado },
}

const NIVELES_STOCK = {
  CRITICO: { icono: '▲', clase: styles.stockCritico },
  BAJO: { icono: '!', clase: styles.stockBajo },
  NORMAL: { icono: '✓', clase: styles.stockNormal },
} as const

function fechaDeHoy(): string {
  const texto = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function vencimientoCorto(fecha: string): string {
  const [anio, mes] = fecha.slice(0, 10).split('-')
  return `${mes}/${anio}`
}

// Pantalla "Turnos en sala" de enfermería (US-19 / US-20). El nombre de la enfermera lo muestra la barra superior.
export default function PanelEnfermeria() {
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
  const alertasCriticas = vacunas.filter((v) => nivelStock(v.stockDisponible, v.umbralAlerta) !== 'NORMAL').length
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

  const reconectar = () => {
    setForzarVerificacion(true)
    setTimeout(() => setForzarVerificacion(false), 1000)
    cargarDatos()
  }

  const contarTurnos = (estado: string) =>
    estado === 'TODOS' ? turnos.length : turnos.filter((t) => t.estado === estado).length

  return (
    <div className={styles.panel}>
      {/* Encabezado: título del día, estado de la conexión y actualizar */}
      <header className={styles.encabezado}>
        <div>
          <span className={styles.eyebrow}>Vacunatorio</span>
          <h1 className={styles.titulo}>Turnos en sala</h1>
          <p className={styles.fecha} suppressHydrationWarning>
            {fechaDeHoy()}
          </p>
        </div>
        <div className={styles.encabezadoAcciones}>
          <IndicadorConectividad
            onEstadoChange={(nuevoEstado) => setEstadoConexion(nuevoEstado)}
            forzarVerificacion={forzarVerificacion}
          />
          <button type="button" onClick={cargarDatos} disabled={cargando} className={`${ui.botonSecundario} ${ui.botonChico}`}>
            {cargando ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>
      </header>

      {/* Aviso cuando se pierde la conexión */}
      {estadoConexion === 'offline' && (
        <div className={`${ui.alerta} ${ui.alertaAviso} ${styles.avisoOffline}`} role="alert">
          <span>
            <strong>Sin conexión (offline).</strong> Lo que cargues en los formularios se conserva y podés reintentar
            cuando vuelva la red.
          </span>
          <button type="button" onClick={reconectar} className={`${ui.botonSecundario} ${ui.botonChico}`}>
            Reconectar
          </button>
        </div>
      )}

      {/* Resumen del día */}
      <div className={styles.indicadores}>
        <Indicador etiqueta="En espera" valor={turnosPendientes} detalle="turnos por aplicar" acento="primario" />
        <Indicador etiqueta="Aplicadas" valor={aplicadasHoy} detalle="dosis registradas" acento="verde" />
        <Indicador etiqueta="Dosis en stock" valor={dosisTotales} detalle="disponibles en total" acento="neutro" />
        <Indicador
          etiqueta="Stock bajo"
          valor={alertasCriticas}
          detalle={alertasCriticas > 0 ? 'vacunas para reponer' : 'todo en orden'}
          acento={alertasCriticas > 0 ? 'rojo' : 'neutro'}
        />
      </div>

      <div className={styles.columnas}>
        <div className={styles.columnaPrincipal}>
          {/* Turnos de vacunación */}
          <section className={styles.tarjeta} aria-labelledby="titulo-turnos">
            <div className={styles.tarjetaEncabezado}>
              <div>
                <h2 id="titulo-turnos" className={styles.tarjetaTitulo}>Turnos de vacunación</h2>
                <p className={styles.tarjetaDetalle}>Aplicá la dosis cuando el paciente pasa a la sala.</p>
              </div>
            </div>

            <div className={styles.filtros}>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por DNI, apellido o vacuna"
                aria-label="Buscar turnos"
                className={`${ui.control} ${styles.buscador}`}
              />
              <div className={styles.chips} role="group" aria-label="Filtrar por estado">
                {FILTROS_TURNO.map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={filtroEstado === valor}
                    onClick={() => setFiltroEstado(valor)}
                    className={`${styles.chip} ${filtroEstado === valor ? styles.chipActivo : ''}`}
                  >
                    {etiqueta} <span className={styles.chipContador}>{contarTurnos(valor)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.tablaContenedor}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Paciente</th>
                    <th>Vacuna</th>
                    <th>Estado</th>
                    <th className={styles.alDerecha}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {turnosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.vacio}>
                        {cargando ? 'Cargando turnos…' : 'No hay turnos que coincidan con la búsqueda.'}
                      </td>
                    </tr>
                  ) : (
                    turnosFiltrados.map((t) => {
                      const estado = ESTADOS_TURNO[t.estado] ?? { texto: t.estado, clase: '' }
                      const isProcesando = procesandoTurnoId === t.idTurnoVacunacion
                      return (
                        <tr key={t.idTurnoVacunacion}>
                          <td>
                            <span className={styles.hora}>{t.hora}</span>
                            <span className={styles.secundario}>#{t.idTurnoVacunacion.slice(-4).toUpperCase()}</span>
                          </td>
                          <td>
                            {t.paciente ? (
                              <>
                                <span className={styles.principal}>
                                  {t.paciente.apellido}, {t.paciente.nombre}
                                </span>
                                <span className={styles.secundario}>DNI {t.paciente.dni}</span>
                              </>
                            ) : (
                              <span className={styles.secundario}>Sin paciente asignado</span>
                            )}
                          </td>
                          <td>
                            <span className={styles.principal}>{t.vacuna?.nombre || 'Vacuna'}</span>
                            <span className={styles.secundario}>{t.lote ? `Lote ${t.lote.numeroLote}` : 'Sin lote asignado'}</span>
                          </td>
                          <td>
                            <span className={`${styles.estado} ${estado.clase}`}>{estado.texto}</span>
                          </td>
                          <td className={styles.alDerecha}>
                            {t.estado === 'CONFIRMADO' ? (
                              <button
                                type="button"
                                disabled={isProcesando}
                                onClick={() => handleAplicarDosis(t.idTurnoVacunacion)}
                                className={`${ui.botonPrimario} ${ui.botonChico}`}
                                title="Registra la dosis aplicada y la descuenta del stock"
                              >
                                {isProcesando ? 'Aplicando…' : 'Aplicar dosis'}
                              </button>
                            ) : (
                              <span className={styles.secundario}>—</span>
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

          {/* Atención sin turno previo */}
          <section className={styles.tarjeta} aria-labelledby="titulo-sin-turno">
            <div>
              <h2 id="titulo-sin-turno" className={styles.tarjetaTitulo}>Atención sin turno</h2>
              <p className={styles.tarjetaDetalle}>Para pacientes que llegan al mostrador sin turno reservado.</p>
            </div>

            {mensajeExitoExpress && (
              <p className={`${ui.alerta} ${ui.alertaExito}`} role="status">✓ {mensajeExitoExpress}</p>
            )}
            {mensajeErrorExpress && (
              <div className={`${ui.alerta} ${ui.alertaError}`} role="alert">
                <strong>{mensajeErrorExpress}</strong>
                {datosGuardadosOfflineExpress && (
                  <p className={styles.textoAlerta}>Los datos quedaron cargados; reintentá cuando vuelva la conexión.</p>
                )}
              </div>
            )}

            <form onSubmit={handleCrearExpress} className={styles.formSinTurno}>
              <label className={ui.campo}>
                DNI del paciente
                <input
                  type="text"
                  value={dniExpress}
                  onChange={(e) => setDniExpress(e.target.value)}
                  placeholder="Ej: 42119832"
                  list="pacientes-dni-list"
                  disabled={procesandoExpress}
                  className={ui.control}
                  required
                />
                <datalist id="pacientes-dni-list">
                  {pacientes.map((p) => (
                    <option key={p.idPaciente} value={p.dni}>
                      {p.apellido}, {p.nombre}
                    </option>
                  ))}
                </datalist>
              </label>

              <label className={ui.campo}>
                Vacuna
                <select
                  value={idVacunaExpress}
                  onChange={(e) => setIdVacunaExpress(e.target.value)}
                  disabled={procesandoExpress}
                  className={ui.control}
                  required
                >
                  <option value="">Elegí una vacuna</option>
                  {vacunas.map((v) => (
                    <option key={v.idVacuna} value={v.idVacuna}>
                      {v.nombre} ({v.stockDisponible} dosis)
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" disabled={procesandoExpress} className={ui.botonPrimario}>
                {procesandoExpress ? 'Asignando…' : 'Asignar dosis'}
              </button>
            </form>
          </section>
        </div>

        {/* Stock disponible */}
        <aside className={styles.tarjeta} aria-labelledby="titulo-stock">
          <div className={styles.tarjetaEncabezado}>
            <div>
              <h2 id="titulo-stock" className={styles.tarjetaTitulo}>Stock disponible</h2>
              <p className={styles.tarjetaDetalle}>Se actualiza al aplicar cada dosis.</p>
            </div>
          </div>

          {vacunas.length === 0 ? (
            <p className={styles.vacio}>{cargando ? 'Cargando stock…' : 'No hay vacunas registradas.'}</p>
          ) : (
            <ul className={styles.listaStock}>
              {vacunas.map((v) => {
                const nivel = NIVELES_STOCK[nivelStock(v.stockDisponible, v.umbralAlerta)]
                const primerLote = v.lotes[0]
                return (
                  <li key={v.idVacuna} className={styles.itemStock}>
                    <div>
                      <span className={styles.principal}>{v.nombre}</span>
                      <span className={styles.secundario}>
                        {primerLote ? `Lote ${primerLote.numeroLote}` : 'Sin lote'}
                        {primerLote?.vencimiento ? ` · vence ${vencimientoCorto(primerLote.vencimiento)}` : ''}
                      </span>
                    </div>
                    <span className={`${styles.stock} ${nivel.clase}`}>
                      <span aria-hidden="true">{nivel.icono}</span> {v.stockDisponible} dosis
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className={styles.accionesStock}>
            <button type="button" onClick={() => setMostrarModalStock(true)} className={ui.botonSecundario}>
              + Registrar ingreso o ajuste
            </button>
            <Link href="/dashboard/enfermero/inventario" className={ui.linkSuave}>
              Ver inventario completo →
            </Link>
          </div>
        </aside>
      </div>

      {/* Modal de ingreso o ajuste de stock */}
      {mostrarModalStock && (
        <div className={styles.modalFondo} role="dialog" aria-modal="true" aria-labelledby="titulo-modal-stock">
          <form className={styles.modal} onSubmit={handleGuardarMovimientoStock}>
            <div className={styles.modalEncabezado}>
              <h2 id="titulo-modal-stock" className={styles.tarjetaTitulo}>Ingreso o ajuste de stock</h2>
              <button
                type="button"
                onClick={() => setMostrarModalStock(false)}
                className={styles.cerrar}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {errorStock && (
              <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">{errorStock}</p>
            )}

            <label className={ui.campo}>
              Vacuna *
              <select
                value={modalVacunaId}
                onChange={(e) => setModalVacunaId(e.target.value)}
                disabled={procesandoStock}
                className={ui.control}
                required
              >
                <option value="">Elegí una vacuna</option>
                {vacunas.map((v) => (
                  <option key={v.idVacuna} value={v.idVacuna}>
                    {v.nombre} (stock actual: {v.stockDisponible})
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.modalGrilla}>
              <label className={ui.campo}>
                Operación *
                <select
                  value={modalTipoMov}
                  onChange={(e) => setModalTipoMov(e.target.value as 'INGRESO' | 'AJUSTE')}
                  disabled={procesandoStock}
                  className={ui.control}
                >
                  <option value="INGRESO">Ingreso (suma dosis)</option>
                  <option value="AJUSTE">Ajuste (suma o resta)</option>
                </select>
              </label>
              <label className={ui.campo}>
                Cantidad *
                <input
                  type="number"
                  value={modalCantidad}
                  onChange={(e) => setModalCantidad(e.target.value)}
                  placeholder={modalTipoMov === 'INGRESO' ? 'Ej: 10' : 'Ej: -2 o 5'}
                  disabled={procesandoStock}
                  className={ui.control}
                  required
                />
              </label>
              <label className={ui.campo}>
                Número de lote
                <input
                  type="text"
                  value={modalLote}
                  onChange={(e) => setModalLote(e.target.value)}
                  placeholder="Opcional"
                  disabled={procesandoStock}
                  className={ui.control}
                />
              </label>
              <label className={ui.campo}>
                Vencimiento
                <input
                  type="date"
                  value={modalVencimiento}
                  onChange={(e) => setModalVencimiento(e.target.value)}
                  disabled={procesandoStock}
                  className={ui.control}
                />
              </label>
            </div>

            <label className={ui.campo}>
              Motivo
              <input
                type="text"
                value={modalMotivo}
                onChange={(e) => setModalMotivo(e.target.value)}
                placeholder="Ej: entrega mensual, ampolla rota"
                disabled={procesandoStock}
                className={ui.control}
              />
            </label>

            <div className={styles.modalAcciones}>
              <button type="button" onClick={() => setMostrarModalStock(false)} disabled={procesandoStock} className={ui.botonSecundario}>
                Cancelar
              </button>
              <button type="submit" disabled={procesandoStock} className={ui.botonPrimario}>
                {procesandoStock ? 'Registrando…' : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

type Acento = 'primario' | 'verde' | 'rojo' | 'neutro'

function Indicador({ etiqueta, valor, detalle, acento }: { etiqueta: string; valor: number; detalle: string; acento: Acento }) {
  return (
    <div className={`${styles.indicador} ${styles[`acento_${acento}`]}`}>
      <span className={styles.indicadorEtiqueta}>{etiqueta}</span>
      <span className={styles.indicadorValor}>{valor}</span>
      <span className={styles.indicadorDetalle}>{detalle}</span>
    </div>
  )
}
