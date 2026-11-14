'use client'

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import styles from './metricas.module.css'
import type { ReporteAdministrativoDTO } from '@/lib/services/reportes-service'
import {
  rangoUltimosDias,
  type Asistencia,
  type RangoReporte,
  type ResumenPagos,
  type StockVacuna,
  type TurnosEspecialidad,
} from '@/lib/utils/reportes-utils'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'

const PERIODOS_RAPIDOS = [7, 30, 90] as const
const PERIODO_INICIAL = 30

// Paleta validada para daltonismo y contraste. Cada especialidad tiene siempre el mismo color.
const COLOR = {
  teal: '#00899c',
  violeta: '#6b5bd6',
  naranja: '#d0782e',
  terracota: '#c66a32',
  verde: '#1a8f5a',
  ambar: '#c98a16',
  rojo: '#b42318',
} as const

const COLOR_ESPECIALIDAD: Record<string, string> = {
  CLINICA_MEDICA: COLOR.teal,
  PEDIATRIA: COLOR.violeta,
  TRAUMATOLOGIA_ORTOPEDIA: COLOR.naranja,
}

// ---------- Formato ----------

const formatoNumero = new Intl.NumberFormat('es-AR')

function formatoMoneda(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
    notation: monto >= 1_000_000 ? 'compact' : 'standard',
  }).format(monto)
}

function fechaCorta(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00.000Z`))
    .replace('.', '')
}

function mismoRango(a: RangoReporte, b: RangoReporte): boolean {
  return a.desde === b.desde && a.hasta === b.hasta
}

/** Variables CSS de una barra: su color y su largo respecto del máximo. */
function estiloBarra(color: string, valor: number, maximo: number): CSSProperties {
  return { '--color': color, '--proporcion': maximo > 0 ? valor / maximo : 0 } as CSSProperties
}

function estiloAcento(color: string): CSSProperties {
  return { '--acento': color } as CSSProperties
}

// ---------- Íconos ----------

const ICONOS = {
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  asistencia: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4',
  pagos: 'M2 7h20v12H2zM2 11h20M6 15h4',
  vacuna: 'M18 2l4 4M17 7l3-3M19 9l-8 8-4 1 1-4 8-8M7 17l-5 5M14 6l4 4',
  especialidad: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
} as const

function Icono({ nombre }: { nombre: keyof typeof ICONOS }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONOS[nombre]} />
    </svg>
  )
}

// ---------- Panel ----------

export default function PanelMetricas() {
  const [rango, setRango] = useState<RangoReporte>(() => rangoUltimosDias(PERIODO_INICIAL))
  const [borrador, setBorrador] = useState<RangoReporte>(rango)
  const [reporte, setReporte] = useState<ReporteAdministrativoDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controlador = new AbortController()
    setCargando(true)
    setError(null)

    fetch(`/api/admin/reportes?${new URLSearchParams({ desde: rango.desde, hasta: rango.hasta })}`, {
      signal: controlador.signal,
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo generar el reporte.')
        setReporte(data)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Error al conectar con el servidor.')
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })

    return () => controlador.abort()
  }, [rango])

  const aplicarRango = (nuevo: RangoReporte) => {
    setBorrador(nuevo)
    setRango(nuevo)
  }

  const handleAplicar = (e: FormEvent) => {
    e.preventDefault()
    if (borrador.desde > borrador.hasta) {
      setError('La fecha "desde" no puede ser posterior a la fecha "hasta".')
      return
    }
    setRango(borrador)
  }

  return (
    <div className={styles.panel} aria-busy={cargando}>
      <header className={styles.banner}>
        <div>
          <span className={styles.eyebrow}>Métricas</span>
          <h1 className={styles.titulo}>Panel de administrador</h1>
          <p className={styles.periodo}>
            Del {fechaCorta(rango.desde)} al {fechaCorta(rango.hasta)}
          </p>
        </div>

        <div className={styles.filtros}>
          <div className={styles.chips} role="group" aria-label="Períodos rápidos">
            {PERIODOS_RAPIDOS.map((dias) => {
              const opcion = rangoUltimosDias(dias)
              const activo = mismoRango(opcion, rango)
              return (
                <button
                  key={dias}
                  type="button"
                  aria-pressed={activo}
                  className={`${styles.chip} ${activo ? styles.chipActivo : ''}`}
                  onClick={() => aplicarRango(opcion)}
                >
                  {dias} días
                </button>
              )
            })}
          </div>

          <form className={styles.rango} onSubmit={handleAplicar} aria-label="Período personalizado">
            <label className={styles.campo}>
              <span>Desde</span>
              <input
                type="date"
                value={borrador.desde}
                max={borrador.hasta}
                onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
                required
              />
            </label>
            <label className={styles.campo}>
              <span>Hasta</span>
              <input
                type="date"
                value={borrador.hasta}
                min={borrador.desde}
                onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
                required
              />
            </label>
            <button type="submit" className={styles.botonAplicar} disabled={cargando}>
              Aplicar
            </button>
          </form>
        </div>
      </header>

      {error && (
        <p className={styles.alertaError} role="alert">
          {error}
        </p>
      )}

      {!reporte ? (
        <p className={styles.cargando}>{cargando ? 'Cargando métricas…' : 'No hay datos para mostrar.'}</p>
      ) : (
        <div className={`${styles.contenido} ${cargando ? styles.actualizando : ''}`}>
          <Indicadores reporte={reporte} />

          <div className={styles.graficos}>
            <Tarjeta icono="especialidad" color={COLOR.teal} titulo="Turnos por especialidad" detalle="Turnos reservados con fecha dentro del período.">
              <TurnosPorEspecialidad turnos={reporte.turnosPorEspecialidad} />
            </Tarjeta>

            <Tarjeta icono="asistencia" color={COLOR.verde} titulo="Asistencia de pacientes" detalle="Turnos ya resueltos: atendidos o ausentes.">
              <AsistenciaPacientes asistencia={reporte.asistencia} />
            </Tarjeta>

            <Tarjeta icono="pagos" color={COLOR.violeta} titulo="Pagos realizados" detalle="Pagos registrados durante el período.">
              <PagosRealizados pagos={reporte.pagos} />
            </Tarjeta>

            <Tarjeta icono="vacuna" color={COLOR.naranja} titulo="Stock de vacunas" detalle="Stock actual, no depende del período elegido.">
              <StockVacunas vacunas={reporte.vacunas} />
            </Tarjeta>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Indicadores ----------

function Indicadores({ reporte }: { reporte: ReporteAdministrativoDTO }) {
  const { asistencia, pagos, vacunas } = reporte
  const conStockBajo = vacunas.filter((v) => v.stockBajo).length

  return (
    <div className={styles.indicadores}>
      <Indicador
        icono="calendario"
        color={COLOR.teal}
        etiqueta="Turnos reservados"
        valor={formatoNumero.format(reporte.turnosReservados)}
        detalle="en el período"
      />
      <Indicador
        icono="asistencia"
        color={COLOR.verde}
        etiqueta="Asistencia"
        valor={asistencia.porcentajeAsistencia === null ? '—' : `${asistencia.porcentajeAsistencia}%`}
        detalle={
          asistencia.total > 0
            ? `${formatoNumero.format(asistencia.asistieron)} de ${formatoNumero.format(asistencia.total)} turnos resueltos`
            : 'Sin turnos resueltos'
        }
      />
      <Indicador
        icono="pagos"
        color={COLOR.violeta}
        etiqueta="Recaudado"
        valor={formatoMoneda(pagos.montoAprobado)}
        detalle={`${formatoNumero.format(pagos.aprobados)} pagos aprobados`}
      />
      <Indicador
        icono="vacuna"
        color={conStockBajo > 0 ? COLOR.rojo : COLOR.naranja}
        etiqueta="Vacunas con stock bajo"
        valor={formatoNumero.format(conStockBajo)}
        detalle={conStockBajo > 0 ? `⚠ de ${vacunas.length} vacunas · revisar stock` : `Todo en orden (${vacunas.length} vacunas)`}
        alerta={conStockBajo > 0}
      />
    </div>
  )
}

function Indicador({
  icono,
  color,
  etiqueta,
  valor,
  detalle,
  alerta = false,
}: {
  icono: keyof typeof ICONOS
  color: string
  etiqueta: string
  valor: string
  detalle: string
  alerta?: boolean
}) {
  return (
    <div className={`${styles.indicador} ${alerta ? styles.indicadorAlerta : ''}`} style={estiloAcento(color)}>
      <div className={styles.indicadorCabecera}>
        <span className={styles.indicadorEtiqueta}>{etiqueta}</span>
        <span className={styles.icono}>
          <Icono nombre={icono} />
        </span>
      </div>
      <span className={styles.indicadorValor}>{valor}</span>
      <span className={styles.indicadorDetalle}>{detalle}</span>
    </div>
  )
}

function Tarjeta({
  icono,
  color,
  titulo,
  detalle,
  children,
}: {
  icono: keyof typeof ICONOS
  color: string
  titulo: string
  detalle: string
  children: ReactNode
}) {
  return (
    <section className={styles.tarjeta} style={estiloAcento(color)}>
      <header className={styles.tarjetaEncabezado}>
        <span className={styles.icono}>
          <Icono nombre={icono} />
        </span>
        <div>
          <h2 className={styles.tarjetaTitulo}>{titulo}</h2>
          <p className={styles.tarjetaDetalle}>{detalle}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className={styles.vacio}>{children}</p>
}

function Tooltip({ titulo, filas }: { titulo: string; filas: [string, string][] }) {
  return (
    <span className={styles.tooltip} role="tooltip">
      <strong>{titulo}</strong>
      {filas.map(([etiqueta, valor]) => (
        <span key={etiqueta} className={styles.tooltipFila}>
          <span>{etiqueta}</span>
          <span>{valor}</span>
        </span>
      ))}
    </span>
  )
}

// ---------- Gráficos ----------

const ETIQUETAS_ESTADO = [
  ['CONFIRMADO', 'Confirmados'],
  ['ATENDIDO', 'Atendidos'],
  ['AUSENTE', 'Ausentes'],
  ['CANCELADO', 'Cancelados'],
] as const

function TurnosPorEspecialidad({ turnos }: { turnos: TurnosEspecialidad[] }) {
  const maximo = Math.max(0, ...turnos.map((t) => t.total))
  if (maximo === 0) return <Vacio>No hay turnos reservados en este período.</Vacio>

  return (
    <ul className={styles.barras}>
      {turnos.map((t) => {
        const nombre = nombreEspecialidadMedica(t.especialidad)
        return (
          <li key={t.especialidad} className={styles.barraFila}>
            <div className={styles.barraCabecera}>
              <span className={styles.barraEtiqueta}>{nombre}</span>
              <span className={styles.barraValor}>{formatoNumero.format(t.total)}</span>
            </div>
            <div
              className={styles.marca}
              style={estiloBarra(COLOR_ESPECIALIDAD[t.especialidad] ?? COLOR.teal, t.total, maximo)}
              tabIndex={0}
              aria-label={`${nombre}: ${t.total} turnos`}
            >
              <span className={styles.pista}>
                <span className={styles.barra} />
              </span>
              <Tooltip
                titulo={nombre}
                filas={ETIQUETAS_ESTADO.map(([estado, etiqueta]) => [etiqueta, formatoNumero.format(t.porEstado[estado])])}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const RADIO_DONA = 48
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_DONA
const SEPARACION_DONA = 3

function AsistenciaPacientes({ asistencia }: { asistencia: Asistencia }) {
  if (asistencia.total === 0) return <Vacio>Todavía no hay turnos atendidos ni ausencias en este período.</Vacio>

  const partes = [
    { clave: 'asistieron', nombre: 'Asistieron', valor: asistencia.asistieron, color: COLOR.teal },
    { clave: 'ausentes', nombre: 'No asistieron', valor: asistencia.ausentes, color: COLOR.terracota },
  ]
  const conValor = partes.filter((p) => p.valor > 0)
  const separacion = conValor.length > 1 ? SEPARACION_DONA : 0

  let recorrido = 0
  const arcos = conValor.map((p) => {
    const largo = (p.valor / asistencia.total) * CIRCUNFERENCIA
    const arco = { ...p, largo: Math.max(largo - separacion, 0), inicio: recorrido }
    recorrido += largo
    return arco
  })

  return (
    <div className={styles.asistencia}>
      <div className={styles.dona}>
        <svg viewBox="0 0 120 120" role="img" aria-label={`${asistencia.porcentajeAsistencia}% de asistencia`}>
          {arcos.map((a) => (
            <circle
              key={a.clave}
              cx="60"
              cy="60"
              r={RADIO_DONA}
              fill="none"
              stroke={a.color}
              strokeWidth="14"
              strokeDasharray={`${a.largo} ${CIRCUNFERENCIA}`}
              strokeDashoffset={-a.inicio}
              transform="rotate(-90 60 60)"
            >
              <title>{`${a.nombre}: ${a.valor} turnos`}</title>
            </circle>
          ))}
        </svg>
        <div className={styles.donaCentro}>
          <span className={styles.donaValor}>{asistencia.porcentajeAsistencia}%</span>
          <span className={styles.donaTexto}>asistencia</span>
        </div>
      </div>

      <ul className={styles.leyenda}>
        {partes.map((p) => (
          <li key={p.clave} className={styles.leyendaItem}>
            <span className={styles.leyendaMuestra} style={{ background: p.color }} aria-hidden="true" />
            <span className={styles.leyendaNombre}>{p.nombre}</span>
            <span className={styles.leyendaValor}>{formatoNumero.format(p.valor)}</span>
            <span className={styles.leyendaShare}>{Math.round((p.valor / asistencia.total) * 100)}%</span>
          </li>
        ))}
        <li className={styles.leyendaTotal}>
          <span>Turnos resueltos</span>
          <span>{formatoNumero.format(asistencia.total)}</span>
        </li>
      </ul>
    </div>
  )
}

function PagosRealizados({ pagos }: { pagos: ResumenPagos }) {
  const total = pagos.aprobados + pagos.rechazados + pagos.pendientes
  if (total === 0) return <Vacio>No se registraron pagos en este período.</Vacio>

  const estados = [
    { nombre: 'Aprobados', valor: pagos.aprobados, color: COLOR.verde, icono: '✓' },
    { nombre: 'En proceso', valor: pagos.pendientes, color: COLOR.ambar, icono: '●' },
    { nombre: 'Rechazados o con error', valor: pagos.rechazados, color: COLOR.rojo, icono: '✕' },
  ]

  return (
    <div className={styles.pagos}>
      <div className={styles.destacado}>
        <span className={styles.destacadoValor}>{formatoMoneda(pagos.montoAprobado)}</span>
        <span className={styles.destacadoTexto}>
          recaudados · monto promedio {pagos.ticketPromedio === null ? '—' : formatoMoneda(pagos.ticketPromedio)}
        </span>
      </div>

      <div className={styles.medidor}>
        {estados
          .filter((e) => e.valor > 0)
          .map((e) => (
            <div
              key={e.nombre}
              className={`${styles.marca} ${styles.medidorParte}`}
              style={{ flexGrow: e.valor, background: e.color }}
              tabIndex={0}
              aria-label={`${e.nombre}: ${e.valor} pagos`}
            >
              <Tooltip titulo={e.nombre} filas={[['Pagos', formatoNumero.format(e.valor)]]} />
            </div>
          ))}
      </div>

      <ul className={styles.estadosPago}>
        {estados.map((e) => (
          <li key={e.nombre} className={styles.estadoPago} style={estiloAcento(e.color)}>
            <span className={styles.estadoIcono} aria-hidden="true">{e.icono}</span>
            <span className={styles.estadoNombre}>{e.nombre}</span>
            <span className={styles.estadoValor}>{formatoNumero.format(e.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StockVacunas({ vacunas }: { vacunas: StockVacuna[] }) {
  if (vacunas.length === 0) return <Vacio>No hay vacunas cargadas.</Vacio>
  const maximo = Math.max(...vacunas.map((v) => v.stock))

  return (
    <ul className={styles.barras}>
      {vacunas.map((v) => (
        <li key={v.idVacuna} className={styles.barraFila}>
          <div className={styles.barraCabecera}>
            <span className={styles.barraEtiqueta}>
              {v.nombre}
              {v.stockBajo && <span className={styles.etiquetaCritico}>⚠ Stock bajo</span>}
            </span>
            <span className={styles.barraValor}>{formatoNumero.format(v.stock)} dosis</span>
          </div>
          <div
            className={styles.marca}
            style={estiloBarra(v.stockBajo ? COLOR.rojo : COLOR.naranja, v.stock, maximo)}
            tabIndex={0}
            aria-label={`${v.nombre}: ${v.stock} dosis${v.stockBajo ? `, debajo del umbral de ${v.umbralAlerta}` : ''}`}
          >
            <span className={styles.pista}>
              <span className={styles.barra} />
            </span>
            <Tooltip titulo={v.nombre} filas={[['Dosis disponibles', formatoNumero.format(v.stock)]]} />
          </div>
        </li>
      ))}
    </ul>
  )
}
