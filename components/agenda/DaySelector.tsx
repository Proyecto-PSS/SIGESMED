'use client'

import React from 'react'
import { DiaSemana } from '@/lib/types/agenda'
import { DIAS_ABREVIADOS, NOMBRES_DIAS } from '@/lib/utils/agenda-utils'

interface DaySelectorProps {
  selectedDays: DiaSemana[]
  onToggleDay: (dia: DiaSemana) => void
  disabled?: boolean
}

const DIAS_DISPONIBLES: DiaSemana[] = [1, 2, 3, 4, 5, 6]

export default function DaySelector({
  selectedDays,
  onToggleDay,
  disabled = false,
}: DaySelectorProps) {
  const count = selectedDays.length
  const maxReached = count >= 2

  const nombresActivos = selectedDays.map((d) => NOMBRES_DIAS[d]).join(' o ')

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-800 uppercase">
            Días Recurrentes Semanales
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecciona hasta 2 días fijos de consulta para el periodo.
          </p>
        </div>

        {/* Badge 2 / 2 ACTIVOS */}
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold border transition-colors self-start sm:self-auto ${
            count === 2
              ? 'bg-slate-900 text-white border-slate-900'
              : count === 1
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              count === 2
                ? 'bg-emerald-400'
                : count === 1
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          />
          <span>{count} / 2 ACTIVOS</span>
        </div>
      </div>

      {/* Grid de días (LUN, MAR, MIÉ, JUE, VIE, SÁB) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
        {DIAS_DISPONIBLES.map((dia) => {
          const isSelected = selectedDays.includes(dia)
          const isLocked = maxReached && !isSelected

          return (
            <button
              key={dia}
              type="button"
              disabled={disabled || isLocked}
              onClick={() => onToggleDay(dia)}
              className={`relative flex flex-col items-start justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all select-none min-h-[90px] ${
                isSelected
                  ? 'bg-black text-white border-black shadow-md'
                  : isLocked
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-black hover:bg-slate-50'
              }`}
            >
              {/* Encabezado de la tarjeta con nombre y estado */}
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-sm sm:text-base font-mono font-extrabold tracking-wider">
                  {DIAS_ABREVIADOS[dia]}
                </span>
                <div>
                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                  ) : isLocked ? (
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300" />
                  )}
                </div>
              </div>

              <div>
                <span
                  className={`text-xs block font-medium ${
                    isSelected ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {NOMBRES_DIAS[dia]}
                </span>
                <span
                  className={`text-[10px] font-mono uppercase tracking-tight block mt-0.5 ${
                    isSelected
                      ? 'text-emerald-300 font-bold'
                      : isLocked
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {isSelected ? 'Seleccionado' : isLocked ? 'Bloqueado' : 'Disponible'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Nota de ayuda según wireframe */}
      {maxReached ? (
        <div className="mt-3.5 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-lg font-mono">
          <svg className="w-4 h-4 flex-shrink-0 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Para reemplazar un día, desmarca {nombresActivos || 'uno de los seleccionados'} previamente.
          </span>
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500 font-mono">
          Puedes seleccionar {2 - count} día{2 - count > 1 ? 's' : ''} más para este mes.
        </div>
      )}
    </div>
  )
}
