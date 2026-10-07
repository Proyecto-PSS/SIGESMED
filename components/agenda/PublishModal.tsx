'use client'

import React from 'react'
import { ResumenPublicacion } from '@/lib/types/agenda'

interface PublishModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  resumen: ResumenPublicacion | null
  medicoNombre: string
  medicoEspecialidad: string
  isPublishing: boolean
  error: string | null
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export default function PublishModal({
  isOpen,
  onClose,
  onConfirm,
  resumen,
  medicoNombre,
  medicoEspecialidad,
  isPublishing,
  error,
}: PublishModalProps) {
  if (!isOpen || !resumen) return null

  const [yearStr, monthStr] = resumen.mes_vigencia.split('-')
  const mesIndex = parseInt(monthStr, 10) - 1
  const textoMes = `${MESES[mesIndex]} ${yearStr}`

  const nombresDiasResumen = resumen.jornadas_detalle
    .map((j) => j.dia_nombre.slice(0, 3))
    .join(' / ')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 text-slate-900">
        {/* Handle bar para mobile (Wireframe US-04 móvil) */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">
                Confirmación de Publicación
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 mt-1">
              Confirmar Apertura de Agenda
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {textoMes} • {medicoNombre} ({medicoEspecialidad})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="p-1 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Portal Pacientes Aviso (Wireframe US-04) */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-700 leading-relaxed font-mono">
          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">
            i
          </div>
          <div>
            <strong className="font-bold block text-slate-900 uppercase tracking-wide text-[11px]">
              Portal Pacientes
            </strong>
            Al confirmar, los {resumen.total_turnos} cupos quedarán abiertos inmediatamente para reserva online.
          </div>
        </div>

        {/* Tarjetas Resumen */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              Jornadas
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-0.5 block">
              {resumen.total_jornadas} días
            </span>
            <span className="text-xs text-slate-500 font-mono">{nombresDiasResumen}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              Cupos Totales
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 mt-0.5 block">
              {resumen.total_turnos}
            </span>
            <span className="text-xs text-slate-500 font-mono">Turnos clín.</span>
          </div>
        </div>

        {/* Desglose de jornadas */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div className="space-y-2 text-xs font-mono">
            {resumen.jornadas_detalle.map((j) => (
              <div
                key={j.dia_semana}
                className="flex items-center justify-between py-1 px-2 text-slate-700"
              >
                <span>
                  <strong>{j.dia_nombre}</strong> ({j.ocurrencias_en_mes} jornadas):
                </span>
                <span className="font-bold text-slate-900">
                  {j.hora_desde} - {j.hora_hasta} ({j.subtotal_turnos} turnos)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error si ocurre */}
        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-mono">
            <span>{error}</span>
          </div>
        )}

        {/* Acciones (Wireframe US-04) */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 sm:gap-3 mt-5 pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 font-mono order-2 sm:order-1"
          >
            CANCELAR
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isPublishing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold tracking-wide text-white bg-black hover:bg-slate-800 rounded-lg transition-all shadow-md disabled:opacity-50 font-mono order-1 sm:order-2"
          >
            {isPublishing ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>PUBLICANDO...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span>PUBLICAR AGENDA MENSUAL</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
