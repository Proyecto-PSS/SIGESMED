import Link from 'next/link'
import Logo from '@/components/landing/Logo'
import { fontBody, fontDisplay } from '@/components/landing/fonts'
import { HERO } from '@/components/landing/contenido'
import tema from '@/components/landing/tema.module.css'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  titulo: string
  texto: string
  children: React.ReactNode
}

// Pantalla dividida: panel de marca con foto a la izquierda, formulario a la derecha.
export default function AuthLayout({ titulo, texto, children }: AuthLayoutProps) {
  return (
    <div className={`${tema.tema} ${styles.pagina} ${fontDisplay.variable} ${fontBody.variable}`}>
      <aside
        className={styles.panel}
        style={{ ['--auth-imagen' as string]: `url(${HERO.imagen})` }}
      >
        <Logo tono="claro" />
        <div className={styles.mensaje}>
          <h1 className={styles.titulo}>{titulo}</h1>
          <p className={styles.texto}>{texto}</p>
        </div>
        <p className={styles.legal}>© {new Date().getFullYear()} SIGESMED</p>
      </aside>

      <main className={styles.contenido}>
        <Link href="/" className={styles.volver}>
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
        <div className={styles.formulario}>{children}</div>
      </main>
    </div>
  )
}
