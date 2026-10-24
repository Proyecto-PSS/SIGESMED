'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './pago.module.css'

interface Props {
  idTurno: string
  turno: {
    idTurno: string
    fecha: string
    hora: string
    modalidad: string | null
    estado: string
    medico: {
      nombre: string
      apellido: string
      especialidad: string
      consultorio: string | null
    }
  }
  pagoInicial: any | null
  tarifa: {
    monto: string
    moneda: string
  }
}

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number)
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function PagoTurnoDetalle({ idTurno, turno, pagoInicial, tarifa }: Props) {
  const [pago, setPago] = useState<any | null>(pagoInicial)
  const [comprobante, setComprobante] = useState<any | null>(pagoInicial?.comprobante || null)
  const [descargando, setDescargando] = useState<boolean>(false)
  const [errorDescarga, setErrorDescarga] = useState<string>('')
  const [reintentandoComprobante, setReintentandoComprobante] = useState<boolean>(false)

  const [estadoTransaccion, setEstadoTransaccion] = useState<'IDLE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'ERROR'>(
    pagoInicial?.estado === 'APROBADO'
      ? 'APROBADO'
      : pagoInicial?.estado === 'RECHAZADO'
        ? 'RECHAZADO'
        : pagoInicial?.estado === 'ERROR'
          ? 'ERROR'
          : 'IDLE'
  )
  const [mensajeError, setMensajeError] = useState<string>(pagoInicial?.motivoRechazo || '')
  const [resultadoSimulado, setResultadoSimulado] = useState<'APROBADO' | 'RECHAZADO' | 'ERROR'>('APROBADO')

  const estaProcesando = estadoTransaccion === 'PROCESANDO'
  const yaAprobado = estadoTransaccion === 'APROBADO' || pago?.estado === 'APROBADO'

  async function consultarEstadoComprobante(idPago: string) {
    try {
      const res = await fetch(`/api/pagos/${idPago}/comprobante`)
      if (res.ok) {
        const data = await res.json()
        if (data.comprobante) {
          setComprobante(data.comprobante)
        }
      }
    } catch {
      // Ignorar fallos de sondeo
    }
  }

  async function reintentarGeneracion() {
    const idPagoActivo = pago?.idPago || pagoInicial?.idPago
    if (!idPagoActivo || reintentandoComprobante) return

    setReintentandoComprobante(true)
    setErrorDescarga('')

    try {
      const res = await fetch(`/api/pagos/${idPagoActivo}/comprobante`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo generar el comprobante')
      }
      if (data.comprobante) {
        setComprobante(data.comprobante)
      }
    } catch (err: any) {
      setErrorDescarga(err.message || 'Error al reintentar la creación del comprobante.')
    } finally {
      setReintentandoComprobante(false)
    }
  }

  async function descargarComprobante() {
    const idPagoActivo = pago?.idPago || pagoInicial?.idPago
    if (!idPagoActivo || descargando) return

    setDescargando(true)
    setErrorDescarga('')

    try {
      const res = await fetch(`/api/pagos/${idPagoActivo}/comprobante/descargar`)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'No se pudo descargar el comprobante.')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = comprobante?.nombreArchivo || `comprobante-${idPagoActivo}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setErrorDescarga(err.message || 'Error al descargar el archivo PDF.')
    } finally {
      setDescargando(false)
    }
  }

  async function iniciarYProcesarPago() {
    if (estaProcesando || yaAprobado) return

    setEstadoTransaccion('PROCESANDO')
    setMensajeError('')

    try {
      // 1. Iniciar o recuperar el pago
      let pagoActivo = pago
      if (!pagoActivo || pagoActivo.estado === 'RECHAZADO' || pagoActivo.estado === 'ERROR') {
        const idempotencyKey = `pago_${idTurno}_${Date.now()}`
        const resInicio = await fetch('/api/pagos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idTurno, idempotencyKey }),
        })

        if (!resInicio.ok) {
          const errData = await resInicio.json().catch(() => ({}))
          throw new Error(errData.error || 'No se pudo iniciar el proceso de pago')
        }

        const dataInicio = await resInicio.json()
        pagoActivo = dataInicio.pago
        setPago(pagoActivo)
      }

      // 2. Procesar el resultado a través de la pasarela (simulada para MVP)
      const resProcesar = await fetch(`/api/pagos/${pagoActivo.idPago}/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultado: resultadoSimulado,
          motivoRechazo:
            resultadoSimulado === 'RECHAZADO'
              ? 'Fondos insuficientes en la tarjeta seleccionada (Simulación)'
              : undefined,
          codigoError:
            resultadoSimulado === 'ERROR'
              ? 'FALLO_CONEXION_PASARELA'
              : undefined,
        }),
      })

      const dataProcesada = await resProcesar.json()

      if (!resProcesar.ok) {
        throw new Error(dataProcesada.error || 'Error al procesar la transacción')
      }

      const pagoResultado = dataProcesada.pago
      setPago(pagoResultado)

      if (pagoResultado.estado === 'APROBADO') {
        setEstadoTransaccion('APROBADO')
        if (pagoResultado.comprobante) {
          setComprobante(pagoResultado.comprobante)
        } else {
          // Consultar comprobante en caso de que su generación esté en segundo plano
          consultarEstadoComprobante(pagoResultado.idPago)
        }
      } else if (pagoResultado.estado === 'RECHAZADO') {
        setEstadoTransaccion('RECHAZADO')
        setMensajeError(pagoResultado.motivoRechazo || 'El pago fue rechazado.')
      } else {
        setEstadoTransaccion('ERROR')
        setMensajeError(pagoResultado.codigoError || 'Ocurrió un error técnico durante la operación.')
      }
    } catch (err: any) {
      setEstadoTransaccion('ERROR')
      setMensajeError(err.message || 'Error de conexión al procesar el pago.')
    }
  }

  return (
    <div className={styles.contenedor}>
      <main className={styles.cardPrincipal}>
        <header className={styles.cabecera}>
          <span className={styles.superTitulo}>SIGESMED • Consulta Particular</span>
          <h1 className={styles.titulo}>Pago de Consulta Médica en Línea</h1>
        </header>

        <div className={styles.cuerpo}>
          {/* Resumen del Turno */}
          <section className={styles.resumenTurno} aria-label="Detalles del turno médico">
            <div className={styles.filaDato}>
              <span className={styles.etiquetaDato}>Profesional:</span>
              <span className={styles.valorDato}>
                Dr. {turno.medico.nombre} {turno.medico.apellido}
              </span>
            </div>
            <div className={styles.filaDato}>
              <span className={styles.etiquetaDato}>Especialidad:</span>
              <span className={styles.valorDato}>
                {nombresEspecialidad[turno.medico.especialidad] || turno.medico.especialidad}
              </span>
            </div>
            <div className={styles.filaDato}>
              <span className={styles.etiquetaDato}>Fecha y hora:</span>
              <span className={styles.valorDato}>
                {formatearFecha(turno.fecha)} a las {turno.hora} hs
              </span>
            </div>
            <div className={styles.filaDato}>
              <span className={styles.etiquetaDato}>Consultorio:</span>
              <span className={styles.valorDato}>
                {turno.medico.consultorio || 'Consultorio central'}
              </span>
            </div>
            <div className={styles.filaDato} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <span className={styles.etiquetaDato}>Arancel de consulta:</span>
              <span className={styles.montoDestacado}>
                ${Number(tarifa.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {tarifa.moneda}
              </span>
            </div>
          </section>

          {/* Banner de Entorno de Pruebas */}
          <aside className={styles.simulacionBanner} role="note">
            <span aria-hidden="true">🔒</span>
            <div>
              <strong>Entorno de Pasarela Simulada (MVP):</strong> Las transacciones se procesan de forma segura sin requerir datos reales de tarjeta de crédito.
            </div>
          </aside>

          {/* Estados de la transacción */}
          {yaAprobado && (
            <>
              <section className={styles.alertaAprobado} role="status" aria-live="polite">
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>✓ ¡Pago Aprobado Exitosamente!</h2>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  Tu pago fue registrado y confirmado. Tu consulta médica quedó formalmente abonada.
                </p>
                {pago?.transaccionExternaId && (
                  <div style={{ fontSize: '0.8rem', color: '#047857', fontFamily: 'monospace' }}>
                    Referencia de pago: {pago.transaccionExternaId}
                  </div>
                )}
              </section>

              {/* RF-24.3: Sección de comprobante y descarga en pantalla de éxito */}
              <section className={styles.seccionComprobante} aria-label="Comprobante de pago">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                      Comprobante de Pago
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                      Constancia formal de pago de consulta médica en formato PDF.
                    </p>
                  </div>
                  {comprobante?.numeroComprobante && (
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                      N° {comprobante.numeroComprobante}
                    </span>
                  )}
                </div>

                {comprobante?.estado === 'GENERADO' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={descargarComprobante}
                      disabled={descargando}
                      className={styles.btnDescarga}
                    >
                      {descargando ? (
                        <>
                          <span className={styles.spinner} aria-hidden="true" />
                          <span>Descargando documento...</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">📥</span>
                          <span>Descargar comprobante (PDF)</span>
                        </>
                      )}
                    </button>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                      {comprobante.tamanoBytes
                        ? `Archivo PDF (${Math.round(comprobante.tamanoBytes / 1024)} KB) • Listo para imprimir o guardar`
                        : 'Archivo PDF • Listo para descargar'}
                    </span>
                  </div>
                ) : comprobante?.estado === 'ERROR' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.8125rem', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.6rem 0.75rem', borderRadius: '6px' }}>
                      Ocurrió un problema técnico al generar el archivo PDF. Tu pago sigue confirmado y seguro.
                    </div>
                    <button
                      type="button"
                      onClick={reintentarGeneracion}
                      disabled={reintentandoComprobante}
                      className={styles.btnReintentarComprobante}
                    >
                      {reintentandoComprobante ? (
                        <>
                          <span className={styles.spinnerDark} aria-hidden="true" />
                          <span>Generando nuevamente...</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">↻</span>
                          <span>Reintentar generación de comprobante</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '6px' }}>
                    <span className={styles.spinnerDark} aria-hidden="true" />
                    <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
                      <strong>Estamos preparando tu comprobante...</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Estará disponible para descargar en unos segundos.
                      </div>
                    </div>
                  </div>
                )}

                {errorDescarga && (
                  <div style={{ fontSize: '0.75rem', color: '#991b1b', background: '#fef2f2', padding: '0.5rem', borderRadius: '4px' }}>
                    {errorDescarga}
                  </div>
                )}
              </section>
            </>
          )}

          {estadoTransaccion === 'RECHAZADO' && (
            <section className={styles.alertaRechazado} role="status" aria-live="polite">
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>✗ Transacción Rechazada</h2>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {mensajeError || 'La entidad bancaria rechazó la operación. Tu turno sigue confirmado pero requiere abonarse.'}
              </p>
            </section>
          )}

          {estadoTransaccion === 'ERROR' && (
            <section className={styles.alertaError} role="status" aria-live="polite">
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>⚠ Error de Comunicación</h2>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {mensajeError || 'No se pudo completar la verificación del pago. Podés reintentar la operación.'}
              </p>
            </section>
          )}

          {/* Selector de Simulación (Solo si aún no está aprobado) */}
          {!yaAprobado && (
            <div className={styles.simulacionSelector}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
                Seleccioná el resultado de prueba a simular:
              </span>
              <label
                className={`${styles.radioOption} ${resultadoSimulado === 'APROBADO' ? styles.radioOptionSelected : ''}`}
              >
                <input
                  type="radio"
                  name="resultadoSimulado"
                  value="APROBADO"
                  checked={resultadoSimulado === 'APROBADO'}
                  onChange={() => setResultadoSimulado('APROBADO')}
                  disabled={estaProcesando}
                />
                <span>Tarjeta con fondos (Aprobación exitosa)</span>
              </label>

              <label
                className={`${styles.radioOption} ${resultadoSimulado === 'RECHAZADO' ? styles.radioOptionSelected : ''}`}
              >
                <input
                  type="radio"
                  name="resultadoSimulado"
                  value="RECHAZADO"
                  checked={resultadoSimulado === 'RECHAZADO'}
                  onChange={() => setResultadoSimulado('RECHAZADO')}
                  disabled={estaProcesando}
                />
                <span>Tarjeta rechazada (Simular fondos insuficientes)</span>
              </label>

              <label
                className={`${styles.radioOption} ${resultadoSimulado === 'ERROR' ? styles.radioOptionSelected : ''}`}
              >
                <input
                  type="radio"
                  name="resultadoSimulado"
                  value="ERROR"
                  checked={resultadoSimulado === 'ERROR'}
                  onChange={() => setResultadoSimulado('ERROR')}
                  disabled={estaProcesando}
                />
                <span>Error técnico del proveedor (Simular caída de red)</span>
              </label>
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {!yaAprobado ? (
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={iniciarYProcesarPago}
                disabled={estaProcesando}
              >
                {estaProcesando && <span className={styles.spinner} aria-hidden="true" />}
                <span>
                  {estaProcesando
                    ? 'Procesando pago seguro...'
                    : estadoTransaccion === 'RECHAZADO' || estadoTransaccion === 'ERROR'
                      ? 'Reintentar pago de consulta'
                      : `Abonar consulta ($${Number(tarifa.monto).toLocaleString('es-AR')})`}
                </span>
              </button>
            ) : null}

            <Link href="/dashboard/paciente/mis-citas" className={styles.btnSecundario}>
              Volver a Mis Citas
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
