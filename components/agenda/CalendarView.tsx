'use client'

import React, { useState, useMemo } from 'react'
import { Turno } from '@/lib/types/agenda'

interface CalendarViewProps {
  currentMonth: string // YYYY-MM
  turnos: Turno[]
  isLoading: boolean
}

export default function CalendarView({
  currentMonth,
  turnos,
  isLoading,
}: CalendarViewProps) {
  const [vista, setVista] = useState<'mensual' | 'semanal'>('mensual')
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const [semanaOffset, setSemanaOffset] = useState<number>(0)

  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1

  // Resetear selección de día y offset semanal cuando cambia el mes
  React.useEffect(() => {
    setDiaSeleccionado(null)
    setSemanaOffset(0)
  }, [currentMonth])

  // Filtrar turnos estrictamente pertenecientes al mes seleccionado
  const turnosMesActual = useMemo(() => {
    return turnos.filter((t) => t.fecha_hora.startsWith(currentMonth))
  }, [turnos, currentMonth])

  // Agrupar turnos por fecha YYYY-MM-DD
  const turnosPorFecha = useMemo(() => {
    const mapa: Record<string, Turno[]> = {}
    for (const t of turnosMesActual) {
      const fecha = t.fecha_hora.split('T')[0]
      if (!mapa[fecha]) {
        mapa[fecha] = []
      }
      mapa[fecha].push(t)
    }
    return mapa
  }, [turnosMesActual])

  // Días de la cuadrícula mensual
  const diasMes = useMemo(() => {
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const totalDias = ultimoDia.getDate()

    let startDayOfWeek = primerDia.getDay()
    let offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

    const celdas: { fechaStr: string | null; diaNum: number | null }[] = []

    for (let i = 0; i < offset; i++) {
      celdas.push({ fechaStr: null, diaNum: null })
    }

    for (let d = 1; d <= totalDias; d++) {
      const fechaStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d
        .toString()
        .padStart(2, '0')}`
      celdas.push({ fechaStr, diaNum: d })
    }

    return celdas
  }, [year, month])

  // Semanas del mes para vista semanal
  const semanasDelMes = useMemo(() => {
    const semanas: string[][] = []
    let currentWeek: string[] = []

    const ultimoDia = new Date(year, month + 1, 0)

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const fechaStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d
        .toString()
        .padStart(2, '0')}`
      currentWeek.push(fechaStr)
      const dateObj = new Date(year, month, d)
      if (dateObj.getDay() === 0 || d === ultimoDia.getDate()) {
        semanas.push(currentWeek)
        currentWeek = []
      }
    }

    return semanas
  }, [year, month])

  const turnosDiaActivo = diaSeleccionado ? turnosPorFecha[diaSeleccionado] || [] : []

  return (
    <div className="space-y-4">
      {/* Controles de vista y métricas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setVista('mensual')}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-all ${
                vista === 'mensual'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              VISTA MENSUAL
            </button>
            <button
              type="button"
              onClick={() => setVista('semanal')}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition-all ${
                vista === 'semanal'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              VISTA SEMANAL
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono hidden md:inline">
            Turnos en agenda: <strong className="text-slate-900">{turnosMesActual.length}</strong>
          </span>
        </div>

        {vista === 'semanal' && semanasDelMes.length > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={semanaOffset <= 0}
              onClick={() => setSemanaOffset((prev) => Math.max(0, prev - 1))}
              className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-30 text-xs font-mono font-bold border border-slate-200"
            >
              &larr; Anterior
            </button>
            <span className="text-xs font-mono text-slate-700 font-medium">
              Semana {semanaOffset + 1} de {semanasDelMes.length}
            </span>
            <button
              type="button"
              disabled={semanaOffset >= semanasDelMes.length - 1}
              onClick={() =>
                setSemanaOffset((prev) => Math.min(semanasDelMes.length - 1, prev + 1))
              }
              className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-30 text-xs font-mono font-bold border border-slate-200"
            >
              Siguiente &rarr;
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3 text-slate-500 font-mono text-xs">
            <svg className="w-5 h-5 animate-spin text-slate-900" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Cargando agenda médica...</span>
          </div>
        </div>
      ) : turnosMesActual.length === 0 ? (
        <div className="text-center p-12 bg-white border border-dashed border-slate-300 rounded-xl">
          <svg className="w-10 h-10 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h4 className="text-sm font-bold text-slate-800">No hay turnos publicados para este periodo</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Configura los horarios en la pestaña de disponibilidad y confirma la publicación para habilitar los cupos.
          </p>
        </div>
      ) : vista === 'mensual' ? (
        /* VISTA MENSUAL */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Grilla Calendario */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-slate-500 font-bold mb-2 py-1 border-b border-slate-100">
              <div>LUN</div>
              <div>MAR</div>
              <div>MIÉ</div>
              <div>JUE</div>
              <div>VIE</div>
              <div>SÁB</div>
              <div>DOM</div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {diasMes.map((celda, idx) => {
                if (!celda.fechaStr) {
                  return <div key={`empty-${idx}`} className="h-14 sm:h-16 rounded-lg bg-slate-50" />
                }

                const turnosDelDia = turnosPorFecha[celda.fechaStr] || []
                const tieneTurnos = turnosDelDia.length > 0
                const isSelected = diaSeleccionado === celda.fechaStr

                return (
                  <button
                    key={celda.fechaStr}
                    type="button"
                    onClick={() => setDiaSeleccionado(celda.fechaStr)}
                    className={`h-14 sm:h-16 p-1 sm:p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-black shadow-md'
                        : tieneTurnos
                        ? 'bg-white border-slate-300 hover:border-black hover:bg-slate-50'
                        : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isSelected ? 'text-white' : tieneTurnos ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {celda.diaNum}
                      </span>
                      {tieneTurnos && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? 'bg-emerald-400' : 'bg-black'
                          }`}
                        />
                      )}
                    </div>

                    {tieneTurnos && (
                      <span
                        className={`text-[9px] sm:text-[10px] font-mono font-bold truncate px-1 rounded block ${
                          isSelected
                            ? 'bg-white text-black'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {turnosDelDia.length} turnos
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel Lateral: Detalle del Día */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
            <div className="pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                  Detalle del Día
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  {diaSeleccionado ? diaSeleccionado : 'Selecciona un día'}
                </h4>
              </div>
              {diaSeleccionado && (
                <span className="text-xs font-mono bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold text-slate-800">
                  {turnosDiaActivo.length} turnos
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1">
              {!diaSeleccionado ? (
                <div className="text-center py-10 text-xs text-slate-400 font-mono">
                  Haz clic en un día del calendario para ver los horarios publicados.
                </div>
              ) : turnosDiaActivo.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-mono">
                  No hay turnos disponibles para esta fecha.
                </div>
              ) : (
                turnosDiaActivo.map((t) => {
                  const hora = t.fecha_hora.split('T')[1].slice(0, 5)
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{hora} hs</span>
                        <span className="text-slate-500">({t.duracion_minutos} min)</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        {t.estado}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* VISTA SEMANAL */
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-x-auto">
          <div className="min-w-[650px] grid grid-cols-7 gap-2.5">
            {(semanasDelMes[semanaOffset] || []).map((fechaStr) => {
              const turnosDelDia = turnosPorFecha[fechaStr] || []
              const dateObj = new Date(`${fechaStr}T00:00:00`)
              const nombreDia = dateObj.toLocaleDateString('es-AR', { weekday: 'short' })
              const numDia = dateObj.getDate()

              return (
                <div
                  key={fechaStr}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col min-h-[300px]"
                >
                  <div className="text-center pb-2 border-b border-slate-200 mb-2">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                      {nombreDia}
                    </span>
                    <span className="text-sm font-bold font-mono text-slate-900">{numDia}</span>
                    <span className="text-[10px] font-mono text-slate-600 block mt-0.5">
                      {turnosDelDia.length} cupos
                    </span>
                  </div>

                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[250px]">
                    {turnosDelDia.length === 0 ? (
                      <span className="text-[10px] text-slate-400 block text-center mt-6 font-mono">
                        Sin atención
                      </span>
                    ) : (
                      turnosDelDia.map((t) => {
                        const hora = t.fecha_hora.split('T')[1].slice(0, 5)
                        return (
                          <div
                            key={t.id}
                            className="p-1.5 rounded bg-white border border-slate-200 text-[11px] font-mono flex items-center justify-between"
                          >
                            <span className="text-slate-900 font-bold">{hora}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
