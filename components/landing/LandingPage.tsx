import Navbar from './Navbar'
import Hero from './Hero'
import Servicios from './Servicios'
import { fontBody, fontDisplay } from './fonts'
import tema from './tema.module.css'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  return (
    <div className={`${tema.tema} ${styles.landing} ${fontDisplay.variable} ${fontBody.variable}`}>
      <Navbar />
      <main>
        <Hero />
        <Servicios />
      </main>
      {/* El footer se agrega en app/layout.tsx para todas las páginas. */}
    </div>
  )
}
