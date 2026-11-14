import Link from 'next/link'
import { getCurrentMedicalUser } from '@/lib/auth'
import AccesoCard from '@/components/paciente/inicio/AccesoCard'
import { ACCESOS_MEDICO } from '@/components/medico/inicio/accesos'
import ui from '@/components/paciente/ui/ui.module.css'
import styles from '@/components/medico/inicio/InicioMedico.module.css'

interface Props {
  // Al volver de publicar la agenda (US-04) llegan el total de turnos y jornadas abiertos.
  searchParams: Promise<{ agenda?: string; turnos?: string; jornadas?: string }>
}

export default async function MedicoDashboardPage({ searchParams }: Props) {
  // Valida que el usuario sea médico (si no, lanza error).
  const [medico, { agenda, turnos, jornadas }] = await Promise.all([getCurrentMedicalUser(), searchParams])
  const nombre = medico.nombre?.trim().split(' ')[0]
  const agendaPublicada = agenda === 'publicada'

  return (
    <main className={styles.pagina}>
      <div>
        <h1 className={styles.saludo}>Panel profesional</h1>
        <p className={styles.subtitulo}>{nombre ? `Hola, ${nombre}. ¿Qué necesitás hoy?` : 'Hola. ¿Qué necesitás hoy?'}</p>
      </div>

      {agendaPublicada && (
        <div className={`${ui.alerta} ${ui.alertaExito} ${styles.aviso}`} role="status">
          <span>
            ✓ <strong>¡Agenda publicada con éxito!</strong>
            {turnos && jornadas && ` Se abrieron ${turnos} turnos en ${jornadas} jornadas para que los pacientes reserven online.`}
          </span>
          <Link href="/dashboard/medico/agenda" className={ui.linkSuave}>
            Ver mi agenda →
          </Link>
        </div>
      )}

      <ul className={styles.grilla}>
        {ACCESOS_MEDICO.map((acceso) => (
          <li key={acceso.titulo}>
            <AccesoCard acceso={acceso} />
          </li>
        ))}
      </ul>
    </main>
  )
}
