'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  AtencionMedicaDTO,
  TipoDiagnosticoValor,
} from '@/lib/services/historia-clinica-service'
import {
  ETIQUETAS_TIPO_DIAGNOSTICO,
  TEXTO_HISTORIAL_VACIO_TITULO,
  TEXTO_HISTORIAL_VACIO_DESCRIPCION,
  TEXTO_SIN_OBSERVACIONES,
  TEXTO_SIN_TRATAMIENTO,
  TEXTO_SIN_INDICACIONES_FARMACOLOGICAS,
  formatearFechaHoraAtencionArgentina,
} from '@/lib/utils/historia-clinica-utils'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './historia.module.css'

interface Props {
  atencionesIniciales?: AtencionMedicaDTO[]
  cargarAlMontar?: boolean
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

export default function HistorialClinicoPaciente({
  atencionesIniciales,
  cargarAlMontar = true,
}: Props) {
  const [atenciones, setAtenciones] = useState<AtencionMedicaDTO[]>(atencionesIniciales ?? [])
  const [isLoading, setIsLoading] = useState<boolean>(
    cargarAlMontar && atencionesIniciales === undefined
  )
  const [error, setError] = useState<string | null>(null)
  const [consultaCompletada, setConsultaCompletada] = useState<boolean>(
    atencionesIniciales !== undefined
  )

  const consultarHistorialClinico = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pacientes/historia-clinica', {
        method: 'GET',
        cache: 'no-store',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo recuperar tu historial clínico.')
      }

      setAtenciones(Array.isArray(data.atenciones) ? data.atenciones : [])
      setConsultaCompletada(true)
    } catch (err: any) {
      setError(
        err.message ||
          'Ocurrió un inconveniente al consultar tu historial clínico. Por favor, intentá nuevamente.'
      )
      setConsultaCompletada(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cargarAlMontar) {
      consultarHistorialClinico()
    }
  }, [cargarAlMontar, consultarHistorialClinico])

  return (
    <section
      className={styles.seccionClinica}
      aria-label="Registros de tu historial clínico"
    >
      {!isLoading && !error && consultaCompletada && (
        <div className={styles.seccionEncabezado}>
          <span className={`${ui.etiqueta} ${ui.etiquetaPrimaria}`} aria-live="polite">
            {atenciones.length === 1
              ? '1 atención registrada'
              : `${atenciones.length} atenciones registradas`}
          </span>
        </div>
      )}

      {/* Estado de carga (isLoading) */}
      {isLoading && (
        <div className={ui.vacio} role="status" aria-live="polite">
          Cargando registros de tu historial clínico...
        </div>
      )}

      {/* Estado de error con opción de reintento */}
      {!isLoading && error && (
        <div
          className={`${ui.alerta} ${ui.alertaError} ${styles.errorContenedor}`}
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={consultarHistorialClinico}
            className={`${ui.botonSecundario} ${ui.botonChico}`}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado vacío (únicamente cuando la consulta fue exitosa y no hay registros) */}
      {!isLoading && !error && consultaCompletada && atenciones.length === 0 && (
        <div className={ui.vacio}>
          <h3 className={ui.tarjetaTitulo}>{TEXTO_HISTORIAL_VACIO_TITULO}</h3>
          <p className={ui.tarjetaTexto}>{TEXTO_HISTORIAL_VACIO_DESCRIPCION}</p>
        </div>
      )}

      {/* Listado de solo lectura de atenciones médicas (success) */}
      {!isLoading && !error && atenciones.length > 0 && (
        <ul
          className={styles.listaAtenciones}
          aria-label="Atenciones médicas registradas en tu historial clínico"
        >
          {atenciones.map((atencion) => {
            const etiquetaTipo =
              atencion.tipoDiagnosticoEtiqueta ||
              ETIQUETAS_TIPO_DIAGNOSTICO[atencion.tipoDiagnostico] ||
              atencion.tipoDiagnostico

            const nombreMedico =
              atencion.medico.nombreCompleto ||
              `${atencion.medico.nombre} ${atencion.medico.apellido}`.trim()

            return (
              <li key={atencion.idAtencion} className={styles.tarjetaAtencion}>
                {/* Bloque 1: Información de la atención */}
                <div className={styles.bloqueInfoAtencion}>
                  <div>
                    <div className={styles.atencionFechaHora}>
                      {formatearFechaHoraAtencionArgentina(atencion.createdAt)}
                    </div>
                    <div className={styles.atencionMedico}>
                      <strong>Profesional:</strong> Dr./Dra. {nombreMedico}
                      {atencion.medico.especialidadEtiqueta
                        ? ` · ${atencion.medico.especialidadEtiqueta}`
                        : ''}
                    </div>
                  </div>
                  <span className={claseBadgeTipoDiagnostico(atencion.tipoDiagnostico)}>
                    {etiquetaTipo}
                  </span>
                </div>

                <div className={styles.grillaBloquesClinicos}>
                  {/* Bloque 2: Diagnóstico */}
                  <div className={styles.bloqueClinico}>
                    <h3 className={styles.bloqueClinicoTitulo}>Diagnóstico</h3>

                    <div className={styles.campoClinico}>
                      <span className={styles.campoEtiqueta}>Diagnóstico principal</span>
                      <p className={styles.campoValorPrincipal}>
                        {atencion.diagnosticoPrincipal}
                      </p>
                    </div>

                    <div className={styles.campoClinico}>
                      <span className={styles.campoEtiqueta}>Tipo de diagnóstico</span>
                      <p className={styles.campoValorTexto}>{etiquetaTipo}</p>
                    </div>

                    <div className={styles.campoClinico}>
                      <span className={styles.campoEtiqueta}>Observaciones clínicas</span>
                      {atencion.observacionesClinicas ? (
                        <p className={styles.campoValorTexto}>
                          {atencion.observacionesClinicas}
                        </p>
                      ) : (
                        <p className={styles.campoSinInformar}>{TEXTO_SIN_OBSERVACIONES}</p>
                      )}
                    </div>
                  </div>

                  {/* Bloque 3: Tratamiento */}
                  <div className={styles.bloqueClinico}>
                    <h3 className={styles.bloqueClinicoTitulo}>Tratamiento</h3>

                    <div className={styles.campoClinico}>
                      <span className={styles.campoEtiqueta}>Detalle del tratamiento</span>
                      {atencion.detalleTratamiento ? (
                        <p className={styles.campoValorTexto}>{atencion.detalleTratamiento}</p>
                      ) : (
                        <p className={styles.campoSinInformar}>{TEXTO_SIN_TRATAMIENTO}</p>
                      )}
                    </div>

                    <div className={styles.campoClinico}>
                      <span className={styles.campoEtiqueta}>Indicaciones farmacológicas</span>
                      {atencion.indicacionesFarmacologicas ? (
                        <p className={styles.campoValorTexto}>
                          {atencion.indicacionesFarmacologicas}
                        </p>
                      ) : (
                        <p className={styles.campoSinInformar}>
                          {TEXTO_SIN_INDICACIONES_FARMACOLOGICAS}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

