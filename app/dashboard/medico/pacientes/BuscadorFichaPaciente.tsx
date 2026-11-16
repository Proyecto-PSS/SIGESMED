'use client'

import { useState, useCallback, type FormEvent } from 'react'
import Link from 'next/link'
import type {
  PacienteFichaDTO,
  AtencionMedicaDTO,
  TipoDiagnosticoValor,
} from '@/lib/services/historia-clinica-service'
import {
  TEXTO_DNI_NO_ENCONTRADO,
  TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS,
  TEXTO_SIN_OBSERVACIONES,
  TEXTO_SIN_TRATAMIENTO,
  TEXTO_SIN_INDICACIONES_FARMACOLOGICAS,
  formatearFechaHoraAtencionArgentina,
  sanearDniBusqueda,
  esDniValido,
} from '@/lib/utils/historia-clinica-utils'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './pacientes.module.css'

interface Props {
  dniInicial?: string
  pacienteEncontradoInicial?: PacienteFichaDTO | null
  fichaAbiertaInicial?: boolean
  atencionesIniciales?: AtencionMedicaDTO[]
  errorInicial?: string | null
  noEncontradoInicial?: boolean
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

export default function BuscadorFichaPaciente({
  dniInicial = '',
  pacienteEncontradoInicial = null,
  fichaAbiertaInicial = false,
  atencionesIniciales = [],
  errorInicial = null,
  noEncontradoInicial = false,
}: Props) {
  const [dniInput, setDniInput] = useState(dniInicial)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingFicha, setIsLoadingFicha] = useState(false)
  const [error, setError] = useState<string | null>(errorInicial)
  const [noEncontrado, setNoEncontrado] = useState<boolean>(noEncontradoInicial)

  const [pacienteEncontrado, setPacienteEncontrado] = useState<PacienteFichaDTO | null>(
    pacienteEncontradoInicial
  )
  const [fichaAbierta, setFichaAbierta] = useState<boolean>(fichaAbiertaInicial)
  const [atenciones, setAtenciones] = useState<AtencionMedicaDTO[]>(atencionesIniciales)

  const handleBuscarPorDni = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNoEncontrado(false)
    setFichaAbierta(false)
    setAtenciones([])

    let dniLimpio = ''
    try {
      dniLimpio = sanearDniBusqueda(dniInput)
    } catch (err: any) {
      setPacienteEncontrado(null)
      setError(err?.message || 'El DNI ingresado no es válido.')
      return
    }

    if (!dniLimpio) {
      setPacienteEncontrado(null)
      setError('El DNI es obligatorio para realizar la búsqueda.')
      return
    }

    if (!esDniValido(dniLimpio)) {
      setPacienteEncontrado(null)
      setError('El formato del DNI es inválido. Debe contener entre 7 y 8 dígitos numéricos.')
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(
        `/api/medicos/pacientes/buscar?dni=${encodeURIComponent(dniLimpio)}`,
        { cache: 'no-store' }
      )
      const data = await res.json()

      if (res.status === 404) {
        setPacienteEncontrado(null)
        setNoEncontrado(true)
        return
      }

      if (!res.ok) {
        setPacienteEncontrado(null)
        setError(data.error || 'No se pudo completar la búsqueda del paciente.')
        return
      }

      setPacienteEncontrado(data.paciente ?? null)
    } catch {
      setPacienteEncontrado(null)
      setError('Error de conexión al buscar el paciente por DNI.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleAbrirFichaClinica = useCallback(async (idPaciente: string) => {
    setIsLoadingFicha(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/medicos/pacientes/${encodeURIComponent(idPaciente)}/ficha`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo obtener la ficha clínica del paciente.')
      }
      setPacienteEncontrado(data.paciente)
      setAtenciones(Array.isArray(data.atenciones) ? data.atenciones : [])
      setFichaAbierta(true)
    } catch (err: any) {
      setError(err?.message || 'Error al abrir la ficha clínica del paciente.')
    } finally {
      setIsLoadingFicha(false)
    }
  }, [])

  const handleLimpiar = () => {
    setDniInput('')
    setError(null)
    setNoEncontrado(false)
    setPacienteEncontrado(null)
    setFichaAbierta(false)
    setAtenciones([])
  }

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <span className={styles.eyebrow}>Gestión de pacientes</span>
          <h1 className={styles.titulo}>Buscar y acceder a ficha clínica</h1>
          <p className={styles.subtitulo}>
            Ingresá el DNI del paciente para localizar su padrón filiatorio y consultar su
            historial de diagnósticos y tratamientos.
          </p>
        </div>
        {fichaAbierta && (
          <div className={styles.accionesFicha}>
            <button
              type="button"
              onClick={() => setFichaAbierta(false)}
              className={ui.botonSecundario}
            >
              ← Volver al resultado de búsqueda
            </button>
            {pacienteEncontrado && (
              <Link
                href={`/dashboard/medico/fichas-clinicas/${encodeURIComponent(pacienteEncontrado.idPaciente)}`}
                className={ui.botonPrimario}
              >
                Registrar atención clínica
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Buscador de pacientes por DNI (RF-17.1) */}
      <section className={ui.tarjeta} aria-labelledby="titulo-buscador-dni">
        <h2 id="titulo-buscador-dni" className={ui.tarjetaTitulo}>
          Búsqueda de paciente por DNI
        </h2>
        <p className={ui.tarjetaTexto}>
          Ingresá el Documento Nacional de Identidad (7 a 8 dígitos numéricos, con o sin puntos).
        </p>

        <form
          onSubmit={handleBuscarPorDni}
          className={styles.formularioBusqueda}
          role="search"
          aria-label="Buscar paciente por DNI"
          noValidate
        >
          <label className={`${ui.campo} ${styles.campoDni}`} htmlFor="dni-paciente-input">
            DNI del paciente
            <input
              id="dni-paciente-input"
              name="dni"
              type="text"
              inputMode="numeric"
              className={ui.control}
              placeholder="Ej: 34891204 o 34.891.204"
              value={dniInput}
              onChange={(e) => setDniInput(e.target.value)}
              disabled={isSearching || isLoadingFicha}
              autoComplete="off"
            />
          </label>

          <div className={styles.botonesBusqueda}>
            <button
              type="submit"
              className={ui.botonPrimario}
              disabled={isSearching || isLoadingFicha}
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
            {(dniInput || pacienteEncontrado || noEncontrado || error) && (
              <button
                type="button"
                onClick={handleLimpiar}
                className={ui.botonSecundario}
                disabled={isSearching || isLoadingFicha}
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        {error && (
          <div
            className={`${ui.alerta} ${ui.alertaError}`}
            style={{ marginTop: '1rem' }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Estado vacío cuando el DNI válido no existe en la base (RF-17.2) */}
        {noEncontrado && !pacienteEncontrado && (
          <div
            className={ui.vacio}
            style={{ marginTop: '1.25rem' }}
            role="status"
            aria-live="polite"
          >
            <strong>{TEXTO_DNI_NO_ENCONTRADO}</strong>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
              Verificá que el número de documento esté correctamente escrito e intentá nuevamente.
            </p>
          </div>
        )}

        {/* Resultado de la búsqueda cuando el paciente existe y aún no se desplegó la ficha */}
        {pacienteEncontrado && !fichaAbierta && (
          <div className={styles.resultadoContenedor}>
            <span className={styles.resultadoEtiqueta}>Paciente localizado</span>
            <div className={styles.tarjetaResultado}>
              <div>
                <h3 className={styles.pacienteNombre}>
                  {pacienteEncontrado.nombre} {pacienteEncontrado.apellido}
                </h3>
                <div className={styles.pacienteMeta}>
                  <span>
                    <strong>DNI:</strong> {pacienteEncontrado.dni}
                  </span>
                  <span>
                    <strong>Cobertura:</strong> {pacienteEncontrado.obraSocial || 'Particular'}
                    {pacienteEncontrado.plan ? ` (${pacienteEncontrado.plan})` : ''}
                  </span>
                  {pacienteEncontrado.numeroAfiliado && (
                    <span>
                      <strong>N° Afiliado:</strong> {pacienteEncontrado.numeroAfiliado}
                    </span>
                  )}
                  <span>
                    <strong>Email:</strong> {pacienteEncontrado.email}
                  </span>
                </div>
              </div>

              <div className={styles.resultadoAcciones}>
                <span className={`${ui.etiqueta} ${ui.etiquetaNeutra}`}>
                  {pacienteEncontrado.cantidadAtenciones === 1
                    ? '1 registro clínico'
                    : `${pacienteEncontrado.cantidadAtenciones ?? 0} registros clínicos`}
                </span>
                <button
                  type="button"
                  onClick={() => void handleAbrirFichaClinica(pacienteEncontrado.idPaciente)}
                  className={ui.botonPrimario}
                  disabled={isLoadingFicha}
                >
                  {isLoadingFicha ? 'Abriendo ficha...' : 'Acceder a ficha clínica'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Vista de Detalle de Ficha Clínica del Paciente (RF-17.2) */}
      {pacienteEncontrado && fichaAbierta && (
        <div className={styles.layoutFicha} aria-label="Ficha clínica completa del paciente">
          {/* Columna izquierda: Datos filiatorios del paciente */}
          <section
            className={styles.panelFiliatorio}
            aria-labelledby="titulo-datos-personales-ficha"
          >
            <div className={styles.panelEncabezado}>
              <div>
                <h2 id="titulo-datos-personales-ficha" className={styles.panelTitulo}>
                  Datos personales del paciente
                </h2>
                <p className={styles.panelDescripcion}>
                  Información filiatoria y de cobertura registrada en la clínica.
                </p>
              </div>
              <span className={`${ui.etiqueta} ${ui.etiquetaExito}`}>Ficha activa</span>
            </div>

            <dl className={styles.listaFiliatoria}>
              <div className={styles.itemFiliatorio}>
                <dt>Nombre y apellido</dt>
                <dd>
                  {pacienteEncontrado.nombre} {pacienteEncontrado.apellido}
                </dd>
              </div>
              <div className={styles.itemFiliatorio}>
                <dt>DNI</dt>
                <dd>{pacienteEncontrado.dni}</dd>
              </div>
              <div className={styles.itemFiliatorio}>
                <dt>Correo electrónico</dt>
                <dd>{pacienteEncontrado.email}</dd>
              </div>
              <div className={styles.itemFiliatorio}>
                <dt>Teléfono</dt>
                <dd>{pacienteEncontrado.telefono || 'No registrado'}</dd>
              </div>
              <div className={styles.itemFiliatorio}>
                <dt>Obra social / Cobertura</dt>
                <dd>
                  {pacienteEncontrado.obraSocial || 'Particular'}
                  {pacienteEncontrado.plan ? ` — Plan ${pacienteEncontrado.plan}` : ''}
                </dd>
              </div>
              <div className={styles.itemFiliatorio}>
                <dt>Número de afiliado</dt>
                <dd>{pacienteEncontrado.numeroAfiliado || 'No aplica / Sin número'}</dd>
              </div>
            </dl>
          </section>

          {/* Columna derecha: Historial de diagnósticos y tratamientos (US-38) */}
          <section
            className={styles.panelHistorial}
            aria-labelledby="titulo-historial-ficha-paciente"
          >
            <div className={styles.panelEncabezado}>
              <div>
                <h2 id="titulo-historial-ficha-paciente" className={styles.panelTitulo}>
                  Historial de diagnósticos y tratamientos
                </h2>
                <p className={styles.panelDescripcion}>
                  Registros clínicos cargados por los profesionales médicos de la institución.
                </p>
              </div>
              <span className={`${ui.etiqueta} ${ui.etiquetaPrimaria}`}>
                {atenciones.length === 1
                  ? '1 registro clínico'
                  : `${atenciones.length} registros clínicos`}
              </span>
            </div>

            {isLoadingFicha ? (
              <div className={ui.vacio}>Cargando registros clínicos del paciente...</div>
            ) : atenciones.length === 0 ? (
              <div className={ui.vacio} role="status">
                <strong>{TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS}</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
                  Podés registrar una nueva atención médica desde la gestión de fichas clínicas.
                </p>
              </div>
            ) : (
              <ul className={styles.listaAtenciones} aria-label="Historial clínico del paciente">
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

                    <div className={styles.atencionBloque}>
                      <span className={styles.atencionEtiqueta}>Observaciones clínicas</span>
                      <p className={styles.atencionTexto}>
                        {item.observacionesClinicas || TEXTO_SIN_OBSERVACIONES}
                      </p>
                    </div>

                    <div className={styles.atencionBloque}>
                      <span className={styles.atencionEtiqueta}>Detalle del tratamiento</span>
                      <p className={styles.atencionTexto}>
                        {item.detalleTratamiento || TEXTO_SIN_TRATAMIENTO}
                      </p>
                    </div>

                    <div className={styles.atencionBloque}>
                      <span className={styles.atencionEtiqueta}>Indicaciones farmacológicas</span>
                      <p className={styles.atencionTexto}>
                        {item.indicacionesFarmacologicas || TEXTO_SIN_INDICACIONES_FARMACOLOGICAS}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

