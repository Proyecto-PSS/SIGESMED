// Paso 1 de la reserva: elegir profesional (con filtro por especialidad) y ver su próximo turno libre.
import Link from 'next/link'
import {
  especialidades,
  obtenerMedicosParaReserva,
  type EspecialidadFiltro,
} from '@/lib/services/turnos-service'
import { NOMBRES_ESPECIALIDADES_MEDICAS } from '@/lib/utils/especialidades-medicas'
import BotonVolver from '@/components/ui/BotonVolver'
import MedicoCard from '@/components/paciente/cartilla/MedicoCard'
import FiltroEspecialidades, { type OpcionFiltro } from '@/components/paciente/cartilla/FiltroEspecialidades'
import styles from '@/components/paciente/reserva/reserva.module.css'

const RUTA = '/dashboard/paciente/reservar-turno'

// Las fechas de turno se guardan como DATE (medianoche UTC): se formatean en UTC para no correr el día.
function formatoProximoTurno(fecha: Date, hora: string) {
  const dia = fecha.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora} hs`
}

export default async function ReservarTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ especialidad?: string }>
}) {
  const params = await searchParams
  const filtro = especialidades.some(({ value }) => value === params.especialidad)
    ? (params.especialidad as EspecialidadFiltro)
    : 'TODAS'

  // Una sola consulta: el filtro se aplica en memoria para poder mostrar la cantidad por especialidad.
  const todos = await obtenerMedicosParaReserva('TODAS')
  const medicos = filtro === 'TODAS' ? todos : todos.filter((m) => m.especialidad === filtro)

  const opciones: OpcionFiltro[] = [
    { valor: null, label: 'Todas', cantidad: todos.length },
    ...Object.entries(NOMBRES_ESPECIALIDADES_MEDICAS).map(([valor, label]) => ({
      valor,
      label,
      cantidad: todos.filter((m) => m.especialidad === valor).length,
    })),
  ]

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <div>
          <h1 className={styles.titulo}>Reservar turno</h1>
          <p className={styles.subtitulo}>Elegí un profesional para ver sus días y horarios disponibles.</p>
        </div>
      </header>

      <FiltroEspecialidades opciones={opciones} activa={filtro === 'TODAS' ? null : filtro} rutaBase={RUTA} />

      <p className={styles.resultado} aria-live="polite">
        {medicos.length === 1 ? '1 profesional' : `${medicos.length} profesionales`}
      </p>

      {medicos.length === 0 ? (
        <div className={styles.vacio}>No hay profesionales para la especialidad seleccionada.</div>
      ) : (
        <ul className={styles.grilla}>
          {medicos.map((medico) => (
            <li key={medico.idMedico}>
              <MedicoCard medico={medico}>
                <div className={`${styles.proximo} ${medico.proximoTurno ? '' : styles.proximoSinTurnos}`}>
                  <span className={styles.proximoLabel}>Próximo turno</span>
                  <span className={styles.proximoValor}>
                    {medico.proximoTurno
                      ? formatoProximoTurno(medico.proximoTurno.fecha, medico.proximoTurno.hora)
                      : 'Sin turnos disponibles por ahora'}
                  </span>
                </div>
                <Link
                  href={`${RUTA}/horarios/${medico.idMedico}`}
                  className={`${styles.boton} ${medico.proximoTurno ? '' : styles.botonSecundario}`}
                >
                  Ver horarios
                  <span aria-hidden="true">→</span>
                </Link>
              </MedicoCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
