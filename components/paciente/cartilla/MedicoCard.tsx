import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import styles from './MedicoCard.module.css'

export interface MedicoCartilla {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
  consultorio: string | null
  direccion: string | null
}

function iniciales(nombre: string, apellido: string) {
  return `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}`.toUpperCase()
}

interface MedicoCardProps {
  medico: MedicoCartilla
  /** Contenido extra al pie de la tarjeta (por ejemplo, próximo turno y botón de reserva). */
  children?: React.ReactNode
}

// Tarjeta del profesional: quién es y dónde atiende. Se usa en la cartilla y en la reserva.
export default function MedicoCard({ medico, children }: MedicoCardProps) {
  const ubicacion = [medico.consultorio, medico.direccion].filter(Boolean)

  return (
    <article className={styles.tarjeta}>
      <div className={styles.encabezado}>
        <span className={styles.avatar} aria-hidden="true">
          {iniciales(medico.nombre, medico.apellido)}
        </span>
        <div>
          <h2 className={styles.nombre}>
            {medico.nombre} {medico.apellido}
          </h2>
          <span className={styles.especialidad}>{nombreEspecialidadMedica(medico.especialidad)}</span>
        </div>
      </div>

      <div className={styles.ubicacion}>
        <svg
          className={styles.icono}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        {ubicacion.length > 0 ? (
          <p>
            {ubicacion.map((linea, i) => (
              <span key={i} className={i === 0 ? styles.lineaPrincipal : styles.lineaSecundaria}>
                {linea}
              </span>
            ))}
          </p>
        ) : (
          <p className={styles.lineaSecundaria}>Consultorio a confirmar</p>
        )}
      </div>

      {children}
    </article>
  )
}
