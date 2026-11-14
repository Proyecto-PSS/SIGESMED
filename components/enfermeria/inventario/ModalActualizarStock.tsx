'use client'

import { useEffect, useState, type FormEvent } from 'react'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './inventario.module.css'

interface Props {
  vacuna: { idVacuna: string; nombre: string; stock: number }
  onCancelar: () => void
  onActualizado: (mensaje: string) => void
}

// US-32: fija una cantidad nueva de stock. Cancelar descarta los cambios sin tocar la base.
export default function ModalActualizarStock({ vacuna, onCancelar, onActualizado }: Props) {
  const [cantidad, setCantidad] = useState(String(vacuna.stock))
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onCancelar()
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [guardando, onCancelar])

  const handleGuardar = async (e: FormEvent) => {
    e.preventDefault()
    const stockNuevo = Number(cantidad)
    if (cantidad.trim() === '' || !Number.isInteger(stockNuevo)) {
      setError('Ingresá una cantidad entera.')
      return
    }
    if (stockNuevo < 0) {
      setError('La cantidad no puede ser negativa.')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/enfermeria/vacunas/${encodeURIComponent(vacuna.idVacuna)}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockNuevo, motivo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el stock.')
      onActualizado(data.mensaje)
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  const diferencia = Number(cantidad) - vacuna.stock

  return (
    <div className={styles.modalFondo} role="dialog" aria-modal="true" aria-labelledby="titulo-actualizar-stock">
      {/* noValidate: la validación la hace handleGuardar, para mostrar nuestros mensajes en vez de los del navegador. */}
      <form className={styles.modal} onSubmit={handleGuardar} noValidate>
        <h2 id="titulo-actualizar-stock" className={styles.modalTitulo}>Actualizar stock</h2>
        <p className={styles.modalTexto}>
          <strong>{vacuna.nombre}</strong> · stock actual: {vacuna.stock} dosis
        </p>

        <label className={ui.campo}>
          Nueva cantidad (dosis)
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className={ui.control}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={guardando}
            autoFocus
            required
          />
          {Number.isInteger(diferencia) && diferencia !== 0 && Number(cantidad) >= 0 && (
            <span className={ui.ayuda}>
              {diferencia > 0 ? `Se suman ${diferencia}` : `Se descuentan ${Math.abs(diferencia)}`} dosis.
            </span>
          )}
        </label>

        <label className={ui.campo}>
          Motivo <span className={ui.ayuda}>(opcional)</span>
          <input
            type="text"
            className={ui.control}
            placeholder="Ej: recepción de pedido, conteo físico"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={guardando}
            maxLength={120}
          />
        </label>

        {error && (
          <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">
            {error}
          </p>
        )}

        <div className={styles.modalAcciones}>
          <button type="button" className={ui.botonSecundario} onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className={ui.botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
