'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import MonthSelector from '@/components/agenda/MonthSelector'
import DaySelector from '@/components/agenda/DaySelector'
import ShiftConfigCard from '@/components/agenda/ShiftConfigCard'
import CalendarView from '@/components/agenda/CalendarView'
import PublishModal from '@/components/agenda/PublishModal'
import {
  DiaSemana,
  DuracionTurno,
  DisponibilidadMedica,
  Turno,
  ResumenPublicacion,
} from '@/lib/types/agenda'
import {
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  NOMBRES_DIAS,
  getMesActual,
  esMesPasado,
} from '@/lib/utils/agenda-utils'
import {
  ShiftDraft,
  saveDraft,
  loadDraft,
  clearDraft,
  checkConnectivity,
  compareShifts
} from '@/lib/utils/availability-draft'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from '@/components/agenda/agenda.module.css'

export type SaveStatus = 
  | 'sin_cambios' 
  | 'guardando' 
  | 'guardado' 
  | 'cambios_locales' 
  | 'offline_borrador' 
  | 'recuperando' 
  | 'borrador_recuperado' 
  | 'error' 
  | 'publicado'

const PESTANAS = [
  ['disponibilidad', 'Configurar horarios'],
  ['agenda', 'Ver agenda'],
] as const

// Indicador de guardado (US-19): los textos son los que pide el plan de demo.
const ESTADOS_GUARDADO: Record<SaveStatus, { texto: string; clase: string }> = {
  sin_cambios: { texto: 'Sin cambios', clase: styles.estadoNeutro },
  guardando: { texto: 'Guardando...', clase: `${styles.estadoInfo} ${styles.girando}` },
  guardado: { texto: 'Guardado', clase: styles.estadoOk },
  cambios_locales: { texto: 'Cambios sin guardar', clase: styles.estadoPendiente },
  offline_borrador: { texto: 'Sin conexión - borrador preservado', clase: styles.estadoPendiente },
  recuperando: { texto: 'Recuperando borrador...', clase: `${styles.estadoInfo} ${styles.girando}` },
  borrador_recuperado: { texto: 'Borrador recuperado', clase: styles.estadoInfo },
  error: { texto: 'Error al guardar', clase: styles.estadoError },
  publicado: { texto: 'Agenda publicada', clase: styles.estadoOk },
}

export default function AgendaMedicaPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'disponibilidad' | 'agenda'>('disponibilidad')
  const [currentMonth, setCurrentMonth] = useState<string>(() => getMesActual())
  const [shifts, setShifts] = useState<ShiftDraft[]>([])

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('sin_cambios')
  const [isOffline, setIsOffline] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Datos del médico logueado
  const [medico, setMedico] = useState({
    id: '',
    nombre: '',
    especialidad: '',
    matricula: '',
  })

  // Modal de Publicación (US-04)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resumenPublicacion, setResumenPublicacion] = useState<ResumenPublicacion | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  // Turnos disponibles de la agenda
  const [turnosPublicados, setTurnosPublicados] = useState<Turno[]>([])
  const [isLoadingTurnos, setIsLoadingTurnos] = useState(false)
  const marcarAusente = async (idTurno: string) => {
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/turnos/${idTurno}/ausente`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar la ausencia.')
      setTurnosPublicados((current) => current.map((turno) => turno.id === idTurno ? { ...turno, estado: 'AUSENTE' } : turno))
      setSuccessMessage('El turno quedó registrado como ausente.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo registrar la ausencia.')
    }
  }

  // Connectivity effect (US-19)
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setSaveStatus((prev) => (prev === 'offline_borrador' ? 'cambios_locales' : prev))
    }
    const handleOffline = () => {
      setIsOffline(true)
      setSaveStatus((prev) => {
        if (prev === 'cambios_locales' || prev === 'sin_cambios' || prev === 'guardado' || prev === 'borrador_recuperado') {
          return 'offline_borrador'
        }
        return prev
      })
    }
    
    setIsOffline(!checkConnectivity())
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Guardar en LocalStorage preventivamente si hay cambios (US-19)
  useEffect(() => {
    if (!medico.id || shifts.length === 0) return
    
    if (saveStatus === 'cambios_locales' || saveStatus === 'offline_borrador') {
      const success = saveDraft(medico.id, currentMonth, shifts)
      if (!success && isOffline) {
        setErrorMessage('Error al guardar el borrador en LocalStorage. Verifica que tengas espacio.')
      }
    }
  }, [shifts, currentMonth, medico.id, saveStatus, isOffline])

  // Cargar disponibilidades existentes al cambiar de mes
  const cargarDisponibilidades = useCallback(async (mes: string) => {
    try {
      setSaveStatus('recuperando')
      setErrorMessage(null)
      setShifts([])
      
      const res = await fetch(`/api/medicos/disponibilidad?mes=${mes}`)
      if (!res.ok) throw new Error('Error al consultar disponibilidades')
      const data = await res.json()

      let loadedMedicoId = medico.id
      if (data.medico) {
        loadedMedicoId = data.medico.id
        setMedico({
          id: data.medico.id,
          nombre: data.medico.nombre,
          especialidad: data.medico.especialidad.replace(' y Ortopedia', ''),
          matricula: data.medico.matricula,
        })
      }

      let remoteShifts: ShiftDraft[] = []
      if (data.disponibilidades && data.disponibilidades.length > 0) {
        remoteShifts = data.disponibilidades.map((d: DisponibilidadMedica) => ({
          id: d.id,
          diaSemana: d.dia_semana,
          horaDesde: d.hora_desde,
          horaHasta: d.hora_hasta,
          duracion: d.duracion_turno_minutos,
        }))
      }

      // Check draft (US-19)
      const draft = loadDraft(loadedMedicoId, mes)
      if (draft) {
        const isSame = compareShifts(remoteShifts, draft.shifts)
        if (isSame) {
          // If draft is exactly same as remote, no pending changes
          setShifts(remoteShifts)
          setSaveStatus(remoteShifts.length > 0 ? 'guardado' : 'sin_cambios')
          clearDraft(loadedMedicoId, mes)
        } else {
          // Has pending changes
          setShifts(draft.shifts)
          setSaveStatus(isOffline ? 'offline_borrador' : 'borrador_recuperado')
          setSuccessMessage('Se recuperó un borrador local con cambios pendientes de publicar.')
        }
      } else {
        setShifts(remoteShifts)
        setSaveStatus(remoteShifts.length > 0 ? 'guardado' : 'sin_cambios')
      }

    } catch (err: any) {
      console.error(err)
      setShifts([])
      setSaveStatus('error')
      if (isOffline) {
         setErrorMessage('No hay conexión a internet. Intenta nuevamente cuando te reconectes.')
      } else {
         setErrorMessage('Error al cargar disponibilidades del servidor.')
      }
    }
  }, [medico.id, isOffline])

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
  const handleToggleDay = async (dia: DiaSemana) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    const exists = shifts.some((s) => s.diaSemana === dia)
    if (exists) {
      await handleRemoveShift(dia)
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
      setSaveStatus(isOffline ? 'offline_borrador' : 'cambios_locales')
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
    setSaveStatus(isOffline ? 'offline_borrador' : 'cambios_locales')
  }

  // Eliminar franja
  const handleRemoveShift = async (dia: DiaSemana) => {
    setErrorMessage(null)
    const target = shifts.find((s) => s.diaSemana === dia)
    
    // Si la franja a eliminar ya estaba en el servidor, intentamos eliminarla
    if (target?.id && !isOffline) {
      try {
        const res = await fetch(`/api/medicos/disponibilidad/${target.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo eliminar la disponibilidad')
        }
        if (data.message) {
          setSuccessMessage(data.message)
        }
      } catch (err) {
        console.error('Error eliminando en servidor:', err)
        setErrorMessage(err instanceof Error ? err.message : 'No se pudo eliminar la disponibilidad')
        return
      }
    }
    
    const newShifts = shifts.filter((s) => s.diaSemana !== dia)
    setShifts(newShifts)
    setSaveStatus(isOffline ? 'offline_borrador' : 'cambios_locales')
    
    if (newShifts.length === 0) {
      clearDraft(medico.id, currentMonth)
    }
  }

  // Guardar disponibilidad y generar sus turnos disponibles en el servidor
  const handleGuardarBorrador = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    
    if (isOffline) {
      setSaveStatus('offline_borrador')
      saveDraft(medico.id, currentMonth, shifts)
      setErrorMessage('Estás sin conexión. Los cambios se guardaron como borrador local. Podrás publicarlos cuando recuperes conectividad.')
      return
    }

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

      let finalMessage = 'Disponibilidad guardada correctamente en el servidor remoto.'

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

        const resData = await res.json()

        if (!res.ok) {
          throw new Error(resData.error || 'Error al guardar disponibilidad')
        }

        if (resData.turnos_cancelados && resData.turnos_cancelados > 0) {
          finalMessage = resData.message
        }
      }

      setSaveStatus('guardado')
      setSuccessMessage(finalMessage)
      
      // Cleanup local draft if it matches what we just sent
      clearDraft(medico.id, currentMonth)

      await cargarDisponibilidades(currentMonth)
      await cargarTurnosAgenda(currentMonth)
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Error al guardar disponibilidad')
      throw err
    }
  }

  // Abrir modal de confirmación y publicación (US-04)
  const handleRevisarYPublicar = async () => {
    setErrorMessage(null)
    setPublishError(null)

    if (isOffline) {
      setErrorMessage('No tienes conexión. No es posible publicar la agenda en este momento.')
      return
    }

    try {
      if (shifts.length === 0) {
        throw new Error('Debes seleccionar al menos un día de atención.')
      }

      if (saveStatus === 'cambios_locales' || saveStatus === 'borrador_recuperado') {
        await handleGuardarBorrador()
      }

      const res = await fetch(`/api/medicos/disponibilidad/resumen?mes=${currentMonth}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || errData.message || 'Error al obtener resumen de publicación')
      }

      const data = await res.json()
      setResumenPublicacion(data)
      setIsModalOpen(true)
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo generar el resumen de publicación')
    }
  }

  // Confirmar y publicar agenda mensual (US-04)
  const handleConfirmarPublicacion = async () => {
    if (isOffline) {
      setPublishError('Se ha perdido la conexión. No es posible confirmar la publicación.')
      return
    }

    setIsPublishing(true)
    setPublishError(null)

    try {
      const res = await fetch('/api/medicos/agenda/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes_vigencia: currentMonth }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || errData.message || 'Error al publicar agenda médica')
      }

      const data = await res.json()
      setIsModalOpen(false)
      setSaveStatus('publicado')
      clearDraft(medico.id, currentMonth)

      // US-04: vuelve al panel del médico, que muestra el mensaje de éxito.
      const params = new URLSearchParams({
        agenda: 'publicada',
        turnos: String(data.total_turnos),
        jornadas: String(data.total_jornadas),
      })
      router.push(`/dashboard/medico?${params}`)
    } catch (err: any) {
      setPublishError(err.message || 'Error durante la publicación de agenda')
    } finally {
      setIsPublishing(false)
    }
  }

  const selectedDays: DiaSemana[] = shifts.map((s) => s.diaSemana)
  const estado = ESTADOS_GUARDADO[saveStatus]

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <span className={styles.eyebrow}>Agenda médica</span>
          <h1 className={styles.titulo}>{tab === 'disponibilidad' ? 'Definir disponibilidad mensual' : 'Mi agenda'}</h1>
          <p className={styles.subtitulo}>
            {tab === 'disponibilidad'
              ? 'Elegí tus días y horarios de atención y publicalos para que los pacientes reserven.'
              : 'Consultá los turnos publicados y su estado día por día.'}
          </p>
        </div>
        <MonthSelector
          currentMonth={currentMonth}
          onChangeMonth={(m) => {
            if (esMesPasado(m)) return
            setCurrentMonth(m)
          }}
          minMonth={getMesActual()}
        />
      </header>

      <div className={styles.pestanas} role="tablist" aria-label="Secciones de la agenda">
        {PESTANAS.map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={tab === valor}
            onClick={() => setTab(valor)}
            className={`${styles.pestana} ${tab === valor ? styles.pestanaActiva : ''}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {errorMessage && (
        <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className={`${ui.alerta} ${ui.alertaExito}`} role="status">
          ✓ {successMessage}
        </p>
      )}

      {tab === 'disponibilidad' && (
        <div className={styles.disponibilidad}>
          <div className={styles.columnaPrincipal}>
            <DaySelector selectedDays={selectedDays} onToggleDay={handleToggleDay} />

            <section className={styles.tarjeta} aria-labelledby="titulo-franjas">
              <div>
                <h2 id="titulo-franjas" className={styles.tarjetaTitulo}>Franjas horarias</h2>
                <p className={styles.tarjetaDetalle}>Definí el horario y la duración de los turnos de cada día.</p>
              </div>

              {shifts.length === 0 ? (
                <p className={styles.vacio}>Todavía no elegiste días. Marcá hasta 2 días arriba para configurar sus horarios.</p>
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
            </section>
          </div>

          <aside className={styles.resumen} aria-labelledby="titulo-resumen">
            <div>
              <h2 id="titulo-resumen" className={styles.tarjetaTitulo}>Resumen del mes</h2>
              <p className={styles.tarjetaDetalle}>{resumenEnVivo.descripcionDias || 'Sin días de atención'}</p>
            </div>

            <span className={`${styles.estado} ${estado.clase}`} aria-live="polite">
              <span className={styles.estadoPunto} aria-hidden="true" />
              {estado.texto}
            </span>

            <div className={styles.resumenNumeros}>
              <div className={styles.resumenDato}>
                <span className={styles.resumenValor}>{resumenEnVivo.totalJornadas}</span>
                <span className={styles.resumenEtiqueta}>Jornadas</span>
              </div>
              <div className={styles.resumenDato}>
                <span className={styles.resumenValor}>{resumenEnVivo.totalTurnos}</span>
                <span className={styles.resumenEtiqueta}>Turnos estimados</span>
              </div>
            </div>

            <div className={styles.resumenAcciones}>
              <button
                type="button"
                onClick={handleRevisarYPublicar}
                disabled={shifts.length === 0 || saveStatus === 'guardando' || isOffline}
                className={`${ui.botonPrimario} ${ui.botonAncho}`}
              >
                Confirmar y publicar agenda
              </button>
              <button
                type="button"
                onClick={handleGuardarBorrador}
                disabled={saveStatus === 'guardando' || shifts.length === 0}
                className={`${ui.botonSecundario} ${ui.botonAncho}`}
              >
                Guardar borrador
              </button>
            </div>

            <p className={styles.nota}>
              Los cambios sobre turnos que ocurren en menos de 48 hs no se pueden aplicar. Si quitás un día con
              turnos reservados, se cancelan y se avisa a los pacientes por mail.
            </p>
          </aside>
        </div>
      )}

      {tab === 'agenda' && (
        <CalendarView
          currentMonth={currentMonth}
          turnos={turnosPublicados}
          isLoading={isLoadingTurnos}
          onMarkAbsent={marcarAusente}
        />
      )}

      <PublishModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmarPublicacion}
        resumen={resumenPublicacion}
        medicoNombre={medico.nombre}
        medicoEspecialidad={medico.especialidad}
        isPublishing={isPublishing}
        error={publishError}
      />
    </main>
  )
}
