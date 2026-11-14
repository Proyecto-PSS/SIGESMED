import Link from 'next/link'
import type { obtenerHorariosDisponibles } from '@/lib/services/horarios-disponibles-service'
import type { obtenerMedico } from '@/lib/services/medicos-service'
import BotonVolver from '@/components/ui/BotonVolver'
import MedicoCard from '@/components/paciente/cartilla/MedicoCard'
import ui from '@/components/paciente/ui/ui.module.css'
import horariosStyles from '@/app/dashboard/paciente/reservar-turno/horarios/[idMedico]/horarios.module.css'

type Medico = NonNullable<Awaited<ReturnType<typeof obtenerMedico>>>
type Horarios = Awaited<ReturnType<typeof obtenerHorariosDisponibles>>

function fechaLegible(fecha: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-AR', { ...options, timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00.000Z`))
}

// Vista informativa de los horarios de un médico (desde la cartilla). Para reservar, deriva al flujo de reserva.
export function HorariosMedicoView({ medico, horarios }: { medico: Medico; horarios: Horarios }) {
  const base = `/dashboard/paciente/medicos/${encodeURIComponent(medico.idMedico)}/horarios`
  const urlDia = (fecha: string) => `${base}?mes=${encodeURIComponent(horarios.mes)}&fecha=${encodeURIComponent(fecha)}`
  const s = horariosStyles

  return (
    <main className={ui.pagina}>
      <header className={ui.encabezado}>
        <BotonVolver fallback="/dashboard/paciente/medicos" />
        <div>
          <h1 className={ui.titulo}>Turnos disponibles</h1>
          <p className={ui.subtitulo}>Consultá los días y horarios libres de este profesional.</p>
        </div>
      </header>

      <div className={s.columnas}>
        <aside className={`${s.ficha} ${ui.pila}`}>
          <MedicoCard medico={medico} />
          <Link href={`/dashboard/paciente/reservar-turno/horarios/${encodeURIComponent(medico.idMedico)}`} className={`${ui.botonPrimario} ${ui.botonAncho}`}>
            Reservar con este profesional
            <span aria-hidden="true">→</span>
          </Link>
        </aside>

        <div className={s.seleccion}>
          <section className={s.bloque} aria-labelledby="titulo-dias">
            <div className={s.bloqueEncabezado}>
              <h2 id="titulo-dias" className={s.bloqueTitulo}>
                <span className={s.bloqueNumero}>1</span>
                Días de atención
              </h2>
              <form action={base} method="GET" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="mes" className={s.nota}>Mes</label>
                <input id="mes" type="month" name="mes" defaultValue={horarios.mes} className={ui.control} style={{ width: 'auto', padding: '0.4rem 0.6rem' }} />
                <button className={`${ui.botonSecundario} ${ui.botonChico}`}>Ver</button>
              </form>
            </div>

            {horarios.dias.length === 0 ? (
              <p className={s.vacio}>
                Este profesional no tiene turnos cargados para {fechaLegible(`${horarios.mes}-01`, { month: 'long', year: 'numeric' })}.
              </p>
            ) : (
              <div className={s.dias}>
                {horarios.dias.map((dia) => {
                  const disponible = dia.disponibles > 0
                  const elegido = horarios.fecha === dia.fecha
                  const contenido = (
                    <>
                      <span className={s.diaNombre}>{fechaLegible(dia.fecha, { weekday: 'short' }).replace('.', '')}</span>
                      <span className={s.diaNumero}>{fechaLegible(dia.fecha, { day: 'numeric' })}</span>
                      <span className={s.diaEstado}>{disponible ? `${dia.disponibles} libres` : 'Agotado'}</span>
                    </>
                  )
                  return disponible ? (
                    <Link
                      key={dia.fecha}
                      href={urlDia(dia.fecha)}
                      aria-current={elegido ? 'date' : undefined}
                      className={`${s.dia} ${elegido ? s.diaActivo : ''}`}
                      style={{ textDecoration: 'none' }}
                    >
                      {contenido}
                    </Link>
                  ) : (
                    <button key={dia.fecha} type="button" disabled className={s.dia}>
                      {contenido}
                    </button>
                  )
                })}
              </div>
            )}

            {horarios.dias.length > 0 && horarios.dias.every((dia) => dia.disponibles === 0) && (
              <p role="status" className={`${ui.alerta} ${ui.alertaAviso}`} style={{ marginTop: '1rem' }}>
                Todos los días de este mes están agotados. Probá con otro mes o con otro profesional.
              </p>
            )}
          </section>

          {horarios.fecha && horarios.hayTurnosEnDia && (
            <section className={s.bloque} aria-labelledby="titulo-horarios">
              <div className={s.bloqueEncabezado}>
                <h2 id="titulo-horarios" className={s.bloqueTitulo}>
                  <span className={s.bloqueNumero}>2</span>
                  Horarios del {fechaLegible(horarios.fecha, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                {horarios.duracionTurno && <span className={s.nota}>Duración: {horarios.duracionTurno} min</span>}
              </div>

              {horarios.horariosManana.length + horarios.horariosTarde.length === 0 ? (
                <p role="status" className={s.vacio}>Ya no quedan horarios libres para este día.</p>
              ) : (
                <div className={ui.pila}>
                  {horarios.horariosManana.length > 0 && (
                    <div className={ui.pila}>
                      <h3 className={s.nota}>Mañana</h3>
                      <div className={s.horarios}>
                        {horarios.horariosManana.map((horario) => (
                          <span key={horario.idTurno} className={s.hora} style={{ textAlign: 'center' }}>{horario.hora}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {horarios.horariosTarde.length > 0 && (
                    <div className={ui.pila}>
                      <h3 className={s.nota}>Tarde</h3>
                      <div className={s.horarios}>
                        {horarios.horariosTarde.map((horario) => (
                          <span key={horario.idTurno} className={s.hora} style={{ textAlign: 'center' }}>{horario.hora}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
