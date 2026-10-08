'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import MonthSelector from '@/components/agenda/MonthSelector'
import DaySelector from '@/components/agenda/DaySelector'
import ShiftConfigCard from '@/components/agenda/ShiftConfigCard'
import CalendarView from '@/components/agenda/CalendarView'
import {
  DiaSemana,
  DuracionTurno,
  DisponibilidadMedica,
  Turno,
} from '@/lib/types/agenda'
import {
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  NOMBRES_DIAS,
  getMesActual,
  esMesPasado,
} from '@/lib/utils/agenda-utils'

interface ShiftDraft {
  id?: string
  diaSemana: DiaSemana
  horaDesde: string
  horaHasta: string
  duracion: DuracionTurno
}

export default function AgendaMedicaPage() {
  const [tab, setTab] = useState<'disponibilidad' | 'agenda'>('disponibilidad')
  const [currentMonth, setCurrentMonth] = useState<string>(() => getMesActual())
  const [shifts, setShifts] = useState<ShiftDraft[]>([])

  const [saveStatus, setSaveStatus] = useState<
    'guardado' | 'guardando' | 'cambios_locales' | 'error'
  >('guardado')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Datos del médico logueado
  const [medico, setMedico] = useState({
    nombre: 'Dr. Martín Gómez',
    especialidad: 'Traumatología',
    matricula: 'MN-84920',
  })

  // Turnos disponibles de la agenda
  const [turnosPublicados, setTurnosPublicados] = useState<Turno[]>([])
  const [isLoadingTurnos, setIsLoadingTurnos] = useState(false)

  // Cargar disponibilidades existentes al cambiar de mes
  const cargarDisponibilidades = useCallback(async (mes: string) => {
    try {
      setSaveStatus('guardando')
      setShifts([])
      const res = await fetch(`/api/medicos/disponibilidad?mes=${mes}`)
      if (!res.ok) throw new Error('Error al consultar disponibilidades')
      const data = await res.json()

      if (data.medico) {
        setMedico({
          nombre: data.medico.nombre,
          especialidad: data.medico.especialidad.replace(' y Ortopedia', ''),
          matricula: 'MN-84920',
        })
      }

      if (data.disponibilidades && data.disponibilidades.length > 0) {
        const loaded: ShiftDraft[] = data.disponibilidades.map((d: DisponibilidadMedica) => ({
          id: d.id,
          diaSemana: d.dia_semana,
          horaDesde: d.hora_desde,
          horaHasta: d.hora_hasta,
          duracion: d.duracion_turno_minutos,
        }))
        setShifts(loaded)
        setSaveStatus('guardado')
      } else {
        setShifts([])
        setSaveStatus('guardado')
      }
    } catch (err: any) {
      console.error(err)
      setShifts([])
      setSaveStatus('error')
    }
  }, [])

  // Cargar turnos disponibles de la agenda
  const cargarTurnosAgenda = useCallback(async (mes: string) => {
    try {
      setIsLoadingTurnos(true)
      setTurnosPublicados([])
      const res = await fetch(`/api/medicos/agenda?mes=${mes}&vista=mensual`)
      if (!res.ok) throw new Error('Error al cargar agenda médica')
      const data = await res.json()
      setTurnosPublicados(data.turnos || [])
    } catch (err) {
      console.error(err)
      setTurnosPublicados([])
    } finally {
      setIsLoadingTurnos(false)
    }
  }, [])

  useEffect(() => {
    cargarDisponibilidades(currentMonth)
    cargarTurnosAgenda(currentMonth)
  }, [currentMonth, cargarDisponibilidades, cargarTurnosAgenda])

  // Guardar en LocalStorage preventivamente si hay turnos configurados
  useEffect(() => {
    try {
      if (shifts.length > 0) {
        localStorage.setItem(`sigesmed_draft_${currentMonth}`, JSON.stringify(shifts))
      } else {
        localStorage.removeItem(`sigesmed_draft_${currentMonth}`)
      }
    } catch {}
  }, [shifts, currentMonth])

  // Cálculo en tiempo real del resumen mensual para la tarjeta de resumen (Wireframe US-03)
  const resumenEnVivo = useMemo(() => {
    let totalJornadas = 0
    let totalTurnos = 0
    const detallesDias: string[] = []

    for (const s of shifts) {
      const fechas = obtenerFechasDelMesParaDia(currentMonth, s.diaSemana)
      const turnosPorDia = calcularTurnosPosibles(s.horaDesde, s.horaHasta, s.duracion).total
      const subtotal = turnosPorDia * fechas.length

      totalJornadas += fechas.length
      totalTurnos += subtotal
      detallesDias.push(`${fechas.length} ${NOMBRES_DIAS[s.diaSemana]}`)
    }

    return {
      totalJornadas,
      totalTurnos,
      descripcionDias: detallesDias.join(' + '),
    }
  }, [shifts, currentMonth])

  // Toggle de día seleccionado
  const handleToggleDay = (dia: DiaSemana) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    const exists = shifts.some((s) => s.diaSemana === dia)
    if (exists) {
      setShifts(shifts.filter((s) => s.diaSemana !== dia))
      setSaveStatus('cambios_locales')
    } else {
      if (shifts.length >= 2) {
        setErrorMessage('Solo puedes seleccionar hasta 2 días semanales.')
        return
      }
      setShifts([
        ...shifts,
        {
          diaSemana: dia,
          horaDesde: '08:00',
          horaHasta: '13:00',
          duracion: 30,
        },
      ])
      setSaveStatus('cambios_locales')
    }
  }

  // Modificar horario o duración de una franja
  const handleUpdateShift = (
    dia: DiaSemana,
    fields: { horaDesde?: string; horaHasta?: string; duracion?: DuracionTurno }
  ) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setShifts((prev) =>
      prev.map((s) => (s.diaSemana === dia ? { ...s, ...fields } : s))
    )
    setSaveStatus('cambios_locales')
  }

  // Eliminar franja
  const handleRemoveShift = async (dia: DiaSemana) => {
    setErrorMessage(null)
    const target = shifts.find((s) => s.diaSemana === dia)
    if (target?.id) {
      try {
        const res = await fetch(`/api/medicos/disponibilidad/${target.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'No se pudo eliminar la disponibilidad')
        }
      } catch (err) {
        console.error('Error eliminando en servidor:', err)
        setErrorMessage(err instanceof Error ? err.message : 'No se pudo eliminar la disponibilidad')
        return
      }
    }
    setShifts(shifts.filter((s) => s.diaSemana !== dia))
    setSaveStatus('cambios_locales')
  }

  // Guardar disponibilidad y generar sus turnos disponibles en el servidor
  const handleGuardarBorrador = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSaveStatus('guardando')

    try {
      if (esMesPasado(currentMonth)) {
        throw new Error('No se puede configurar disponibilidad para meses anteriores al actual.')
      }

      if (shifts.length === 0) {
        throw new Error('Debes seleccionar al menos un día de atención.')
      }
      if (shifts.length > 2) {
        throw new Error('No puedes configurar más de 2 días a la semana.')
      }

      for (const s of shifts) {
        const res = await fetch('/api/medicos/disponibilidad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mes_vigencia: currentMonth,
            dia_semana: s.diaSemana,
            hora_desde: s.horaDesde,
            hora_hasta: s.horaHasta,
            duracion_turno_minutos: s.duracion,
          }),
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error al guardar disponibilidad')
        }
      }

      setSaveStatus('guardado')
      setSuccessMessage('Disponibilidad guardada y turnos del mes generados correctamente.')
      await cargarDisponibilidades(currentMonth)
      await cargarTurnosAgenda(currentMonth)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Error al guardar disponibilidad')
    }
  }

  const selectedDays: DiaSemana[] = shifts.map((s) => s.diaSemana)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-3 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Superior - Wireframe US-03 web & mobile */}
        <header className="flex items-center justify-between gap-4 pb-2 sm:pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {/* Botón back o distintivo institucional */}
            <a
              href="/"
              title="Volver al portal principal"
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:text-black hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
                Disponibilidad Mensual
              </span>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
                Definir Disponibilidad Mensual
              </h1>
            </div>
          </div>

          {/* Tarjeta del profesional (Wireframe US-03) */}
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 block leading-tight">
                {medico.nombre}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block leading-tight">
                ESP: {medico.especialidad}
              </span>
            </div>
            <div className="w-8 h-8 rounded border border-slate-300 bg-slate-100 flex items-center justify-center text-slate-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
        </header>

        {/* Barra de Navegación de Vistas y Selector de Mes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs de Vistas */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setTab('disponibilidad')}
              className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                tab === 'disponibilidad'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              Configurar Horarios
            </button>

            <button
              type="button"
              onClick={() => setTab('agenda')}
              className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                tab === 'agenda'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              Agenda y Calendario
            </button>
          </div>

          {/* Selector de Mes */}
          <MonthSelector
            currentMonth={currentMonth}
            onChangeMonth={(m) => {
              if (esMesPasado(m)) return
              setCurrentMonth(m)
            }}
            minMonth={getMesActual()}
          />
        </div>

        {/* Mensajes de Alerta */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-mono">
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-mono">
            <span>{successMessage}</span>
          </div>
        )}

        {/* PESTAÑA 1: CONFIGURAR DISPONIBILIDAD */}
        {tab === 'disponibilidad' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Selector de Días Semanales */}
            <DaySelector
              selectedDays={selectedDays}
              onToggleDay={handleToggleDay}
            />

            {/* Listado de Franjas Horarias */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
                  Configuración de Franjas
                </span>
              </div>

              {shifts.length === 0 ? (
                <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-xl">
                  <p className="text-xs text-slate-500 font-mono">
                    No hay días seleccionados. Selecciona hasta 2 días semanales arriba para definir tus franjas de atención.
                  </p>
                </div>
              ) : (
                shifts.map((shift, idx) => (
                  <ShiftConfigCard
                    key={shift.diaSemana}
                    dia={shift.diaSemana}
                    franjaNumero={idx + 1}
                    horaDesde={shift.horaDesde}
                    horaHasta={shift.horaHasta}
                    duracion={shift.duracion}
                    onChange={(fields) => handleUpdateShift(shift.diaSemana, fields)}
                    onRemove={() => handleRemoveShift(shift.diaSemana)}
                  />
                ))
              )}
            </div>

            {/* Tarjeta de Resumen Mensual (Wireframe US-03 móvil y web) */}
            {shifts.length > 0 && (
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                <div>
                  <div className="text-lg sm:text-xl font-bold text-slate-900">
                    {resumenEnVivo.totalJornadas} Jornadas
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {resumenEnVivo.descripcionDias || 'Sin jornadas'}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {resumenEnVivo.totalTurnos} <span className="text-xs font-bold text-slate-600 uppercase">Turnos</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Cupos totales estimados para el mes
                  </div>
                </div>
              </div>
            )}

            {/* Barra Inferior de Acciones */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Estado de persistencia */}
              <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                {saveStatus === 'guardando' ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Guardando en servidor...</span>
                  </>
                ) : saveStatus === 'guardado' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Guardado en servidor</span>
                  </>
                ) : saveStatus === 'cambios_locales' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Cambios sin guardar</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Error al guardar</span>
                  </>
                )}
              </div>

              {/* Botones de acción (Wireframe US-03) */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handleGuardarBorrador}
                  disabled={saveStatus === 'guardando'}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-mono font-bold text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors disabled:opacity-50"
                >
                  GUARDAR DISPONIBILIDAD
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: AGENDA PUBLICADA */}
        {tab === 'agenda' && (
          <CalendarView
            currentMonth={currentMonth}
            turnos={turnosPublicados}
            isLoading={isLoadingTurnos}
          />
        )}

      </div>
    </div>
  )
}
