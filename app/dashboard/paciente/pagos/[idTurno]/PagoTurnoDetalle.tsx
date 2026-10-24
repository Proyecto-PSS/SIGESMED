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
  pacienteInfo?: {
    nombre: string
    apellido: string
    dni: string
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

function detectarMarca(numero: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'CABAL' | 'NARANJA' | 'TARJETA' {
  const clean = numero.replace(/\D/g, '')
  if (/^4/.test(clean)) return 'VISA'
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'MASTERCARD'
  if (/^3[47]/.test(clean)) return 'AMEX'
  if (/^(6042|589657)/.test(clean)) return 'CABAL'
  if (/^58956[12]/.test(clean)) return 'NARANJA'
  return 'TARJETA'
}

function validarLuhn(numero: string): boolean {
  const clean = numero.replace(/\D/g, '')
  if (clean.length < 13 || clean.length > 19) return false
  let sum = 0
  let shouldDouble = false
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10)
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

export default function PagoTurnoDetalle({ idTurno, turno, pagoInicial, tarifa, pacienteInfo }: Props) {
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

  // Datos de la Tarjeta
  const titularInicial = pacienteInfo?.nombre && pacienteInfo?.apellido
    ? `${pacienteInfo.nombre} ${pacienteInfo.apellido}`.toUpperCase()
    : ''
  const dniInicial = pacienteInfo?.dni || ''

  const [numeroTarjeta, setNumeroTarjeta] = useState('')
  const [titular, setTitular] = useState(titularInicial)
  const [dni, setDni] = useState(dniInicial)
  const [vencimiento, setVencimiento] = useState('')
  const [cvv, setCvv] = useState('')
  const [cuotas, setCuotas] = useState('1')
  const [isFlipped, setIsFlipped] = useState(false)

  // Validaciones
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const marcaActual = detectarMarca(numeroTarjeta)
  const luhnValido = validarLuhn(numeroTarjeta)
  const estaProcesando = estadoTransaccion === 'PROCESANDO'
  const yaAprobado = estadoTransaccion === 'APROBADO' || pago?.estado === 'APROBADO'

  // Consulta de comprobante PDF en segundo plano (US-24)
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

  // Formateadores interactivos
  function handleNumeroChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    const maxLen = marcaActual === 'AMEX' ? 15 : 16
    const truncated = raw.slice(0, maxLen)
    const spaced = truncated.match(/.{1,4}/g)?.join(' ') || truncated
    setNumeroTarjeta(spaced)
    if (errores.numero) setErrores((prev) => ({ ...prev, numero: '' }))
  }

  function handleVencimientoChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 2) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2)
    }
    setVencimiento(raw)
    if (errores.vencimiento) setErrores((prev) => ({ ...prev, vencimiento: '' }))
  }

  function handleCvvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, marcaActual === 'AMEX' ? 4 : 3)
    setCvv(raw)
    if (errores.cvv) setErrores((prev) => ({ ...prev, cvv: '' }))
  }

  function handleDniChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9)
    setDni(raw)
    if (errores.dni) setErrores((prev) => ({ ...prev, dni: '' }))
  }

  // Tarjetas rápidas de testing
  function cargarTarjetaPrueba(tipo: 'EXITOSA' | 'FONDOS' | 'ERROR') {
    if (tipo === 'EXITOSA') {
      setNumeroTarjeta('4242 4242 4242 4242')
      setTitular('JUAN PEREZ')
      setDni('35123456')
      setVencimiento('12/29')
      setCvv('123')
    } else if (tipo === 'FONDOS') {
      setNumeroTarjeta('4000 0000 0000 4002')
      setTitular('MARIA LOPEZ')
      setDni('38654321')
      setVencimiento('08/28')
      setCvv('456')
    } else if (tipo === 'ERROR') {
      setNumeroTarjeta('4000 0000 0000 5999')
      setTitular('CARLOS GOMEZ')
      setDni('29876543')
      setVencimiento('10/27')
      setCvv('789')
    }
    setErrores({})
  }

  function validarFormulario(): boolean {
    const nuevosErrores: Record<string, string> = {}
    const cleanNum = numeroTarjeta.replace(/\D/g, '')

    if (!cleanNum || cleanNum.length < 13) {
      nuevosErrores.numero = 'Ingresá los 16 dígitos de la tarjeta.'
    } else if (!validarLuhn(cleanNum)) {
      nuevosErrores.numero = 'El número de tarjeta no es válido (dígito de control incorrecto).'
    }

    if (!titular.trim() || titular.trim().length < 3) {
      nuevosErrores.titular = 'Ingresá el nombre y apellido impreso en la tarjeta.'
    }

    const cleanDni = dni.replace(/\D/g, '')
    if (cleanDni && (cleanDni.length < 7 || cleanDni.length > 9)) {
      nuevosErrores.dni = 'El DNI debe tener entre 7 y 9 dígitos.'
    }

    if (!vencimiento || vencimiento.length < 5) {
      nuevosErrores.vencimiento = 'Formato MM/AA requerido (ej. 08/28).'
    } else {
      const [mesStr, anioStr] = vencimiento.split('/')
      const mes = parseInt(mesStr, 10)
      const anio = 2000 + parseInt(anioStr, 10)
      const ahora = new Date()
      const anioActual = ahora.getFullYear()
      const mesActual = ahora.getMonth() + 1
      if (mes < 1 || mes > 12) {
        nuevosErrores.vencimiento = 'Mes inválido (01 a 12).'
      } else if (anio < anioActual || (anio === anioActual && mes < mesActual)) {
        nuevosErrores.vencimiento = 'La tarjeta se encuentra vencida.'
      }
    }

    const expectedCvvLen = marcaActual === 'AMEX' ? 4 : 3
    if (!cvv || cvv.length < expectedCvvLen) {
      nuevosErrores.cvv = `${expectedCvvLen} dígitos requeridos.`
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function procesarCobroTarjeta(e: React.FormEvent) {
    e.preventDefault()
    if (estaProcesando || yaAprobado) return

    setTouched({
      numero: true,
      titular: true,
      dni: true,
      vencimiento: true,
      cvv: true,
    })

    if (!validarFormulario()) {
      return
    }

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
          throw new Error(errData.error || 'No se pudo iniciar el proceso de cobro.')
        }

        const dataInicio = await resInicio.json()
        pagoActivo = dataInicio.pago
        setPago(pagoActivo)
      }

      // 2. Procesar tarjeta a través de la pasarela de pagos
      const resProcesar = await fetch(`/api/pagos/${pagoActivo.idPago}/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarjeta: {
            numero: numeroTarjeta,
            titular: titular.trim(),
            dni: dni.trim(),
            vencimiento: vencimiento.trim(),
            cvv: cvv.trim(),
            cuotas,
          },
        }),
      })

      const dataProcesada = await resProcesar.json()

      if (!resProcesar.ok) {
        throw new Error(dataProcesada.error || 'Error al procesar la transacción de tarjeta.')
      }

      const pagoResultado = dataProcesada.pago
      setPago(pagoResultado)

      if (pagoResultado.estado === 'APROBADO') {
        setEstadoTransaccion('APROBADO')
        if (pagoResultado.comprobante) {
          setComprobante(pagoResultado.comprobante)
        } else {
          consultarEstadoComprobante(pagoResultado.idPago)
        }
      } else if (pagoResultado.estado === 'RECHAZADO') {
        setEstadoTransaccion('RECHAZADO')
        setMensajeError(pagoResultado.motivoRechazo || 'La tarjeta fue rechazada por la entidad bancaria.')
      } else {
        setEstadoTransaccion('ERROR')
        setMensajeError(pagoResultado.codigoError || 'Ocurrió un error técnico al contactar al emisor de la tarjeta.')
      }
    } catch (err: any) {
      setEstadoTransaccion('ERROR')
      setMensajeError(err.message || 'Error de conexión durante el cobro de la tarjeta.')
    }
  }

  // Clase de fondo de la tarjeta según franquicia
  const fondoTarjeta =
    marcaActual === 'VISA'
      ? styles.bgVisa
      : marcaActual === 'MASTERCARD'
        ? styles.bgMastercard
        : marcaActual === 'AMEX'
          ? styles.bgAmex
          : styles.bgDefault

  return (
    <div className={styles.contenedor}>
      <main className={styles.cardPrincipal}>
        {/* Cabecera */}
        <header className={styles.cabecera}>
          <div className={styles.cabeceraTexto}>
            <span className={styles.superTitulo}>SIGESMED • Consulta Médica Particular</span>
            <h1 className={styles.titulo}>Pago con Tarjeta de Crédito / Débito</h1>
            <p className={styles.subtitulo}>Aboná tu consulta de forma segura e inmediata para confirmar tu atención.</p>
          </div>
          <div className={styles.badgeSeguridad}>
            <span aria-hidden="true">🔒</span>
            <span>TLS 256-bit</span>
          </div>
        </header>

        <div className={styles.cuerpo}>
          {/* Resumen del Turno */}
          <section className={styles.resumenTurno} aria-label="Detalles del turno médico">
            <div className={styles.filaDato}>
              <span className={styles.etiquetaDato}>Médico / Especialista:</span>
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
              <span className={styles.etiquetaDato}>Fecha y horario:</span>
              <span className={styles.valorDato}>
                {formatearFecha(turno.fecha)} a las {turno.hora} hs
              </span>
            </div>
            <div className={styles.filaDato}>
              <span className={styles.etiquetaDato}>Lugar de atención:</span>
              <span className={styles.valorDato}>
                {turno.medico.consultorio || 'Consultorio Central'}
              </span>
            </div>
            <div className={styles.filaMonto}>
              <span className={styles.montoEtiqueta}>Total a abonar:</span>
              <span className={styles.montoDestacado}>
                ${Number(tarifa.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {tarifa.moneda}
              </span>
            </div>
          </section>

          {/* VOUCHER DE PAGO APROBADO */}
          {yaAprobado ? (
            <section className={styles.voucherAprobado} role="status" aria-live="polite">
              <div className={styles.iconoExitoWrapper} aria-hidden="true">
                ✓
              </div>
              <div>
                <h2 className={styles.voucherTitulo}>¡Pago Aprobado y Confirmado!</h2>
                <p className={styles.voucherSubtitulo}>
                  Tu consulta médica quedó formalmente abonada. Podés presentar este comprobante el día de tu turno.
                </p>
              </div>

              <div className={styles.comprobanteCaja}>
                <div className={styles.filaDato}>
                  <span className={styles.etiquetaDato}>ID de Transacción:</span>
                  <span className={styles.valorDato} style={{ fontFamily: 'monospace', color: '#047857' }}>
                    {pago?.transaccionExternaId || `TX-SIGESMED-${pago?.idPago?.slice(-8)}`}
                  </span>
                </div>
                <div className={styles.filaDato}>
                  <span className={styles.etiquetaDato}>Monto abonado:</span>
                  <span className={styles.valorDato} style={{ color: '#047857', fontWeight: 700 }}>
                    ${Number(pago?.monto || tarifa.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {pago?.moneda || 'ARS'}
                  </span>
                </div>
                <div className={styles.filaDato}>
                  <span className={styles.etiquetaDato}>Fecha de aprobación:</span>
                  <span className={styles.valorDato}>
                    {pago?.aprobadoAt ? new Date(pago.aprobadoAt).toLocaleString('es-AR') : 'Recién confirmado'}
                  </span>
                </div>
                <div className={styles.filaDato}>
                  <span className={styles.etiquetaDato}>Medio de pago:</span>
                  <span className={styles.valorDato}>Tarjeta de Crédito / Débito en Línea</span>
                </div>
              </div>

              {/* RF-24.3: Sección de comprobante y descarga en formato PDF */}
              <section className={styles.seccionComprobante} aria-label="Comprobante de pago PDF">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                      Comprobante de Pago Oficial
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className={styles.btnImprimir}
                  onClick={() => window.print()}
                >
                  <span aria-hidden="true">🖨️</span>
                  <span>Imprimir Comprobante en Pantalla</span>
                </button>
                <Link href="/dashboard/paciente/mis-citas" className={styles.btnSecundario}>
                  Volver a Mis Citas
                </Link>
              </div>
            </section>
          ) : (
            <>
              {/* VISUALIZACIÓN INTERACTIVA 3D DE LA TARJETA PLÁSTICA */}
              <div className={styles.tarjetaWrapper}>
                <div className={`${styles.tarjeta3D} ${isFlipped ? styles.tarjetaFlipped : ''}`}>
                  {/* FRENTE */}
                  <div className={`${styles.tarjetaFrente} ${fondoTarjeta}`}>
                    <div className={styles.tarjetaSheen} aria-hidden="true" />
                    <div className={styles.tarjetaHeader}>
                      <div className={styles.chipYContactless}>
                        <div className={styles.chipSim}>
                          <div className={styles.chipLineH} />
                          <div className={styles.chipLineV} />
                        </div>
                        {/* Icono Contactless Waves */}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                          <path d="M8.5 16.5a5 5 0 0 1 0-7" />
                          <path d="M12 19a9 9 0 0 0 0-14" />
                          <path d="M15.5 21.5a13 13 0 0 0 0-19" />
                        </svg>
                      </div>
                      <span className={styles.brandLogoTexto}>
                        {marcaActual !== 'TARJETA' ? marcaActual : 'SIGESMED PAY'}
                      </span>
                    </div>

                    <div className={styles.numeroDisplay}>
                      {numeroTarjeta || '•••• •••• •••• ••••'}
                    </div>

                    <div className={styles.tarjetaFooter}>
                      <div>
                        <span className={styles.tarjetaLabel}>Titular</span>
                        <div className={styles.tarjetaValor}>
                          {titular || 'NOMBRE Y APELLIDO'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={styles.tarjetaLabel}>Vence</span>
                        <div className={styles.tarjetaValor}>
                          {vencimiento || 'MM/AA'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DORSO */}
                  <div className={`${styles.tarjetaDorso} ${fondoTarjeta}`}>
                    <div className={styles.tarjetaSheen} aria-hidden="true" />
                    <div className={styles.bandaMagnetica} />
                    <div className={styles.panelCvv}>
                      <span className={styles.tarjetaLabel} style={{ marginBottom: '0.2rem' }}>CVV / CVC</span>
                      <div className={styles.cvvBarra}>
                        {cvv || '•••'}
                      </div>
                      <span className={styles.cvvHelperDorso}>Código de seguridad bancario</span>
                    </div>
                    <div style={{ padding: '0 1.5rem', textAlign: 'right', fontSize: '0.65rem', opacity: 0.8 }}>
                      SIGESMED Secure Gateway
                    </div>
                  </div>
                </div>
              </div>

              {/* BARRA DE TARJETAS DE PRUEBA RÁPIDA (FACILITA EVALUACIÓN) */}
              <div className={styles.toolbarPruebas}>
                <div className={styles.toolbarTitulo}>
                  <span>🧪</span>
                  <span>Cargar tarjeta de prueba para evaluación rápida:</span>
                </div>
                <div className={styles.pillsPruebas}>
                  <button
                    type="button"
                    className={styles.btnPillPrueba}
                    onClick={() => cargarTarjetaPrueba('EXITOSA')}
                  >
                    ✓ Tarjeta Válida (Visa Aprobada)
                  </button>
                  <button
                    type="button"
                    className={styles.btnPillPrueba}
                    onClick={() => cargarTarjetaPrueba('FONDOS')}
                  >
                    ✗ Tarjeta Sin Fondos (Rechazo)
                  </button>
                  <button
                    type="button"
                    className={styles.btnPillPrueba}
                    onClick={() => cargarTarjetaPrueba('ERROR')}
                  >
                    ⚠ Error de Red (Fallo Técnico)
                  </button>
                </div>
              </div>

              {/* ALERTAS DE ERROR / RECHAZO */}
              {estadoTransaccion === 'RECHAZADO' && (
                <section className={styles.alertaRechazado} role="status" aria-live="polite">
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>✗ Transacción Rechazada</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    {mensajeError || 'La entidad bancaria rechazó el pago. Podés revisar los datos o intentar con otra tarjeta.'}
                  </p>
                </section>
              )}

              {estadoTransaccion === 'ERROR' && (
                <section className={styles.alertaError} role="status" aria-live="polite">
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>⚠ Error en la Operación</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    {mensajeError || 'Ocurrió un inconveniente al conectar con la red de pagos. Podés reintentar.'}
                  </p>
                </section>
              )}

              {/* FORMULARIO DE CARGA DE TARJETA */}
              <form onSubmit={procesarCobroTarjeta} className={styles.formularioTarjeta} noValidate>
                {/* Número de Tarjeta */}
                <div className={styles.grupoCampo}>
                  <label htmlFor="inputNumeroTarjeta" className={styles.labelCampo}>
                    <span>Número de Tarjeta</span>
                    {luhnValido && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>✓ Válida</span>}
                  </label>
                  <div className={styles.inputWrapper}>
                    <input
                      id="inputNumeroTarjeta"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="4242 4242 4242 4242"
                      value={numeroTarjeta}
                      onChange={handleNumeroChange}
                      onBlur={() => setTouched((prev) => ({ ...prev, numero: true }))}
                      disabled={estaProcesando}
                      className={`${styles.inputControl} ${
                        touched.numero && errores.numero
                          ? styles.inputError
                          : luhnValido
                            ? styles.inputValido
                            : ''
                      }`}
                      style={{ paddingRight: '4.5rem', fontFamily: 'monospace' }}
                    />
                    {marcaActual !== 'TARJETA' && (
                      <span className={styles.badgeInputMarca}>
                        {marcaActual}
                      </span>
                    )}
                  </div>
                  {touched.numero && errores.numero && (
                    <span className={styles.msgErrorCampo}>{errores.numero}</span>
                  )}
                </div>

                {/* Nombre del Titular */}
                <div className={styles.grupoCampo}>
                  <label htmlFor="inputTitular" className={styles.labelCampo}>
                    <span>Nombre y Apellido del Titular</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Como figura en el plástico</span>
                  </label>
                  <input
                    id="inputTitular"
                    type="text"
                    autoComplete="cc-name"
                    placeholder="JUAN PEREZ"
                    value={titular}
                    onChange={(e) => {
                      setTitular(e.target.value.toUpperCase())
                      if (errores.titular) setErrores((prev) => ({ ...prev, titular: '' }))
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, titular: true }))}
                    disabled={estaProcesando}
                    className={`${styles.inputControl} ${
                      touched.titular && errores.titular ? styles.inputError : ''
                    }`}
                  />
                  {touched.titular && errores.titular && (
                    <span className={styles.msgErrorCampo}>{errores.titular}</span>
                  )}
                </div>

                {/* DNI, Vencimiento y CVV */}
                <div className={styles.gridCampos3}>
                  {/* DNI */}
                  <div className={styles.grupoCampo}>
                    <label htmlFor="inputDni" className={styles.labelCampo}>
                      DNI Titular
                    </label>
                    <input
                      id="inputDni"
                      type="text"
                      inputMode="numeric"
                      placeholder="35123456"
                      value={dni}
                      onChange={handleDniChange}
                      onBlur={() => setTouched((prev) => ({ ...prev, dni: true }))}
                      disabled={estaProcesando}
                      className={`${styles.inputControl} ${
                        touched.dni && errores.dni ? styles.inputError : ''
                      }`}
                    />
                    {touched.dni && errores.dni && (
                      <span className={styles.msgErrorCampo}>{errores.dni}</span>
                    )}
                  </div>

                  {/* Vencimiento */}
                  <div className={styles.grupoCampo}>
                    <label htmlFor="inputVencimiento" className={styles.labelCampo}>
                      Vencimiento
                    </label>
                    <input
                      id="inputVencimiento"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/AA"
                      value={vencimiento}
                      onChange={handleVencimientoChange}
                      onBlur={() => setTouched((prev) => ({ ...prev, vencimiento: true }))}
                      disabled={estaProcesando}
                      className={`${styles.inputControl} ${
                        touched.vencimiento && errores.vencimiento ? styles.inputError : ''
                      }`}
                      style={{ textAlign: 'center', fontFamily: 'monospace' }}
                    />
                    {touched.vencimiento && errores.vencimiento && (
                      <span className={styles.msgErrorCampo}>{errores.vencimiento}</span>
                    )}
                  </div>

                  {/* CVV con animación de vuelta de tarjeta */}
                  <div className={styles.grupoCampo}>
                    <label htmlFor="inputCvv" className={styles.labelCampo}>
                      <span>CVV / CVC</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        {marcaActual === 'AMEX' ? '4 dígitos' : '3 dígitos'}
                      </span>
                    </label>
                    <input
                      id="inputCvv"
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder={marcaActual === 'AMEX' ? '1234' : '123'}
                      value={cvv}
                      onChange={handleCvvChange}
                      onFocus={() => setIsFlipped(true)}
                      onBlur={() => {
                        setIsFlipped(false)
                        setTouched((prev) => ({ ...prev, cvv: true }))
                      }}
                      disabled={estaProcesando}
                      className={`${styles.inputControl} ${
                        touched.cvv && errores.cvv ? styles.inputError : ''
                      }`}
                      style={{ textAlign: 'center', fontFamily: 'monospace' }}
                    />
                    {touched.cvv && errores.cvv && (
                      <span className={styles.msgErrorCampo}>{errores.cvv}</span>
                    )}
                  </div>
                </div>

                {/* Financiación / Cuotas */}
                <div className={styles.grupoCampo}>
                  <label htmlFor="selectCuotas" className={styles.labelCampo}>
                    Financiación en Cuotas
                  </label>
                  <select
                    id="selectCuotas"
                    className={styles.selectControl}
                    value={cuotas}
                    onChange={(e) => setCuotas(e.target.value)}
                    disabled={estaProcesando}
                  >
                    <option value="1">
                      1 cuota de ${Number(tarifa.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} (Sin interés)
                    </option>
                    <option value="3">
                      3 cuotas fijas de ${Math.round(Number(tarifa.monto) / 3).toLocaleString('es-AR')}
                    </option>
                    <option value="6">
                      6 cuotas fijas de ${Math.round(Number(tarifa.monto) / 6).toLocaleString('es-AR')}
                    </option>
                  </select>
                </div>

                {/* Botón de Pago */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    className={styles.btnPrimario}
                    disabled={estaProcesando}
                  >
                    {estaProcesando && <span className={styles.spinner} aria-hidden="true" />}
                    <span>
                      {estaProcesando
                        ? 'Verificando con la red bancaria...'
                        : estadoTransaccion === 'RECHAZADO' || estadoTransaccion === 'ERROR'
                          ? `Reintentar Pago • $${Number(tarifa.monto).toLocaleString('es-AR')} ARS`
                          : `Pagar Consulta Médica • $${Number(tarifa.monto).toLocaleString('es-AR')} ARS`}
                    </span>
                  </button>

                  <Link href="/dashboard/paciente/mis-citas" className={styles.btnSecundario}>
                    Cancelar y Volver a Mis Citas
                  </Link>
                </div>
              </form>

              {/* Sellos de Seguridad y Confianza */}
              <footer className={styles.footerSeguridad}>
                <div className={styles.seguridadTexto}>
                  <span aria-hidden="true">🛡️</span>
                  <span>Pagos procesados con estándares bancarios de encriptación de extremo a extremo.</span>
                </div>
                <div className={styles.sellosSeguridad}>
                  <span className={styles.selloTag}>PCI-DSS COMPLIANT</span>
                  <span className={styles.selloTag}>TLS 1.3 ENCRYPTION</span>
                  <span className={styles.selloTag}>SIGESMED SECURE</span>
                </div>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
