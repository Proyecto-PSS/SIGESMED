'use client'

import React, { useMemo } from 'react'
import { DiaSemana, DuracionTurno } from '@/lib/types/agenda'
import { NOMBRES_DIAS, calcularTurnosPosibles } from '@/lib/utils/agenda-utils'

interface ShiftConfigCardProps {
  dia: DiaSemana
  franjaNumero: number
  horaDesde: string
  horaHasta: string
  duracion: DuracionTurno
  onChange: (fields: {
    horaDesde?: string
    horaHasta?: string
    duracion?: DuracionTurno
  }) => void
  onRemove: () => void
  disabled?: boolean
}

const DURACIONES: DuracionTurno[] = [20, 30, 45]

export default function ShiftConfigCard({
  dia,
  franjaNumero,
  horaDesde,
  horaHasta,
  duracion,
  onChange,
  onRemove,
  disabled = false,
}: ShiftConfigCardProps) {
  const { total: totalTurnos } = useMemo(() => {
    return calcularTurnosPosibles(horaDesde, horaHasta, duracion)
  }, [horaDesde, horaHasta, duracion])

  const isValidHorario = totalTurnos > 0
  const numeroFormateado = franjaNumero.toString().padStart(2, '0')

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm transition-all hover:border-slate-300">
      {/* Header franja */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-black" />
          <h4 className="text-xs sm:text-sm font-mono font-bold tracking-wide text-slate-900 uppercase">
            Franja {numeroFormateado} — {NOMBRES_DIAS[dia]}
          </h4>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="Eliminar este día de atención"
          className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 transition-colors flex items-center gap-1 font-mono"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Quitar día</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 items-end">
        {/* Hora Desde */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1.5 uppercase">
            Hora Desde
          </label>
          <input
            type="time"
            value={horaDesde}
            onChange={(e) => onChange({ horaDesde: e.target.value })}
            disabled={disabled}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-black disabled:opacity-50"
          />
        </div>

        {/* Hora Hasta */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1.5 uppercase">
            Hora Hasta
          </label>
          <input
            type="time"
            value={horaHasta}
            onChange={(e) => onChange({ horaHasta: e.target.value })}
            disabled={disabled}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-black disabled:opacity-50"
          />
        </div>

        {/* Duración de Turno */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1.5 uppercase">
            Duración Turno
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
            {DURACIONES.map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ duracion: d })}
                className={`py-1 text-xs font-mono font-bold rounded transition-all ${
                  duracion === d
                    ? 'bg-black text-white shadow-sm'
                    : 'text-slate-600 hover:text-black hover:bg-slate-200'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Turnos Calculados Badge */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-600 mb-1.5 uppercase">
            Capacidad Jornada
          </label>
          <div
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs font-bold transition-colors ${
              isValidHorario
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {isValidHorario
                ? `${totalTurnos} turnos`
                : 'Horario inválido'}
            </span>
          </div>
        </div>
      </div>

      {!isValidHorario && (
        <p className="mt-2 text-xs text-rose-600 font-mono">
          La hora de fin debe ser posterior a la de inicio con margen suficiente para al menos 1 turno.
        </p>
      )}
    </div>
  )
}
