'use client'

import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type {
  PacienteFichaDTO,
  AtencionMedicaDTO,
  TipoDiagnosticoValor,
} from '@/lib/services/historia-clinica-service'
import {
  filtrarPacientesPorTermino,
  formatearFechaHoraAtencionArgentina,
} from '@/lib/utils/historia-clinica-utils'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './fichas-clinicas.module.css'

const OPCIONES_TIPO_DIAGNOSTICO: ReadonlyArray<{
  value: TipoDiagnosticoValor
  label: string
}> = [
  { value: 'PRESUNTIVO', label: 'Presuntivo' },
  { value: 'DEFINITIVO', label: 'Definitivo' },
  { value: 'EN_ESTUDIO', label: 'En estudio' },
]

interface Props {
  pacientesIniciales: PacienteFichaDTO[]
  pacienteInicialSeleccionado?: PacienteFichaDTO | null
  atencionesIniciales?: AtencionMedicaDTO[]
}

function claseBadgeTipoDiagnostico(tipo: TipoDiagnosticoValor): string {
  switch (tipo) {
    case 'DEFINITIVO':
      return `${ui.etiqueta} ${ui.etiquetaExito}`
    case 'PRESUNTIVO':
      return `${ui.etiqueta} ${ui.etiquetaAviso}`
    case 'EN_ESTUDIO':
    default:
      return `${ui.etiqueta} ${ui.etiquetaPrimaria}`
  }
}

export default function GestionFichasClinicas({
  pacientesIniciales,
  pacienteInicialSeleccionado = null,
  atencionesIniciales = [],
}: Props) {
  const router = useRouter()

  // Estado de búsqueda y listado de pacientes
  const [busqueda, setBusqueda] = useState('')
  const [pacientes, setPacientes] = useState<PacienteFichaDTO[]>(pacientesIniciales)

  // Estado de paciente seleccionado y su historial clínico
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteFichaDTO | null>(
    pacienteInicialSeleccionado
  )
  const [atenciones, setAtenciones] = useState<AtencionMedicaDTO[]>(atencionesIniciales)
  const [isLoadingFicha, setIsLoadingFicha] = useState(false)

  // Estado del formulario de carga clínica (RF-38.2 & RF-38.3)
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState('')
  const [tipoDiagnostico, setTipoDiagnostico] = useState<TipoDiagnosticoValor>('PRESUNTIVO')
  const [observacionesClinicas, setObservacionesClinicas] = useState('')
  const [detalleTratamiento, setDetalleTratamiento] = useState('')
  const [indicacionesFarmacologicas, setIndicacionesFarmacologicas] = useState('')

  // Estados de operación y feedback (RF-38.4 & 6.7)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal de confirmación de descarte (RF-38.6)
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false)

  const limpiarCamposFormulario = useCallback(() => {
    setDiagnosticoPrincipal('')
    setTipoDiagnostico('PRESUNTIVO')
    setObservacionesClinicas('')
    setDetalleTratamiento('')
    setIndicacionesFarmacologicas('')
  }, [])

  // Filtrado instantáneo en vivo a medida que el médico escribe
  const pacientesFiltrados = useMemo(
    () => filtrarPacientesPorTermino(pacientes, busqueda),
    [pacientes, busqueda]
  )

  // Sincronización con el servidor en segundo plano cuando cambia el texto de búsqueda
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/medicos/pacientes', {
          signal: controller.signal,
        })
        const data = await res.json()
        if (res.ok && Array.isArray(data.pacientes)) {
          setPacientes(data.pacientes)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Mantiene la lista local ya cargada
        }
      }
    }, 220)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [busqueda])

  const handleLimpiarBusqueda = () => {
    setBusqueda('')
  }

  const seleccionarFichaPaciente = useCallback(
    async (idPaciente: string) => {
      setIsLoadingFicha(true)
      setError(null)
      setSuccess(null)
      try {
        const res = await fetch(
          `/api/medicos/pacientes/${encodeURIComponent(idPaciente)}/historia-clinica`
        )
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar la ficha clínica del paciente.')
        }
        setPacienteSeleccionado(data.paciente)
        setAtenciones(data.atenciones || [])
        limpiarCamposFormulario()
      } catch (err: any) {
        setError(err.message || 'Error al cargar la ficha clínica.')
      } finally {
        setIsLoadingFicha(false)
      }
    },
    [limpiarCamposFormulario]
  )

  const handleGuardarAtencion = async (e: FormEvent) => {
    e.preventDefault()
    if (!pacienteSeleccionado || isSubmitting) return

    setError(null)
    setSuccess(null)

    const diagLimpio = diagnosticoPrincipal.trim()
    if (!diagLimpio) {
      setError('El diagnóstico principal es obligatorio y no puede estar vacío.')
      return
    }

    if (
      tipoDiagnostico !== 'PRESUNTIVO' &&
      tipoDiagnostico !== 'DEFINITIVO' &&
      tipoDiagnostico !== 'EN_ESTUDIO'
    ) {
      setError('Debe seleccionar un tipo de diagnóstico válido.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(
        `/api/medicos/pacientes/${encodeURIComponent(pacienteSeleccionado.idPaciente)}/historia-clinica`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diagnosticoPrincipal: diagLimpio,
            tipoDiagnostico,
            observacionesClinicas: observacionesClinicas.trim() || null,
            detalleTratamiento: detalleTratamiento.trim() || null,
            indicacionesFarmacologicas: indicacionesFarmacologicas.trim() || null,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la atención médica.')
      }

      if (data.atencion) {
        setAtenciones((prev) => [data.atencion, ...prev])
        setPacientes((prev) =>
          prev.map((p) =>
            p.idPaciente === pacienteSeleccionado.idPaciente
              ? { ...p, cantidadAtenciones: (p.cantidadAtenciones || 0) + 1 }
              : p
          )
        )
      }

      setSuccess(
        data.message ||
          'Diagnóstico y tratamiento guardados exitosamente en la historia clínica del paciente'
      )
      limpiarCamposFormulario()
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al intentar guardar en la historia clínica.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Manejo de tecla Escape para cerrar el modal de descarte
  useEffect(() => {
    if (!mostrarModalCancelar) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMostrarModalCancelar(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mostrarModalCancelar])

  const handleConfirmarDescarteYSalir = () => {
    setMostrarModalCancelar(false)
    limpiarCamposFormulario()
    setError(null)
    setSuccess(null)
    router.push('/dashboard/medico')
  }

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <span className={styles.eyebrow}>Atención médica e historial</span>
          <h1 className={styles.titulo}>Fichas clínicas de pacientes</h1>
          <p className={styles.subtitulo}>
            Seleccioná un paciente para registrar diagnósticos, tratamientos y consultar su
            historia clínica completa.
          </p>
        </div>
        {pacienteSeleccionado && (
          <button
            type="button"
            onClick={() => {
              setPacienteSeleccionado(null)
              setError(null)
              setSuccess(null)
            }}
            className={ui.botonSecundario}
          >
            Cambiar de paciente
          </button>
        )}
      </header>

      {error && (
        <div className={`${ui.alerta} ${ui.alertaError}`} role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className={`${ui.alerta} ${ui.alertaExito}`} role="status">
          ✓ {success}
        </div>
      )}

      {/* Selector de pacientes */}
      {!pacienteSeleccionado && (
        <section className={ui.tarjeta} aria-labelledby="titulo-seleccion-paciente">
          <h2 id="titulo-seleccion-paciente" className={ui.tarjetaTitulo}>
            Buscar paciente
          </h2>
          <p className={ui.tarjetaTexto}>
            Escribí el DNI, nombre, apellido o correo electrónico para filtrar en tiempo real.
          </p>

          <div
            className={styles.buscador}
            style={{ marginTop: '1rem' }}
            role="search"
            aria-label="Buscar pacientes en vivo"
          >
            <label className={`${ui.campo} ${styles.buscadorInput}`} htmlFor="buscar-paciente-input">
              Paciente (DNI, Nombre o Email)
              <input
                id="buscar-paciente-input"
                type="search"
                className={ui.control}
                placeholder="Escribí para filtrar al instante (ej: 34891204 o Paciente Demo)..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoComplete="off"
              />
            </label>
            {busqueda && (
              <button
                type="button"
                onClick={handleLimpiarBusqueda}
                className={ui.botonSecundario}
              >
                Limpiar
              </button>
            )}
          </div>

          {isLoadingFicha ? (
            <div className={ui.vacio} style={{ marginTop: '1.25rem' }}>
              Cargando ficha clínica del paciente...
            </div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className={ui.vacio} style={{ marginTop: '1.25rem' }}>
              No se encontraron pacientes para &ldquo;{busqueda.trim()}&rdquo;.
            </div>
          ) : (
            <ul className={styles.grillaPacientes} aria-label="Pacientes disponibles">
              {pacientesFiltrados.map((pac) => (
                <li key={pac.idPaciente} className={styles.tarjetaPaciente}>
                  <div>
                    <h3 className={styles.pacienteNombre}>
                      {pac.nombre} {pac.apellido}
                    </h3>
                    <p className={styles.pacienteMeta}>
                      <strong>DNI:</strong> {pac.dni}
                      <br />
                      <strong>Cobertura:</strong> {pac.obraSocial || 'Particular'}
                      {pac.numeroAfiliado ? ` (Afiliado ${pac.numeroAfiliado})` : ''}
                      <br />
                      <strong>Email:</strong> {pac.email}
                    </p>
                  </div>

                  <div className={styles.pacientePie}>
                    <span className={`${ui.etiqueta} ${ui.etiquetaNeutra}`}>
                      {pac.cantidadAtenciones === 1
                        ? '1 atención'
                        : `${pac.cantidadAtenciones ?? 0} atenciones`}
                    </span>
                    <button
                      type="button"
                      onClick={() => seleccionarFichaPaciente(pac.idPaciente)}
                      className={`${ui.botonPrimario} ${ui.botonChico}`}
                    >
                      Abrir ficha clínica
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Vista de Ficha Clínica del Paciente Seleccionado */}
      {pacienteSeleccionado && (
        <>
          <section className={styles.fichaCabecera} aria-label="Datos del paciente seleccionado">
            <div className={styles.fichaDatosPrincipales}>
              <span className={styles.eyebrow}>Ficha clínica activa</span>
              <h2 className={styles.fichaPacienteTitulo}>
                {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
              </h2>
              <div className={styles.fichaMetadatos}>
                <span>
                  <strong>DNI:</strong> {pacienteSeleccionado.dni}
                </span>
                <span>
                  <strong>Cobertura:</strong> {pacienteSeleccionado.obraSocial || 'Particular'}
                  {pacienteSeleccionado.plan ? ` (${pacienteSeleccionado.plan})` : ''}
                </span>
                {pacienteSeleccionado.numeroAfiliado && (
                  <span>
                    <strong>N° Afiliado:</strong> {pacienteSeleccionado.numeroAfiliado}
                  </span>
                )}
                <span>
                  <strong>Email:</strong> {pacienteSeleccionado.email}
                </span>
              </div>
            </div>
            <span className={`${ui.etiqueta} ${ui.etiquetaPrimaria}`}>
              {atenciones.length === 1
                ? '1 registro en historia clínica'
                : `${atenciones.length} registros en historia clínica`}
            </span>
          </section>

          <div className={styles.layoutFicha}>
            {/* Columna izquierda: Formulario de Carga de Diagnóstico y Tratamiento */}
            <form
              onSubmit={handleGuardarAtencion}
              className={styles.formularioContenedor}
              noValidate
              aria-label="Formulario de carga de diagnóstico y tratamiento"
            >
              {/* Apartado 1: Ingreso de diagnóstico (RF-38.2) */}
              <section className={styles.apartado} aria-labelledby="titulo-ingreso-diagnostico">
                <div className={styles.apartadoEncabezado}>
                  <h3 id="titulo-ingreso-diagnostico" className={styles.apartadoTitulo}>
                    Ingreso de diagnóstico
                  </h3>
                  <p className={styles.apartadoDescripcion}>
                    Registrá la evaluación clínica y su clasificación diagnóstica.
                  </p>
                </div>

                <label className={ui.campo} htmlFor="diagnostico-principal">
                  <span>
                    Diagnóstico principal
                    <span className={styles.requerido} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <input
                    id="diagnostico-principal"
                    name="diagnosticoPrincipal"
                    type="text"
                    required
                    className={ui.control}
                    placeholder="Describí el diagnóstico principal identificado en la consulta"
                    value={diagnosticoPrincipal}
                    onChange={(e) => setDiagnosticoPrincipal(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <label className={ui.campo} htmlFor="tipo-diagnostico">
                  <span>
                    Tipo de diagnóstico
                    <span className={styles.requerido} aria-hidden="true">
                      *
                    </span>
                  </span>
                  <select
                    id="tipo-diagnostico"
                    name="tipoDiagnostico"
                    required
                    className={ui.control}
                    value={tipoDiagnostico}
                    onChange={(e) => setTipoDiagnostico(e.target.value as TipoDiagnosticoValor)}
                    disabled={isSubmitting}
                  >
                    {OPCIONES_TIPO_DIAGNOSTICO.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={ui.campo} htmlFor="observaciones-clinicas">
                  Observaciones clínicas
                  <textarea
                    id="observaciones-clinicas"
                    name="observacionesClinicas"
                    className={`${ui.control} ${styles.textareaAmplio}`}
                    placeholder="Ingresá hallazgos del examen físico, evolución, signos vitales o antecedentes relevantes de la consulta (opcional)"
                    value={observacionesClinicas}
                    onChange={(e) => setObservacionesClinicas(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>
              </section>

              {/* Apartado 2: Tratamiento (RF-38.3) */}
              <section className={styles.apartado} aria-labelledby="titulo-apartado-tratamiento">
                <div className={styles.apartadoEncabezado}>
                  <h3 id="titulo-apartado-tratamiento" className={styles.apartadoTitulo}>
                    Tratamiento
                  </h3>
                  <p className={styles.apartadoDescripcion}>
                    Documentá las pautas terapéuticas y las indicaciones farmacológicas cuando
                    corresponda.
                  </p>
                </div>

                <label className={ui.campo} htmlFor="detalle-tratamiento">
                  Detalle del tratamiento
                  <textarea
                    id="detalle-tratamiento"
                    name="detalleTratamiento"
                    className={`${ui.control} ${styles.textareaAmplio}`}
                    placeholder="Describí el plan terapéutico, cuidados generales, pautas de control o reposo indicados (opcional)"
                    value={detalleTratamiento}
                    onChange={(e) => setDetalleTratamiento(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <label className={ui.campo} htmlFor="indicaciones-farmacologicas">
                  Indicaciones farmacológicas
                  <textarea
                    id="indicaciones-farmacologicas"
                    name="indicacionesFarmacologicas"
                    className={`${ui.control} ${styles.textareaAmplio}`}
                    placeholder="Especificá medicación, dosis, vía de administración, frecuencia y duración del esquema indicado (opcional)"
                    value={indicacionesFarmacologicas}
                    onChange={(e) => setIndicacionesFarmacologicas(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>
              </section>

              {/* Barra inferior de acciones (RF-38.4 & RF-38.6) */}
              <div className={styles.barraAcciones}>
                <button
                  type="button"
                  onClick={() => setMostrarModalCancelar(true)}
                  className={ui.botonSecundario}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={ui.botonPrimario}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar en historia clínica'}
                </button>
              </div>
            </form>

            {/* Columna derecha: Historial Clínico del Paciente (RF-38.5) */}
            <section
              className={styles.historialContenedor}
              aria-labelledby="titulo-historial-clinico"
            >
              <div className={styles.apartadoEncabezado}>
                <h3 id="titulo-historial-clinico" className={styles.apartadoTitulo}>
                  Historial clínico del paciente
                </h3>
                <p className={styles.apartadoDescripcion}>
                  Atenciones médicas registradas, ordenadas de la más reciente a la más antigua.
                </p>
              </div>

              {isLoadingFicha ? (
                <div className={ui.vacio}>Cargando historial clínico...</div>
              ) : atenciones.length === 0 ? (
                <div className={ui.vacio}>
                  Todavía no hay atenciones médicas registradas en la historia clínica de este
                  paciente.
                </div>
              ) : (
                <ul className={styles.listaAtenciones} aria-label="Registros de historia clínica">
                  {atenciones.map((item) => (
                    <li key={item.idAtencion} className={styles.itemAtencion}>
                      <div className={styles.atencionCabecera}>
                        <div>
                          <div className={styles.atencionFecha}>
                            {formatearFechaHoraAtencionArgentina(item.createdAt)}
                          </div>
                          <div className={styles.atencionProfesional}>
                            Dr./Dra. {item.medico.nombreCompleto} ·{' '}
                            {item.medico.especialidadEtiqueta} (Mat. {item.medico.matricula})
                          </div>
                        </div>
                        <span className={claseBadgeTipoDiagnostico(item.tipoDiagnostico)}>
                          {item.tipoDiagnosticoEtiqueta}
                        </span>
                      </div>

                      <div className={styles.atencionBloque}>
                        <span className={styles.atencionEtiqueta}>Diagnóstico principal</span>
                        <p className={styles.atencionDiagnostico}>{item.diagnosticoPrincipal}</p>
                      </div>

                      {item.observacionesClinicas && (
                        <div className={styles.atencionBloque}>
                          <span className={styles.atencionEtiqueta}>Observaciones clínicas</span>
                          <p className={styles.atencionTexto}>{item.observacionesClinicas}</p>
                        </div>
                      )}

                      {item.detalleTratamiento && (
                        <div className={styles.atencionBloque}>
                          <span className={styles.atencionEtiqueta}>Detalle del tratamiento</span>
                          <p className={styles.atencionTexto}>{item.detalleTratamiento}</p>
                        </div>
                      )}

                      {item.indicacionesFarmacologicas && (
                        <div className={styles.atencionBloque}>
                          <span className={styles.atencionEtiqueta}>
                            Indicaciones farmacológicas
                          </span>
                          <p className={styles.atencionTexto}>
                            {item.indicacionesFarmacologicas}
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {/* Modal accesible de confirmación de descarte (RF-38.6 & 6.5) */}
      {mostrarModalCancelar && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-descartar-titulo"
        >
          <div className={styles.modalDialogo}>
            <h3 id="modal-descartar-titulo" className={styles.modalTitulo}>
              ¿Desea descartar la información ingresada?
            </h3>
            <p className={styles.modalTexto}>
              Los cambios realizados en este formulario se perderán y no se guardarán en la
              historia clínica del paciente.
            </p>
            <div className={styles.modalAcciones}>
              <button
                type="button"
                onClick={() => setMostrarModalCancelar(false)}
                className={ui.botonSecundario}
                autoFocus
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={handleConfirmarDescarteYSalir}
                className={ui.botonPeligro}
              >
                Descartar y salir
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

