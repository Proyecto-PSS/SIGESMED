import Link from 'next/link'
import ui from './ui.module.css'

interface PantallaMensajeProps {
  titulo: string
  mensaje: string
  enlace: { href: string; label: string }
  tono?: 'aviso' | 'error' | 'info'
}

// Pantalla simple para errores o avisos del flujo (por ejemplo, "el turno ya no está disponible").
export default function PantallaMensaje({ titulo, mensaje, enlace, tono = 'aviso' }: PantallaMensajeProps) {
  const claseTono = tono === 'error' ? ui.alertaError : tono === 'info' ? ui.alertaInfo : ui.alertaAviso
  return (
    <main className={`${ui.pagina} ${ui.paginaAngosta}`}>
      <div className={ui.tarjeta}>
        <h1 className={ui.titulo}>{titulo}</h1>
        <p className={`${ui.alerta} ${claseTono}`} style={{ marginTop: '1rem' }}>
          {mensaje}
        </p>
        <div style={{ marginTop: '1.5rem' }}>
          <Link href={enlace.href} className={ui.botonPrimario}>
            {enlace.label}
          </Link>
        </div>
      </div>
    </main>
  )
}
