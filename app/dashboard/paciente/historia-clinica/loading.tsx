import ui from '@/components/paciente/ui/ui.module.css'
import styles from './historia.module.css'

// Esqueleto mientras se carga la historia clínica.
export default function HistoriaClinicaLoading() {
  const bloque = (ancho: string, alto = '0.9rem') => (
    <span className={styles.esqueleto} style={{ width: ancho, height: alto }} />
  )

  return (
    <main className={ui.pagina} aria-busy="true" aria-label="Cargando historia clínica">
      <header className={ui.encabezado}>
        {bloque('6rem', '2rem')}
        {bloque('16rem', '2.25rem')}
      </header>
      <div className={ui.tarjeta} style={{ display: 'grid', gap: '1rem' }}>
        {bloque('100%', '2.75rem')}
        {bloque('60%', '2rem')}
      </div>
      <div className={ui.tarjeta} style={{ display: 'grid', gap: '1.1rem', marginTop: '1.5rem' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ display: 'flex', gap: '1rem' }}>
            {bloque('22%')}
            {bloque('30%')}
            {bloque('18%')}
            {bloque('14%')}
          </span>
        ))}
      </div>
    </main>
  )
}
