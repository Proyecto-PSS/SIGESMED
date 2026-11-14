'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import BotonVolver from '@/components/ui/BotonVolver'
import {
  CATEGORIAS_VACUNA,
  PRESENTACIONES_VACUNA,
  UMBRAL_ALERTA_PREDETERMINADO,
  nombreCategoriaVacuna,
} from '@/lib/utils/inventario-vacunas'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './inventario.module.css'

const INVENTARIO = '/dashboard/enfermero/inventario'

const FORMULARIO_VACIO = {
  nombre: '',
  categoria: 'CALENDARIO_NACIONAL',
  laboratorio: '',
  numeroLote: '',
  vencimiento: '',
  stockInicial: '',
  umbralAlerta: String(UMBRAL_ALERTA_PREDETERMINADO),
  presentacion: '',
}

type CampoFormulario = keyof typeof FORMULARIO_VACIO

/** Valida en el navegador lo mismo que el servidor, para avisar antes de enviar. */
function validar(datos: typeof FORMULARIO_VACIO): string | null {
  if (!datos.nombre.trim()) return 'Ingresá el nombre de la vacuna.'
  const stock = Number(datos.stockInicial)
  if (datos.stockInicial.trim() === '' || !Number.isInteger(stock)) return 'La cantidad inicial debe ser un número entero.'
  if (stock < 0) return 'La cantidad inicial no puede ser negativa.'
  if (datos.vencimiento && !datos.numeroLote.trim()) return 'Para indicar un vencimiento, ingresá también el número de lote.'
  return null
}

// US-31: alta de vacuna. Si el servidor rechaza el registro, los datos cargados se conservan.
export default function FormularioAltaVacuna({ registradaPor }: { registradaPor: string }) {
  const router = useRouter()
  const [datos, setDatos] = useState(FORMULARIO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actualizar = (campo: CampoFormulario) => (e: { target: { value: string } }) =>
    setDatos((previos) => ({ ...previos, [campo]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errorLocal = validar(datos)
    if (errorLocal) {
      setError(errorLocal)
      return
    }

    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/enfermeria/vacunas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la vacuna.')
      router.push(`${INVENTARIO}?alta=${encodeURIComponent(data.vacuna.nombre)}`)
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.')
      setGuardando(false)
    }
  }

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback={INVENTARIO} />
        <div>
          <span className={styles.eyebrow}>Vacunatorio · Inventario</span>
          <h1 className={ui.titulo}>Alta de vacuna</h1>
          <p className={ui.subtitulo}>Cargá una vacuna nueva con su stock inicial. El nombre no puede repetirse.</p>
        </div>
      </header>

      <form className={styles.alta} onSubmit={handleSubmit} noValidate>
        <div className={styles.altaCampos}>
          <section className={styles.tarjeta} aria-labelledby="titulo-identificacion">
            <div className={styles.tablaEncabezado}>
              <h2 id="titulo-identificacion" className={styles.tarjetaTitulo}>
                <span className={styles.numero}>1</span> Identificación de la vacuna
              </h2>
              <span className={styles.nota}>* obligatorio</span>
            </div>

            <div className={styles.grilla}>
              <label className={ui.campo}>
                Nombre de la vacuna *
                <input className={ui.control} value={datos.nombre} onChange={actualizar('nombre')} placeholder="Ej: Antigripal" maxLength={80} required disabled={guardando} />
              </label>
              <label className={ui.campo}>
                Categoría
                <select className={ui.control} value={datos.categoria} onChange={actualizar('categoria')} disabled={guardando}>
                  {Object.entries(CATEGORIAS_VACUNA).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>{etiqueta}</option>
                  ))}
                </select>
              </label>
              <label className={ui.campo}>
                Laboratorio / fabricante
                <input className={ui.control} value={datos.laboratorio} onChange={actualizar('laboratorio')} placeholder="Ej: Sanofi Pasteur" disabled={guardando} />
              </label>
              <label className={ui.campo}>
                Número de lote inicial
                <input className={ui.control} value={datos.numeroLote} onChange={actualizar('numeroLote')} placeholder="Ej: AG-2026-90" disabled={guardando} />
              </label>
              <label className={ui.campo}>
                Fecha de vencimiento
                <input type="date" className={ui.control} value={datos.vencimiento} onChange={actualizar('vencimiento')} disabled={guardando} />
              </label>
            </div>
          </section>

          <section className={styles.tarjeta} aria-labelledby="titulo-stock">
            <h2 id="titulo-stock" className={styles.tarjetaTitulo}>
              <span className={styles.numero}>2</span> Stock inicial
            </h2>

            <div className={styles.grilla}>
              <label className={ui.campo}>
                Cantidad inicial (dosis) *
                <input type="number" min={0} step={1} inputMode="numeric" className={ui.control} value={datos.stockInicial} onChange={actualizar('stockInicial')} placeholder="Ej: 50" required disabled={guardando} />
                <span className={ui.ayuda}>Número entero, 0 o más.</span>
              </label>
              <label className={ui.campo}>
                Umbral mínimo de alerta
                <input type="number" min={1} step={1} inputMode="numeric" className={ui.control} value={datos.umbralAlerta} onChange={actualizar('umbralAlerta')} disabled={guardando} />
                <span className={ui.ayuda}>Por debajo de este valor la vacuna figura con stock bajo.</span>
              </label>
              <label className={ui.campo}>
                Presentación
                <select className={ui.control} value={datos.presentacion} onChange={actualizar('presentacion')} disabled={guardando}>
                  <option value="">Sin especificar</option>
                  {PRESENTACIONES_VACUNA.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>

            <p className={`${ui.alerta} ${ui.alertaInfo}`}>
              Al registrarla, el stock queda disponible enseguida para asignar turnos de vacunación.
            </p>
          </section>

          {error && (
            <p className={`${ui.alerta} ${ui.alertaError}`} role="alert">
              {error}
            </p>
          )}

          <div className={styles.altaAcciones}>
            <Link href={INVENTARIO} className={ui.botonSecundario}>
              Cancelar
            </Link>
            <button type="submit" className={ui.botonPrimario} disabled={guardando}>
              {guardando ? 'Registrando…' : 'Registrar vacuna'}
            </button>
          </div>
        </div>

        <aside className={styles.resumen} aria-label="Resumen del registro">
          <h2 className={styles.resumenTitulo}>Resumen del registro</h2>
          <dl className={styles.resumenDatos}>
            <Dato etiqueta="Vacuna" valor={datos.nombre.trim()} />
            <Dato etiqueta="Categoría" valor={datos.categoria ? nombreCategoriaVacuna(datos.categoria) : ''} />
            <Dato etiqueta="Laboratorio" valor={datos.laboratorio.trim()} />
            <Dato etiqueta="Lote inicial" valor={datos.numeroLote.trim() ? `#${datos.numeroLote.trim()}` : ''} />
            <Dato etiqueta="Stock inicial" valor={datos.stockInicial ? `${datos.stockInicial} dosis` : ''} />
            <Dato etiqueta="Umbral de alerta" valor={datos.umbralAlerta ? `${datos.umbralAlerta} dosis` : ''} />
            <Dato etiqueta="Registrada por" valor={registradaPor} />
          </dl>
        </aside>
      </form>
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className={styles.resumenFila}>
      <dt>{etiqueta}</dt>
      <dd>{valor || '—'}</dd>
    </div>
  )
}
