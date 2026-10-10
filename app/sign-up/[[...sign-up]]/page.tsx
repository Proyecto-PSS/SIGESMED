import Link from 'next/link'
import RegistroPacienteForm from './registro-paciente-form'
import styles from '../registro-paciente.module.css'

export default function SignUpPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <aside className={styles.hero}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>S</span>
            <span>SIGESMED</span>
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Cuidarte empieza acá</p>
            <h1 className={styles.heroTitle}>Tu salud, más cerca y más simple.</h1>
            <p className={styles.heroText}>Encontrá profesionales, reservá turnos y organizá tu atención desde un solo lugar.</p>
          </div>
        </aside>

        <section className={styles.content}>
          <Link href="/" className={styles.back}><span className={styles.backArrow} aria-hidden="true">←</span> Volver al inicio</Link>
          <p className={styles.mobileBrand}>SIGESMED</p>
          <h2 className={styles.title}>Crear cuenta de paciente</h2>
          <p className={styles.subtitle}>Completá tus datos para reservar turnos médicos y de vacunación. Te va a llevar unos minutos.</p>
          <RegistroPacienteForm />
          <p className={styles.footer}>¿Ya tenés cuenta? <Link href="/sign-in">Iniciá sesión</Link></p>
        </section>
      </div>
    </main>
  )
}
