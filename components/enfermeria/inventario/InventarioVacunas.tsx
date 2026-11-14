'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VacunacionService } from '@/lib/services/vacunacion-service'
import {
  FILTROS_INVENTARIO,
  coincideBusqueda,
  contarPorFiltro,
  cumpleFiltro,
  diasHastaVencimiento,
  loteVigente,
  nivelStock,
  nombreCategoriaVacuna,
  porcentajeNivel,
  proximoAVencer,
  type FiltroInventario,
  type NivelStock,
} from '@/lib/utils/inventario-vacunas'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from './inventario.module.css'
import ModalActualizarStock from './ModalActualizarStock'

export type VacunaInventario = Awaited<ReturnType<typeof VacunacionService.obtenerStockVacunas>>[number]

interface Props {
  vacunas: VacunaInventario[]
  /** Fecha de hoy (YYYY-MM-DD, hora argentina), calculada en el servidor. */
  hoy: string
  /** Nombre de la vacuna recién dada de alta, para mostrar la confirmación. */
  vacunaRegistrada?: string
}

const NIVELES: Record<NivelStock, { etiqueta: string; icono: string; clase: string }> = {
  CRITICO: { etiqueta: 'Crítico', icono: '▲', clase: styles.nivelCritico },
  BAJO: { etiqueta: 'Bajo', icono: '!', clase: styles.nivelBajo },
  NORMAL: { etiqueta: 'Normal', icono: '✓', clase: styles.nivelNormal },
}

function aFilaInventario(vacuna: VacunaInventario, hoy: string) {
  return {
    ...vacuna,
    stock: vacuna.stockDisponible,
    nivel: nivelStock(vacuna.stockDisponible, vacuna.umbralAlerta),
    lote: loteVigente(vacuna.lotes),
    porVencer: proximoAVencer(vacuna.lotes, hoy),
  }
}

type FilaInventario = ReturnType<typeof aFilaInventario>

function vencimientoCorto(fecha: string): string {
  const [anio, mes] = fecha.split('-')
  return `${mes}/${anio}`
}

export default function InventarioVacunas({ vacunas, hoy, vacunaRegistrada }: Props) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroInventario>('TODOS')
  const [vacunaAEditar, setVacunaAEditar] = useState<FilaInventario | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(
    vacunaRegistrada ? `Vacuna "${vacunaRegistrada}" registrada con éxito en el inventario.` : null
  )

  const filas = useMemo(() => vacunas.map((v) => aFilaInventario(v, hoy)), [vacunas, hoy])
  const contadores = useMemo(() => contarPorFiltro(filas, hoy), [filas, hoy])
  const visibles = filas.filter((f) => cumpleFiltro(f, filtro, hoy) && coincideBusqueda(f, busqueda))

  const cerrarMensaje = () => {
    setMensaje(null)
    if (vacunaRegistrada) router.replace('/dashboard/enfermero/inventario', { scroll: false })
  }

  const handleStockActualizado = (texto: string) => {
    setVacunaAEditar(null)
    setMensaje(texto)
    router.refresh()
  }

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltro('TODOS')
  }

  return (
    <main className={ui.pagina}>
      <header className={styles.encabezado}>
        <div>
          <span className={styles.eyebrow}>Vacunatorio</span>
          <h1 className={ui.titulo}>Inventario de vacunas</h1>
          <p className={ui.subtitulo}>Consultá el stock disponible, los lotes y los vencimientos de cada vacuna.</p>
        </div>
        <Link href="/dashboard/enfermero/inventario/nueva" className={ui.botonPrimario}>
          <span aria-hidden="true">+</span> Registrar vacuna
        </Link>
      </header>

      {mensaje && (
        <div className={`${ui.alerta} ${ui.alertaExito} ${styles.aviso}`} role="status">
          <span>✓ {mensaje}</span>
          <button type="button" className={styles.cerrarAviso} onClick={cerrarMensaje} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <Resumen filas={filas} contadores={contadores} />

      <section className={styles.tarjeta} aria-labelledby="titulo-filtros">
        <h2 id="titulo-filtros" className={styles.tarjetaTitulo}>Buscador y filtros</h2>
        <div className={styles.filtros}>
          <label className={`${ui.campo} ${styles.buscador}`}>
            Buscar vacuna o lote
            <input
              type="search"
              className={ui.control}
              placeholder="Ej: Antigripal o AG-2026"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <button type="button" className={ui.botonSecundario} onClick={limpiarFiltros}>
            Limpiar
          </button>
        </div>
        <div className={styles.chips} role="group" aria-label="Filtrar por estado">
          {(Object.keys(FILTROS_INVENTARIO) as FiltroInventario[]).map((clave) => (
            <button
              key={clave}
              type="button"
              aria-pressed={filtro === clave}
              className={`${styles.chip} ${styles[`chip${clave}`] ?? ''} ${filtro === clave ? styles.chipActivo : ''}`}
              onClick={() => setFiltro(clave)}
            >
              {FILTROS_INVENTARIO[clave]} ({contadores[clave]})
            </button>
          ))}
        </div>
      </section>

      <section className={styles.tarjeta} aria-labelledby="titulo-tabla">
        <div className={styles.tablaEncabezado}>
          <h2 id="titulo-tabla" className={styles.tarjetaTitulo}>Existencias y disponibilidad</h2>
          <span className={styles.nota}>
            {visibles.length} de {filas.length} vacunas
          </span>
        </div>

        {visibles.length === 0 ? (
          <p className={ui.vacio}>No hay vacunas que coincidan con la búsqueda o el filtro elegido.</p>
        ) : (
          <div className={styles.tablaContenedor}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Vacuna</th>
                  <th>Categoría</th>
                  <th>Lote y vencimiento</th>
                  <th>Stock disponible</th>
                  <th>Nivel</th>
                  <th className={styles.columnaAccion}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((fila) => (
                  <FilaVacuna key={fila.idVacuna} fila={fila} hoy={hoy} onActualizar={() => setVacunaAEditar(fila)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {vacunaAEditar && (
        <ModalActualizarStock
          vacuna={{ idVacuna: vacunaAEditar.idVacuna, nombre: vacunaAEditar.nombre, stock: vacunaAEditar.stock }}
          onCancelar={() => setVacunaAEditar(null)}
          onActualizado={handleStockActualizado}
        />
      )}
    </main>
  )
}

function Resumen({ filas, contadores }: { filas: FilaInventario[]; contadores: Record<FiltroInventario, number> }) {
  const dosis = filas.reduce((suma, f) => suma + f.stock, 0)
  const indicadores = [
    { etiqueta: 'Vacunas registradas', valor: filas.length, detalle: 'tipos en el inventario', clase: '' },
    {
      etiqueta: 'Stock crítico / bajo',
      valor: contadores.CRITICO_BAJO,
      detalle: contadores.CRITICO_BAJO > 0 ? 'requieren reposición' : 'todo en orden',
      clase: contadores.CRITICO_BAJO > 0 ? styles.indicadorCritico : '',
    },
    { etiqueta: 'Dosis disponibles', valor: dosis, detalle: 'en total', clase: '' },
    {
      etiqueta: 'Próximas a vencer',
      valor: contadores.PROXIMO_A_VENCER,
      detalle: 'en menos de 90 días',
      clase: contadores.PROXIMO_A_VENCER > 0 ? styles.indicadorAviso : '',
    },
  ]

  return (
    <div className={styles.indicadores}>
      {indicadores.map((i) => (
        <div key={i.etiqueta} className={`${styles.indicador} ${i.clase}`}>
          <span className={styles.indicadorEtiqueta}>{i.etiqueta}</span>
          <span className={styles.indicadorValor}>{new Intl.NumberFormat('es-AR').format(i.valor)}</span>
          <span className={styles.indicadorDetalle}>{i.detalle}</span>
        </div>
      ))}
    </div>
  )
}

function FilaVacuna({ fila, hoy, onActualizar }: { fila: FilaInventario; hoy: string; onActualizar: () => void }) {
  const nivel = NIVELES[fila.nivel]
  const detalle = [fila.laboratorio, fila.presentacion].filter(Boolean).join(' · ')
  const vencido = fila.lote?.vencimiento ? diasHastaVencimiento(fila.lote.vencimiento, hoy) < 0 : false

  return (
    <tr className={fila.nivel !== 'NORMAL' ? styles[`fila${fila.nivel}`] : undefined}>
      <td>
        <span className={styles.vacunaNombre}>{fila.nombre}</span>
        {detalle && <span className={styles.vacunaDetalle}>{detalle}</span>}
      </td>
      <td>
        <span className={styles.categoria}>{nombreCategoriaVacuna(fila.categoria)}</span>
      </td>
      <td>
        {fila.lote ? (
          <>
            <span className={styles.lote}>#{fila.lote.numeroLote}</span>
            <span className={`${styles.vencimiento} ${fila.porVencer ? styles.vencimientoProximo : ''}`}>
              {fila.lote.vencimiento
                ? `${vencido ? 'Vencido' : 'Vto.'} ${vencimientoCorto(fila.lote.vencimiento)}`
                : 'Sin vencimiento'}
            </span>
          </>
        ) : (
          <span className={styles.nota}>Sin lote</span>
        )}
      </td>
      <td>
        <span className={`${styles.stock} ${nivel.clase}`}>
          <span aria-hidden="true">{nivel.icono}</span> {fila.stock} dosis
        </span>
      </td>
      <td>
        <div className={styles.nivel} title={`Umbral de alerta: ${fila.umbralAlerta} dosis`}>
          <span className={styles.nivelPista}>
            <span
              className={`${styles.nivelBarra} ${nivel.clase}`}
              style={{ width: `${porcentajeNivel(fila.stock, fila.umbralAlerta)}%` }}
            />
          </span>
          <span className={styles.nivelTexto}>{nivel.etiqueta}</span>
        </div>
      </td>
      <td className={styles.columnaAccion}>
        <button type="button" className={`${ui.botonSecundario} ${ui.botonChico}`} onClick={onActualizar}>
          Actualizar stock
        </button>
      </td>
    </tr>
  )
}
