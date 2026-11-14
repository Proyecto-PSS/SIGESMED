import Link from 'next/link'
import { getCurrentPatient } from '@/lib/auth'
import { contarEstadosHistorialTurnos, obtenerHistorialTurnosPaciente } from '@/lib/services/citas-service'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import BotonVolver from '@/components/ui/BotonVolver'
import ui from '@/components/paciente/ui/ui.module.css'
import chips from '@/components/paciente/cartilla/FiltroEspecialidades.module.css'
import styles from './historia.module.css'

const etiquetasEstado: Record<string, string> = {
  CONFIRMADO: 'Reservado',
  ATENDIDO: 'Asistido',
  AUSENTE: 'Ausente',
  CANCELADO: 'Cancelado',
}

const clasesEstado: Record<string, string> = {
  CONFIRMADO: ui.etiquetaPrimaria,
  ATENDIDO: ui.etiquetaExito,
  AUSENTE: ui.etiquetaAviso,
  CANCELADO: ui.etiquetaError,
}

const opcionesEstado = [
  { value: 'CONFIRMADO', label: 'Reservados' },
  { value: 'ATENDIDO', label: 'Asistidos' },
  { value: 'AUSENTE', label: 'Ausentes' },
  { value: 'CANCELADO', label: 'Cancelados' },
] as const

type ParametroBusqueda = string | string[] | undefined

function primerParametro(valor: ParametroBusqueda) {
  return Array.isArray(valor) ? valor[0] ?? '' : valor ?? ''
}

function valorFechaInput(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return ''
  const fecha = new Date(`${valor}T00:00:00.000Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
    ? valor
    : ''
}

function fechaLegible(fecha: Date) {
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function HistoriaClinicaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: ParametroBusqueda; desde?: ParametroBusqueda; hasta?: ParametroBusqueda; ordenar?: ParametroBusqueda }>
}) {
  const paciente = await getCurrentPatient()
  const parametros = await searchParams
  const estadoFiltro = primerParametro(parametros.estado)
  const desdeFiltro = primerParametro(parametros.desde)
  const hastaFiltro = primerParametro(parametros.hasta)
  const ordenar = primerParametro(parametros.ordenar) === 'antiguo' ? 'antiguo' : 'reciente'
  const tieneFiltros = Boolean(estadoFiltro || desdeFiltro || hastaFiltro)
  let turnos: Awaited<ReturnType<typeof obtenerHistorialTurnosPaciente>> = []
  let errorFiltros = ''

  try {
    turnos = await obtenerHistorialTurnosPaciente(paciente.idPaciente, {
      estado: estadoFiltro,
      desde: desdeFiltro,
      hasta: hastaFiltro,
    }, ordenar)
  } catch (error) {
    errorFiltros = error instanceof Error ? error.message : 'No se pudo filtrar el historial.'
  }
  let conteos: Awaited<ReturnType<typeof contarEstadosHistorialTurnos>> = {}
  if (!errorFiltros) {
    conteos = await contarEstadosHistorialTurnos(paciente.idPaciente, { desde: desdeFiltro, hasta: hastaFiltro })
  }

  const totalTurnos = Object.values(conteos).reduce((total, count) => total + (count ?? 0), 0)
  const opcionesChips = [
    { value: '', label: 'Todos', count: totalTurnos },
    ...opcionesEstado.map((option) => ({
      value: option.value,
      label: option.label,
      count: conteos[option.value as keyof typeof conteos] ?? 0,
    })),
  ]

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <div>
          <h1 className={ui.titulo}>Historia clínica</h1>
          <p className={ui.subtitulo}>Todas tus consultas: reservadas, asistidas, ausentes y canceladas.</p>
        </div>
      </header>

      <form method="get" className={`${ui.tarjeta} ${styles.filtros}`} aria-label="Filtrar historial de turnos">
        {estadoFiltro && <input type="hidden" name="estado" value={estadoFiltro} />}

        <div className={styles.filtrosFila}>
          <label className={ui.campo} htmlFor="desde">
            Desde
            <input id="desde" name="desde" type="date" defaultValue={valorFechaInput(desdeFiltro)} className={ui.control} />
          </label>
          <label className={ui.campo} htmlFor="hasta">
            Hasta
            <input id="hasta" name="hasta" type="date" defaultValue={valorFechaInput(hastaFiltro)} className={ui.control} />
          </label>
          <label className={ui.campo} htmlFor="ordenar">
            Ordenar
            <select id="ordenar" name="ordenar" defaultValue={ordenar} className={ui.control}>
              <option value="reciente">Más reciente primero</option>
              <option value="antiguo">Más antiguo primero</option>
            </select>
          </label>
          <div className={styles.filtrosAcciones}>
            <button type="submit" className={ui.botonPrimario}>
              Filtrar
            </button>
            <Link href="/dashboard/paciente/historia-clinica" className={ui.botonSecundario}>
              Limpiar
            </Link>
          </div>
        </div>

        <div className={styles.estados}>
          <span className={styles.estadosLabel}>Estado</span>
          <ul className={chips.lista} aria-label="Filtrar por estado">
            {opcionesChips.map((option) => {
              const params = new URLSearchParams()
              if (desdeFiltro) params.set('desde', desdeFiltro)
              if (hastaFiltro) params.set('hasta', hastaFiltro)
              if (ordenar !== 'reciente') params.set('ordenar', ordenar)
              if (option.value) params.set('estado', option.value)
              const query = params.toString()
              const activo = estadoFiltro === option.value
              return (
                <li key={option.value || 'todos'}>
                  <Link
                    href={`/dashboard/paciente/historia-clinica${query ? `?${query}` : ''}`}
                    className={`${chips.chip} ${activo ? chips.activo : ''}`}
                    aria-current={activo ? 'true' : undefined}
                  >
                    {option.label}
                    <span className={chips.cantidad}>{option.count}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </form>

      {errorFiltros && (
        <p className={`${ui.alerta} ${ui.alertaError}`} style={{ marginTop: '1.25rem' }} role="alert">
          {errorFiltros}
        </p>
      )}

      {!errorFiltros && (
        <p className={styles.resultado} aria-live="polite">
          {turnos.length === 1 ? '1 turno' : `${turnos.length} turnos`}
        </p>
      )}

      {tieneFiltros && turnos.length === 0 && !errorFiltros && (
        <div className={ui.vacio}>
          <h2 className={ui.tarjetaTitulo}>No hay turnos con esos filtros</h2>
          <p className={ui.tarjetaTexto}>Probá cambiar el estado o ampliar el rango de fechas.</p>
        </div>
      )}

      {turnos.length === 0 && !tieneFiltros && !errorFiltros ? (
        <div className={ui.vacio}>
          <h2 className={ui.tarjetaTitulo}>Todavía no tenés turnos registrados</h2>
          <p className={ui.tarjetaTexto}>
            Cuando reserves o te atiendan, tus turnos van a aparecer acá con su fecha, profesional y estado.
          </p>
          <div style={{ marginTop: '1.25rem' }}>
            <Link href="/dashboard/paciente/reservar-turno" className={ui.botonPrimario}>
              Sacar un turno
            </Link>
          </div>
        </div>
      ) : turnos.length > 0 ? (
        <div className={styles.tablaContenedor}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Profesional</th>
                <th scope="col">Modalidad</th>
                <th scope="col">Estado</th>
                <th scope="col" className={styles.derecha}>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((turno) => (
                <tr key={turno.idTurno}>
                  <td>
                    <span className={styles.fecha}>{fechaLegible(turno.fecha)}</span>
                    <span className={styles.secundario}>{turno.hora} hs</span>
                  </td>
                  <td>
                    {turno.medico.nombre} {turno.medico.apellido}
                    <span className={styles.secundario}>{nombreEspecialidadMedica(turno.medico.especialidad)}</span>
                  </td>
                  <td>{turno.modalidad === 'COBERTURA' ? 'Obra social' : 'Particular'}</td>
                  <td>
                    <EtiquetaEstado estado={turno.estado} />
                  </td>
                  <td className={styles.derecha}>
                    {turno.modalidad === 'PARTICULAR' && turno.pagos[0]?.estado === 'APROBADO' ? (
                      <Link href={`/dashboard/paciente/pagos/${turno.idTurno}`} className={`${ui.botonSecundario} ${ui.botonChico}`}>
                        Ver
                      </Link>
                    ) : (
                      <span className={styles.sinAccion}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className={styles.listaMovil}>
            {turnos.map((turno) => (
              <li key={turno.idTurno} className={styles.itemMovil}>
                <div className={styles.itemMovilFila}>
                  <div>
                    <span className={styles.fecha}>{fechaLegible(turno.fecha)}</span>
                    <span className={styles.secundario}>{turno.hora} hs</span>
                  </div>
                  <EtiquetaEstado estado={turno.estado} />
                </div>
                <div>
                  {turno.medico.nombre} {turno.medico.apellido}
                  <span className={styles.secundario}>
                    {nombreEspecialidadMedica(turno.medico.especialidad)} ·{' '}
                    {turno.modalidad === 'COBERTURA' ? 'Obra social' : 'Particular'}
                  </span>
                </div>
                {turno.modalidad === 'PARTICULAR' && turno.pagos[0]?.estado === 'APROBADO' && (
                  <div>
                    <Link href={`/dashboard/paciente/pagos/${turno.idTurno}`} className={`${ui.botonSecundario} ${ui.botonChico}`}>
                      Ver comprobante
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  )
}

function EtiquetaEstado({ estado }: { estado: string }) {
  return (
    <span className={`${ui.etiqueta} ${clasesEstado[estado] ?? ui.etiquetaNeutra}`}>
      {etiquetasEstado[estado] ?? estado}
    </span>
  )
}
