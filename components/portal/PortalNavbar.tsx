'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import Logo from '@/components/landing/Logo'
import styles from './PortalNavbar.module.css'

export interface SeccionPortal {
  href: string
  label: string
  /** Rutas que también marcan la pestaña como activa (pasos del mismo flujo). */
  activoEn?: string[]
  /** Solo se marca en esa ruta exacta (para "Inicio", que contiene a todas las demás). */
  exacto?: boolean
}

interface PortalNavbarProps {
  /** Ruta del inicio del rol (adonde lleva el logo). */
  inicio: string
  secciones: SeccionPortal[]
  nombre: string
  rol: string
  /** Texto para lectores de pantalla, ej. "Secciones del paciente". */
  etiqueta: string
}

// Barra superior común a todos los roles: logo | pestañas centradas | usuario.
export default function PortalNavbar({ inicio, secciones, nombre, rol, etiqueta }: PortalNavbarProps) {
  const pathname = usePathname()

  return (
    <header className={styles.header}>
      <div className={styles.contenedor}>
        <Logo href={inicio} />

        <nav aria-label={etiqueta} className={styles.nav}>
          <ul className={styles.links}>
            {secciones.map((seccion) => {
              const activo = seccion.exacto
                ? pathname === seccion.href
                : (seccion.activoEn ?? [seccion.href]).some((ruta) => pathname.startsWith(ruta))
              return (
                <li key={seccion.href}>
                  <Link
                    href={seccion.href}
                    className={`${styles.link} ${activo ? styles.activo : ''}`}
                    aria-current={activo ? 'page' : undefined}
                  >
                    {seccion.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={styles.usuario}>
          <div className={styles.usuarioTexto}>
            <span className={styles.nombre}>{nombre}</span>
            <span className={styles.rol}>{rol}</span>
          </div>
          <UserButton appearance={{ elements: { avatarBox: { width: '2.25rem', height: '2.25rem' } } }} />
        </div>
      </div>
    </header>
  )
}
