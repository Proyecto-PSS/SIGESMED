import { getCurrentUser } from '@/lib/auth'
import AccesoCard from '@/components/paciente/inicio/AccesoCard'
import { ACCESOS } from '@/components/paciente/inicio/accesos'
import { fontBody, fontDisplay } from '@/components/landing/fonts'
import tema from '@/components/landing/tema.module.css'
import styles from '@/components/paciente/inicio/InicioPaciente.module.css'

export default async function PacienteDashboardPage() {
  const usuario = await getCurrentUser()
  // Solo el primer nombre; si Clerk no lo tiene, el saludo queda sin nombre.
  const nombre = usuario?.nombre?.trim().split(' ')[0]
  const saludo = nombre ? `Hola, ${nombre}. ¿Qué necesitás hoy?` : 'Hola. ¿Qué necesitás hoy?'

  return (
    <main className={`${tema.tema} ${fontDisplay.variable} ${fontBody.variable} ${styles.pagina}`}>
      <h1 className={styles.saludo}>Mi portal de salud</h1>
      <p className={styles.subtitulo}>{saludo}</p>

      <ul className={styles.grilla}>
        {ACCESOS.map((acceso) => (
          <li key={acceso.href}>
            <AccesoCard acceso={acceso} />
          </li>
        ))}
      </ul>
    </main>
  )
}
