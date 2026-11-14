import Link from 'next/link'
import Logo from './Logo'
import { NAV_LINKS } from './contenido'
import styles from './Navbar.module.css'

export default function Navbar() {
  return (
    <header className={styles.header}>
      <div className={styles.contenedor}>
        <Logo />

        <nav aria-label="Principal">
          <ul className={styles.links}>
            {NAV_LINKS.map((link, i) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${styles.link} ${i === 0 ? styles.activo : ''}`}
                  aria-current={i === 0 ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <a href="#contacto" className={styles.boton}>
          Contacto
        </a>
      </div>
    </header>
  )
}
