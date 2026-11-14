import Link from 'next/link'
import styles from './FiltroEspecialidades.module.css'

export interface OpcionFiltro {
  valor: string | null
  label: string
  cantidad: number
}

interface FiltroEspecialidadesProps {
  opciones: OpcionFiltro[]
  activa: string | null
  rutaBase: string
}

// Filtro por especialidad con links (?especialidad=...): funciona sin JavaScript y se puede compartir.
export default function FiltroEspecialidades({ opciones, activa, rutaBase }: FiltroEspecialidadesProps) {
  return (
    <nav aria-label="Filtrar por especialidad">
      <ul className={styles.lista}>
        {opciones.map((opcion) => {
          const seleccionada = opcion.valor === activa
          const href = opcion.valor ? `${rutaBase}?especialidad=${opcion.valor}` : rutaBase
          return (
            <li key={opcion.valor ?? 'todas'}>
              <Link
                href={href}
                scroll={false}
                className={`${styles.chip} ${seleccionada ? styles.activo : ''}`}
                aria-current={seleccionada ? 'true' : undefined}
              >
                {opcion.label}
                <span className={styles.cantidad}>{opcion.cantidad}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
