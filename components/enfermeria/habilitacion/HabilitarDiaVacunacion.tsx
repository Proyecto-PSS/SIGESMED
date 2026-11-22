'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { habilitarDiaAction } from '@/app/dashboard/enfermero/dias-horarios/actions'
import styles from './habilitacion.module.css'

export interface VacunaOpcion {
  idVacuna: string
  nombre: string
  stockDisponible: number
  laboratorio?: string | null
  presentacion?: string | null
  lotes: {
    idLote: string
    numeroLote: string
    stock: number
    vencimiento: string | null
  }[]
}

interface Props {
  vacunas: VacunaOpcion[]
  fechaSugerida: string // YYYY-MM-DD
}

function generarSlots(desde: string, hasta: string, duracion: number): string[] {
  const [desdeH, desdeM] = desde.split(':').map(Number)
  const [hastaH, hastaM] = hasta.split(':').map(Number)
  const inicio = desdeH * 60 + desdeM
  const fin = hastaH * 60 + hastaM

  if (isNaN(inicio) || isNaN(fin) || inicio >= fin || duracion <= 0) return []

  const slots: string[] = []
  for (let min = inicio; min < fin; min += duracion) {
    const h = Math.floor(min / 60)
    const m = min % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return slots
}

export default function HabilitarDiaVacunacion({ vacunas, fechaSugerida }: Props) {
  const router = useRouter()

  // Selección de vacuna
  const [idVacuna, setIdVacuna] = useState<string>(() => vacunas[0]?.idVacuna || '')
  const vacunaSeleccionada = useMemo(
    () => vacunas.find((v) => v.idVacuna === idVacuna),
    [vacunas, idVacuna]
  )

  // Parámetros de jornada
  const [fecha, setFecha] = useState<string>(fechaSugerida)
  const [horaDesde, setHoraDesde] = useState<string>('08:00')
  const [horaHasta, setHoraHasta] = useState<string>('13:00')
  const [duracionMinutos, setDuracionMinutos] = useState<number>(15)

  // Grilla de slots
  const todosSlots = useMemo(
    () => generarSlots(horaDesde, horaHasta, duracionMinutos),
    [horaDesde, horaHasta, duracionMinutos]
  )
  const [slotsHabilitados, setSlotsHabilitados] = useState<string[]>([])

  // Sincronizar slots cuando cambian los horarios
  useEffect(() => {
    setSlotsHabilitados(todosSlots)
  }, [todosSlots])

  // Estado de procesamiento y mensajes
  const [procesando, setProcesando] = useState<boolean>(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)

  const toggleSlot = (slot: string) => {
    setSlotsHabilitados((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot].sort()
    )
  }

  const seleccionarTodos = () => setSlotsHabilitados(todosSlots)
  const deseleccionarTodos = () => setSlotsHabilitados([])

  // Validación de stock (Regla US-35)
  const stockActual = vacunaSeleccionada?.stockDisponible ?? 0
  const tieneStock = stockActual > 0
  const cuposActivos = slotsHabilitados.length
  const superaStock = cuposActivos > stockActual

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensajeExito(null)
    setMensajeError(null)

    if (!vacunaSeleccionada) {
      setMensajeError('Debe seleccionar una vacuna.')
      return
    }

    // Validación estricta US-35 (Escenario 2: prevención de habilitación por falta de stock)
    if (!tieneStock) {
      setMensajeError(
        `La vacuna seleccionada no cuenta con dosis disponibles (Stock: 0 dosis). No es posible habilitar agenda ni turnos de reserva hasta que se recepcione stock.`
      )
      return
    }

    if (cuposActivos === 0) {
      setMensajeError('Debe seleccionar al menos un horario en la grilla.')
      return
    }

    if (superaStock) {
      setMensajeError(
        `La cantidad de turnos a habilitar (${cuposActivos}) supera el stock disponible (${stockActual} dosis). Reduzca los horarios o amplíe el intervalo.`
      )
      return
    }

    setProcesando(true)

    try {
      const res = await habilitarDiaAction({
        idVacuna,
        fecha,
        horaDesde,
        horaHasta,
        duracionMinutos,
        horariosHabilitados: slotsHabilitados,
      })

      if (!res.ok) {
        throw new Error(res.error || 'Error al habilitar el día de vacunación.')
      }

      setMensajeExito(
        `¡Día de vacunación habilitado con éxito! Se habilitaron ${res.data?.turnosHabilitados ?? cuposActivos} turnos para ${vacunaSeleccionada.nombre} el ${fecha}.`
      )
      router.refresh()
    } catch (err: any) {
      setMensajeError(err.message || 'Error al procesar la habilitación.')
    } finally {
      setProcesando(false)
    }
  }

  const loteVigente = vacunaSeleccionada?.lotes?.[0]

  return (
    <div className={styles.contenedor}>
      <header className={styles.encabezado}>
        <span className={styles.eyebrow}>Vacunación // Gestión de turnos // Habilitación de días y horarios</span>
        <h1 className={styles.titulo}>Habilitación de día y turnos de vacunación</h1>
        <p className={styles.subtitulo}>
          Asignación de cupos y horarios según disponibilidad real de stock en vacunatorio (US-35).
        </p>
      </header>

      {mensajeExito && (
        <div className={styles.avisoExito} role="status">
          <span>✓ {mensajeExito}</span>
          <button
            type="button"
            className={styles.botonTexto}
            onClick={() => setMensajeExito(null)}
          >
            ✕
          </button>
        </div>
      )}

      {mensajeError && (
        <div className={styles.avisoError} role="alert">
          <span>⚠ {mensajeError}</span>
          <button
            type="button"
            className={styles.botonTexto}
            onClick={() => setMensajeError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.layoutPrincipal}>
        <div className={styles.columnaFormulario}>
          {/* SECCIÓN 01: Selección de vacuna y validación de stock */}
          <section className={styles.seccionTarjeta}>
            <div className={styles.seccionHeader}>
              <h2 className={styles.seccionTitulo}>01 // Selección de vacuna y validación de stock</h2>
              <span className={styles.etiquetaRequisito}>Obligatorio</span>
            </div>

            <div className={styles.campo}>
              <label htmlFor="select-vacuna" className={styles.campoLabel}>
                Vacuna a suministrar en la jornada *
              </label>
              <select
                id="select-vacuna"
                className={styles.select}
                value={idVacuna}
                onChange={(e) => {
                  setIdVacuna(e.target.value)
                  setMensajeError(null)
                }}
              >
                {vacunas.map((v) => (
                  <option key={v.idVacuna} value={v.idVacuna}>
                    {v.nombre} {v.laboratorio ? `- ${v.laboratorio}` : ''} | Stock: {v.stockDisponible} dosis
                  </option>
                ))}
              </select>
            </div>

            {vacunaSeleccionada && (
              <div className={styles.vacunaInfoCard}>
                <div className={styles.vacunaDatos}>
                  <span className={styles.vacunaNombre}>{vacunaSeleccionada.nombre}</span>
                  <span className={styles.vacunaDetalle}>
                    {loteVigente ? `Lote vigente: #${loteVigente.numeroLote}` : 'Sin lote registrado'}
                    {loteVigente?.vencimiento ? ` · Vence: ${loteVigente.vencimiento}` : ''}
                    {vacunaSeleccionada.presentacion ? ` · ${vacunaSeleccionada.presentacion}` : ''}
                  </span>
                </div>

                {tieneStock ? (
                  <span className={styles.badgeStockOk}>
                    <span aria-hidden="true">✓</span> Stock disponible: {stockActual} dosis
                  </span>
                ) : (
                  <span className={styles.badgeStockAgotado}>
                    <span aria-hidden="true">✕</span> Stock agotado: 0 dosis
                  </span>
                )}
              </div>
            )}

            {/* Restricción de falta de stock (US-35 Escenario 2) */}
            {!tieneStock && (
              <div className={styles.alertaFaltaStock} role="alert">
                <span className={styles.iconoError}>!</span>
                <div>
                  <div className={styles.alertaTitulo}>Restricción de stock detectada (US-35)</div>
                  <p className={styles.alertaTexto}>
                    La vacuna seleccionada no cuenta con dosis disponibles (Stock: 0 dosis). No es posible habilitar
                    agenda ni turnos de reserva hasta que se recepcione stock.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* SECCIÓN 02: Parámetros de jornada */}
          <section className={styles.seccionTarjeta}>
            <div className={styles.seccionHeader}>
              <h2 className={styles.seccionTitulo}>02 // Fecha y parámetros de jornada</h2>
              <span className={styles.etiquetaRequisito}>Configuración</span>
            </div>

            <div className={styles.gridParametros}>
              <div className={styles.campo}>
                <label htmlFor="input-fecha" className={styles.campoLabel}>
                  Fecha de la jornada *
                </label>
                <input
                  id="input-fecha"
                  type="date"
                  className={styles.input}
                  value={fecha}
                  min={fechaSugerida}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>

              <div className={styles.campo}>
                <label htmlFor="input-desde" className={styles.campoLabel}>
                  Horario desde *
                </label>
                <input
                  id="input-desde"
                  type="time"
                  className={styles.input}
                  value={horaDesde}
                  onChange={(e) => setHoraDesde(e.target.value)}
                  required
                />
              </div>

              <div className={styles.campo}>
                <label htmlFor="input-hasta" className={styles.campoLabel}>
                  Horario hasta *
                </label>
                <input
                  id="input-hasta"
                  type="time"
                  className={styles.input}
                  value={horaHasta}
                  onChange={(e) => setHoraHasta(e.target.value)}
                  required
                />
              </div>

              <div className={styles.campo}>
                <label htmlFor="select-duracion" className={styles.campoLabel}>
                  Intervalo por turno *
                </label>
                <select
                  id="select-duracion"
                  className={styles.select}
                  value={duracionMinutos}
                  onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                >
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos (Recomendado)</option>
                  <option value={20}>20 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                </select>
              </div>
            </div>

            <div className={styles.calculoCapacidad}>
              <span>Capacidad teórica: {todosSlots.length} turnos calculados</span>
              <span>Dosis comprometidas: {cuposActivos} de {stockActual} disponibles</span>
            </div>
          </section>

          {/* SECCIÓN 03: Grilla y habilitación individual de slots */}
          <section className={styles.seccionTarjeta}>
            <div className={styles.seccionHeader}>
              <h2 className={styles.seccionTitulo}>
                03 // Grilla y habilitación de slots ({cuposActivos} activos)
              </h2>
              <span className={styles.etiquetaRequisito}>Personalizable</span>
            </div>

            <div className={styles.slotsHeader}>
              <span className={styles.slotsNota}>
                Desmarque los horarios que correspondan a descansos o pausas sanitarias:
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className={styles.botonTexto} onClick={seleccionarTodos}>
                  Todos
                </button>
                <button type="button" className={styles.botonTexto} onClick={deseleccionarTodos}>
                  Ninguno
                </button>
              </div>
            </div>

            {todosSlots.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                Rango horario inválido. Verifique que la hora de inicio sea menor a la hora de fin.
              </p>
            ) : (
              <div className={styles.grillaSlots}>
                {todosSlots.map((slot) => {
                  const activo = slotsHabilitados.includes(slot)
                  return (
                    <label
                      key={slot}
                      className={`${styles.slotItem} ${activo ? styles.slotItemActivo : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => toggleSlot(slot)}
                        className={styles.slotItemCheckbox}
                      />
                      <span>{slot}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* COLUMNA LATERAL: Resumen de agenda a habilitar */}
        <aside className={styles.tarjetaLateral}>
          <h2 className={styles.lateralTitulo}>Resumen de agenda a habilitar</h2>

          <ul className={styles.listaResumen}>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Vacuna:</span>
              <span className={styles.itemValor}>{vacunaSeleccionada?.nombre ?? '—'}</span>
            </li>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Fecha:</span>
              <span className={styles.itemValor}>{fecha}</span>
            </li>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Horario:</span>
              <span className={styles.itemValor}>{horaDesde} a {horaHasta} hs</span>
            </li>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Intervalo:</span>
              <span className={styles.itemValor}>{duracionMinutos} min</span>
            </li>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Cupos a habilitar:</span>
              <span className={styles.itemValor}>{cuposActivos} turnos</span>
            </li>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Stock físico actual:</span>
              <span className={styles.itemValor}>{stockActual} dosis</span>
            </li>
            <li className={styles.itemResumen}>
              <span className={styles.itemEtiqueta}>Remanente:</span>
              <span className={styles.itemValor}>
                {Math.max(0, stockActual - cuposActivos)} dosis libres
              </span>
            </li>
          </ul>

          {/* Caja de validación de negocio */}
          {!tieneStock ? (
            <div className={`${styles.cajaEstado} ${styles.cajaEstadoError}`}>
              ✕ Habilitación bloqueada: la vacuna no tiene stock disponible (0 dosis).
            </div>
          ) : superaStock ? (
            <div className={`${styles.cajaEstado} ${styles.cajaEstadoError}`}>
              ⚠ Los cupos ({cuposActivos}) superan las dosis disponibles ({stockActual}).
            </div>
          ) : cuposActivos === 0 ? (
            <div className={`${styles.cajaEstado} ${styles.cajaEstadoError}`}>
              ⚠ Debe activar al menos un turno en la grilla.
            </div>
          ) : (
            <div className={`${styles.cajaEstado} ${styles.cajaEstadoOk}`}>
              ✓ Stock verificado y suficiente para la jornada.
            </div>
          )}

          <button
            type="submit"
            disabled={!tieneStock || cuposActivos === 0 || superaStock || procesando}
            className={styles.botonHabilitar}
          >
            {procesando
              ? 'Publicando turnos…'
              : !tieneStock
              ? 'Habilitación bloqueada por falta de stock'
              : 'Habilitar día'}
          </button>
        </aside>
      </form>
    </div>
  )
}
