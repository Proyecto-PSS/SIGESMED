'use client'

import { useEffect } from 'react'
import { ResumenPublicacion } from '@/lib/types/agenda'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './agenda.module.css'

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

// US-04: confirmación de apertura de agenda, con el detalle de jornadas y cupos que se publican.
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
  useEffect(() => {
    if (!isOpen) return
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPublishing) onClose()
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [isOpen, isPublishing, onClose])

  if (!isOpen || !resumen) return null

  const [yearStr, monthStr] = resumen.mes_vigencia.split('-')
  const textoMes = `${MESES[parseInt(monthStr, 10) - 1]} ${yearStr}`
  const nombresDias = resumen.jornadas_detalle.map((j) => j.dia_nombre).join(' y ')

  return (
    <div className={styles.modalFondo} role="dialog" aria-modal="true" aria-labelledby="titulo-publicar">
      <div className={styles.modal}>
        <div className={styles.modalCabecera}>
          <div>
            <span className={styles.eyebrow}>Confirmación de publicación</span>
            <h2 id="titulo-publicar" className={styles.modalTitulo}>Confirmar apertura de agenda</h2>
            <p className={styles.tarjetaDetalle}>
              {textoMes} · {medicoNombre} ({medicoEspecialidad})
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isPublishing} className={styles.cerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <p className={`${ui.alerta} ${ui.alertaInfo}`}>
          Al confirmar, los <strong>{resumen.total_turnos} cupos</strong> quedan abiertos enseguida para que los pacientes
          reserven online.
        </p>

        <div className={styles.resumenNumeros}>
          <div className={styles.resumenDato}>
            <span className={styles.resumenValor}>{resumen.total_jornadas}</span>
            <span className={styles.resumenEtiqueta}>Jornadas · {nombresDias}</span>
          </div>
          <div className={styles.resumenDato}>
            <span className={styles.resumenValor}>{resumen.total_turnos}</span>
            <span className={styles.resumenEtiqueta}>Cupos totales</span>
          </div>
        </div>

        <ul className={styles.desglose}>
          {resumen.jornadas_detalle.map((j) => (
            <li key={j.dia_semana}>
              <span className={styles.desgloseDia}>
                {j.dia_nombre} <span className={styles.nota}>({j.ocurrencias_en_mes} jornadas)</span>
              </span>
              <span className={styles.desgloseHorario}>
                {j.hora_desde} a {j.hora_hasta} · {j.subtotal_turnos} turnos
              </span>
            </li>
          ))}
        </ul>

        {error && (
          <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">
            {error}
          </p>
        )}

        <div className={styles.modalAcciones}>
          <button type="button" onClick={onClose} disabled={isPublishing} className={ui.botonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isPublishing} className={ui.botonPrimario}>
            {isPublishing ? 'Publicando…' : 'Publicar agenda mensual'}
          </button>
        </div>
      </div>
    </div>
  )
}
