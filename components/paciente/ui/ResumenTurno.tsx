import ui from './ui.module.css'

export interface DatosResumenTurno {
  medico: string
  especialidad: string
  /** Fecha ya formateada para mostrar (ej. "Jueves 12 de noviembre"). */
  fecha: string
  hora: string
  consultorio: string | null
  /** Modalidad legible, si ya se eligió. */
  modalidad?: string
}

// Tarjeta lateral con los datos del turno que se está reservando.
export default function ResumenTurno({ turno, titulo = 'Tu turno' }: { turno: DatosResumenTurno; titulo?: string }) {
  return (
    <section className={ui.tarjeta} aria-label="Resumen del turno">
      <h2 className={ui.tarjetaTitulo}>{titulo}</h2>
      <dl className={ui.datos}>
        <div>
          <dt>Profesional</dt>
          <dd>{turno.medico}</dd>
        </div>
        <div>
          <dt>Especialidad</dt>
          <dd>{turno.especialidad}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{turno.fecha}</dd>
        </div>
        <div>
          <dt>Hora</dt>
          <dd>{turno.hora} hs</dd>
        </div>
        <div>
          <dt>Consultorio</dt>
          <dd>{turno.consultorio ?? 'A confirmar'}</dd>
        </div>
        {turno.modalidad && (
          <div>
            <dt>Modalidad</dt>
            <dd>{turno.modalidad}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
