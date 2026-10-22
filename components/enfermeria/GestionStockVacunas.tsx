'use client'

import React, { useState, useEffect, useRef } from 'react'

export interface VacunaItem {
  idVacuna: string
  nombre: string
  stockDisponible: number
  turnosComprometidos: number
  lotes: {
    idLote: string
    numeroLote: string
    stock: number
    vencimiento: string | null
  }[]
}

interface GestionStockVacunasProps {
  vacunas: VacunaItem[]
  cargando: boolean
  onActualizacionNecesaria: () => void
  onNotificarDesconexion?: () => void
}

export default function GestionStockVacunas({
  vacunas,
  cargando,
  onActualizacionNecesaria,
  onNotificarDesconexion,
}: GestionStockVacunasProps) {
  // Estado del formulario de movimiento
  const [idVacuna, setIdVacuna] = useState<string>('')
  const [tipoMovimiento, setTipoMovimiento] = useState<'INGRESO' | 'AJUSTE'>('INGRESO')
  const [cantidad, setCantidad] = useState<string>('')
  const [numeroLote, setNumeroLote] = useState<string>('')
  const [vencimiento, setVencimiento] = useState<string>('')
  const [motivo, setMotivo] = useState<string>('')

  // Control de idempotencia y retención resiliente
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  const [procesando, setProcesando] = useState<boolean>(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [datosGuardadosOffline, setDatosGuardadosOffline] = useState<boolean>(false)

  // Seleccionar la primera vacuna disponible si no hay ninguna seleccionada
  useEffect(() => {
    if (!idVacuna && vacunas.length > 0) {
      setIdVacuna(vacunas[0].idVacuna)
    }
  }, [vacunas, idVacuna])

  const vacunaSeleccionada = vacunas.find((v) => v.idVacuna === idVacuna)

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensajeExito(null)
    setMensajeError(null)
    setDatosGuardadosOffline(false)

    const cantNum = parseInt(cantidad, 10)
    if (isNaN(cantNum) || cantNum === 0) {
      setMensajeError('Por favor ingrese una cantidad numérica válida distinta de cero.')
      return
    }

    if (tipoMovimiento === 'INGRESO' && cantNum <= 0) {
      setMensajeError('Los ingresos deben tener una cantidad positiva.')
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

      const res = await fetch('/api/enfermeria/vacunas/stock/movimientos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          idVacuna,
          tipoMovimiento,
          cantidad: cantNum,
          numeroLote: numeroLote.trim() || undefined,
          vencimiento: vencimiento || undefined,
          motivo: motivo.trim() || undefined,
          idempotencyKey,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await res.json()

      if (!res.ok) {
        // Error de negocio del backend (ej. stock insuficiente 409)
        setMensajeError(data.error || 'No se pudo registrar el movimiento.')
        // RF-20.5: NO se limpian los campos del formulario ante error
        return
      }

      // ÉXITO CONFIRMADO
      setMensajeExito(
        `${tipoMovimiento === 'INGRESO' ? 'Ingreso' : 'Ajuste'} de ${Math.abs(
          cantNum
        )} dosis registrado exitosamente.`
      )

      // RF-20.5: Limpiar formulario ÚNICAMENTE tras confirmación exitosa
      setCantidad('')
      setNumeroLote('')
      setVencimiento('')
      setMotivo('')
      // Generar nueva clave de idempotencia para la próxima operación
      setIdempotencyKey(`mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

      // Refrescar stock en tiempo real
      onActualizacionNecesaria()
    } catch (err: any) {
      // Error de red, desconexión o timeout
      onNotificarDesconexion?.()
      setDatosGuardadosOffline(true)
      setMensajeError(
        'Falla de conexión o timeout con el servidor. Los datos ingresados fueron CONSERVADOS intactos. Puede reintentar cuando se restablezca la conexión.'
      )
      // RF-20.5: Se preserva la misma idempotencyKey y todos los campos del formulario
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Inventario Actual */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Control Biológico
            </span>
            <h2 className="text-lg font-bold text-slate-900">Inventario y Stock por Lotes</h2>
          </div>
          <button
            type="button"
            onClick={onActualizacionNecesaria}
            disabled={cargando}
            className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            {cargando ? 'Actualizando...' : '↻ Actualizar Stock'}
          </button>
        </div>

        {cargando && vacunas.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">Cargando datos de vacunas...</div>
        ) : vacunas.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No hay vacunas registradas.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vacunas.map((v) => {
              const esCritico = v.stockDisponible <= 2
              const sinStock = v.stockDisponible === 0
              return (
                <div
                  key={v.idVacuna}
                  className={`p-4 rounded-xl border transition-all ${
                    sinStock
                      ? 'bg-slate-100 border-slate-400 border-dashed'
                      : esCritico
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">{v.nombre}</h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        sinStock
                          ? 'bg-black text-white'
                          : esCritico
                          ? 'bg-slate-200 text-slate-900 border border-slate-300'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      {v.stockDisponible} dosis
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Comprometidos en turnos:</span>
                    <span className="font-semibold text-slate-700">{v.turnosComprometidos}</span>
                  </div>

                  {v.lotes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">
                        Lotes vigentes ({v.lotes.length}):
                      </span>
                      {v.lotes.map((l) => (
                        <div
                          key={l.idLote}
                          className="flex items-center justify-between text-[11px] text-slate-600 bg-white/70 px-2 py-1 rounded border border-slate-100"
                        >
                          <span className="font-mono font-medium truncate max-w-[130px]">{l.numeroLote}</span>
                          <span className="font-semibold text-slate-800">{l.stock} u.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Formulario de Ingreso y Ajuste de Stock (Resiliente) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="mb-4 pb-3 border-b border-slate-100">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
            Gestión Transaccional
          </span>
          <h2 className="text-lg font-bold text-slate-900">Ingreso y Ajuste de Stock</h2>
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
                Sus datos están seguros en este formulario. Presione &quot;Reintentar Registro&quot; una vez recuperada la conexión.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleRegistrarMovimiento} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Vacuna */}
            <div>
              <label htmlFor="vacuna-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Vacuna <span className="text-slate-900 font-bold">*</span>
              </label>
              <select
                id="vacuna-select"
                value={idVacuna}
                onChange={(e) => setIdVacuna(e.target.value)}
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              >
                {vacunas.map((v) => (
                  <option key={v.idVacuna} value={v.idVacuna}>
                    {v.nombre} (Disp: {v.stockDisponible})
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Movimiento */}
            <div>
              <label htmlFor="tipo-mov-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Operación <span className="text-slate-900 font-bold">*</span>
              </label>
              <select
                id="tipo-mov-select"
                value={tipoMovimiento}
                onChange={(e) => setTipoMovimiento(e.target.value as any)}
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="INGRESO">Ingreso (+ Dosis)</option>
                <option value="AJUSTE">Ajuste Manual (+ o - Dosis)</option>
              </select>
            </div>

            {/* Cantidad */}
            <div>
              <label htmlFor="cantidad-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Cantidad de Dosis <span className="text-slate-900 font-bold">*</span>
              </label>
              <input
                id="cantidad-input"
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder={tipoMovimiento === 'INGRESO' ? 'Ej: 10' : 'Ej: -2 o 5'}
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {tipoMovimiento === 'INGRESO' ? 'Valor positivo a sumar' : 'Use signo negativo para mermas/descartes'}
              </span>
            </div>

            {/* Lote */}
            <div>
              <label htmlFor="lote-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Lote <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="lote-input"
                type="text"
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Ej: LOTE-AG-2026-01"
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Vencimiento */}
            <div>
              <label htmlFor="vencimiento-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de Vencimiento <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="vencimiento-input"
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Motivo */}
            <div>
              <label htmlFor="motivo-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo / Observación
              </label>
              <input
                id="motivo-input"
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Envío mensual del Ministerio o Rotura"
                disabled={procesando}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              {vacunaSeleccionada
                ? `Stock actual de ${vacunaSeleccionada.nombre}: ${vacunaSeleccionada.stockDisponible} dosis.`
                : ''}
            </span>

            <button
              type="submit"
              disabled={procesando}
              className={`text-xs font-bold px-4 py-2 rounded-lg text-white transition-all shadow-sm ${
                procesando
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95'
              }`}
            >
              {procesando
                ? 'Procesando Transacción...'
                : datosGuardadosOffline
                ? 'Reintentar Registro'
                : 'Confirmar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
