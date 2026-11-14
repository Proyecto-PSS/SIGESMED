import { SERVICIOS } from './contenido'
import styles from './Servicios.module.css'

export default function Servicios() {
  return (
    <section id="servicios" className={styles.seccion} aria-labelledby="servicios-titulo">
      <div className={styles.contenedor}>
        <h2 id="servicios-titulo" className={styles.titulo}>
          Todo tu centro de salud, en un solo lugar
        </h2>
        <ul className={styles.grilla}>
          {SERVICIOS.map((servicio) => (
            <li key={servicio.titulo} className={styles.tarjeta}>
              <h3 className={styles.tarjetaTitulo}>{servicio.titulo}</h3>
              <p className={styles.tarjetaTexto}>{servicio.descripcion}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
