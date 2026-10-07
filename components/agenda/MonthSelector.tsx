'use client'

import React from 'react'

interface MonthSelectorProps {
  currentMonth: string // YYYY-MM
  onChangeMonth: (newMonth: string) => void
  disabled?: boolean
}

const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
]

export default function MonthSelector({
  currentMonth,
  onChangeMonth,
  disabled = false,
}: MonthSelectorProps) {
  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const handlePrev = () => {
    let nextMonth = month - 1
    let nextYear = year
    if (nextMonth < 1) {
      nextMonth = 12
      nextYear -= 1
    }
    onChangeMonth(`${nextYear}-${nextMonth.toString().padStart(2, '0')}`)
  }

  const handleNext = () => {
    let nextMonth = month + 1
    let nextYear = year
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    onChangeMonth(`${nextYear}-${nextMonth.toString().padStart(2, '0')}`)
  }

  const nombreMes = MESES[month - 1] || 'MES'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:px-4 sm:py-3 shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={disabled}
          title="Mes anterior"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:text-black hover:bg-slate-100 disabled:opacity-30 transition-colors border border-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs sm:text-sm font-bold tracking-wider min-w-[180px] justify-center select-none">
          <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{`${nombreMes} ${year}`}</span>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={disabled}
          title="Mes siguiente"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:text-black hover:bg-slate-100 disabled:opacity-30 transition-colors border border-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
