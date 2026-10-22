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
            <section className={styles.alertaAprobado} role="status" aria-live="polite">
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>✓ ¡Pago Aprobado Exitosamente!</h2>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                Tu pago fue registrado y confirmado. Tu consulta médica quedó formalmente abonada.
              </p>
              {pago?.transaccionExternaId && (
                <div style={{ fontSize: '0.8rem', color: '#047857', fontFamily: 'monospace' }}>
                  Comprobante ID: {pago.transaccionExternaId}
                </div>
              )}
            </section>
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
