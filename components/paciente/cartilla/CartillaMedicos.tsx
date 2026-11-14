import { NOMBRES_ESPECIALIDADES_MEDICAS } from '@/lib/utils/especialidades-medicas'
import { fontBody, fontDisplay } from '@/components/landing/fonts'
import tema from '@/components/landing/tema.module.css'
import BotonVolver from '@/components/ui/BotonVolver'
import FiltroEspecialidades, { type OpcionFiltro } from './FiltroEspecialidades'
import MedicoCard, { type MedicoCartilla } from './MedicoCard'
import styles from './CartillaMedicos.module.css'

const RUTA = '/dashboard/paciente/medicos'

interface CartillaMedicosProps {
  medicos: MedicoCartilla[]
  /** Código de especialidad ya validado, o null para mostrar todas. */
  especialidad: string | null
}

export default function CartillaMedicos({ medicos, especialidad }: CartillaMedicosProps) {
  const visibles = especialidad ? medicos.filter((m) => m.especialidad === especialidad) : medicos

  const opciones: OpcionFiltro[] = [
    { valor: null, label: 'Todas', cantidad: medicos.length },
    ...Object.entries(NOMBRES_ESPECIALIDADES_MEDICAS).map(([valor, label]) => ({
      valor,
      label,
      cantidad: medicos.filter((m) => m.especialidad === valor).length,
    })),
  ]

  return (
    <main className={`${tema.tema} ${fontDisplay.variable} ${fontBody.variable} ${styles.pagina}`}>
      <header className={styles.encabezado}>
        <BotonVolver fallback="/dashboard/paciente" />
        <h1 className={styles.titulo}>Cartilla médica</h1>
        <p className={styles.subtitulo}>Conocé a nuestros profesionales y dónde atiende cada uno.</p>
      </header>

      <FiltroEspecialidades opciones={opciones} activa={especialidad} rutaBase={RUTA} />

      <p className={styles.resultado} aria-live="polite">
        {visibles.length === 1 ? '1 profesional' : `${visibles.length} profesionales`}
      </p>

      {visibles.length === 0 ? (
        <div className={styles.vacio}>
          {medicos.length === 0
            ? 'Todavía no hay profesionales cargados en el sistema.'
            : 'No hay profesionales en esta especialidad por el momento.'}
        </div>
      ) : (
        <ul className={styles.grilla}>
          {visibles.map((medico) => (
            <li key={medico.idMedico}>
              <MedicoCard medico={medico} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
