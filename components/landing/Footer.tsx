import { FOOTER_COLUMNAS } from './contenido'
import { fontBody, fontDisplay } from './fonts'
import tema from './tema.module.css'
import styles from './Footer.module.css'

// Pie de página global: se renderiza desde app/layout.tsx en todas las páginas.
export default function Footer() {
  return (
    <footer
      id="contacto"
      className={`${tema.tema} ${fontDisplay.variable} ${fontBody.variable} ${styles.footer}`}
    >
      <div className={styles.contenedor}>
        <p className={styles.marca}>SIGESMED</p>

        <hr className={styles.divisorClaro} />

        <div className={styles.columnas}>
          {FOOTER_COLUMNAS.map((columna) => (
            <div key={columna.titulo} className={styles.columna}>
              <h2 className={styles.columnaTitulo}>{columna.titulo}</h2>
              <ul className={styles.lista}>
                {columna.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <a href={item.href} className={styles.link}>
                        {item.label}
                      </a>
                    ) : (
                      item.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className={styles.divisorOscuro} />

        <div className={styles.cierre}>
          <span className={styles.sello} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3H5a2 2 0 0 0-2 2v4a5 5 0 0 0 10 0V5a2 2 0 0 0-2-2h-1" />
              <path d="M8 14v1a6 6 0 0 0 12 0v-2" />
              <circle cx="20" cy="11" r="2" />
            </svg>
          </span>
          <p className={styles.legal}>
            © {new Date().getFullYear()} SIGESMED. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
