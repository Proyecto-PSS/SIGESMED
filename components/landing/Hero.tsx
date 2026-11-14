import Link from 'next/link'
import { HERO } from './contenido'
import styles from './Hero.module.css'

export default function Hero() {
  return (
    <section
      className={styles.hero}
      style={{ ['--hero-imagen' as string]: `url(${HERO.imagen})` }}
      aria-labelledby="hero-titulo"
    >
      <div className={styles.contenido}>
        <h1 id="hero-titulo" className={styles.titulo}>
          {HERO.titulo}
        </h1>
        <p className={styles.subtitulo}>{HERO.subtitulo}</p>
        <Link href={HERO.cta.href} className={styles.cta}>
          {HERO.cta.label}
        </Link>
      </div>
    </section>
  )
}
