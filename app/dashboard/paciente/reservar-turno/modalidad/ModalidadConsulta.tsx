'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ResumenTurno from '@/components/paciente/ui/ResumenTurno'
import ui from '@/components/paciente/ui/ui.module.css'

const obrasSociales = [
  'OSDE', 'Swiss Medical', 'Galeno', 'OSECAC', 'UOCRA', 'Medife', 'PAMI',
  'Federada Salud', 'SanCor Salud', 'Avalian', 'IOMA', 'Medicus', 'OMINT', 'OSPE',
]

type Props = {
  idTurno: string
  idMedico: string
  turno: { medico: string; especialidad: string; fecha: string; hora: string; consultorio: string | null }
  coberturaInicial: { obraSocial: string; numeroAfiliado: string; plan: string }
}

const OPCIONES = [
  {
    valor: 'PARTICULAR' as const,
    titulo: 'Particular',
    texto: 'Abonás la consulta en línea al confirmar la reserva.',
  },
  {
    valor: 'COBERTURA' as const,
    titulo: 'Obra social',
    texto: 'La consulta se registra con tu cobertura médica.',
  },
]

export default function ModalidadConsulta({ idTurno, idMedico, turno, coberturaInicial }: Props) {
  const router = useRouter()
  const [modalidad, setModalidad] = useState<'PARTICULAR' | 'COBERTURA' | null>(null)
  const [cobertura, setCobertura] = useState(coberturaInicial)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const coberturaInvalida =
    modalidad === 'COBERTURA' &&
    (!cobertura.obraSocial ||
      !/^\d{4,20}$/.test(cobertura.numeroAfiliado.trim()) ||
      !/^[\p{L}\p{N}][\p{L}\p{N} .-]{0,29}$/u.test(cobertura.plan.trim()))

  async function continuar() {
    if (!modalidad || coberturaInvalida || enviando) return
    setEnviando(true)
    setError('')
    try {
      if (modalidad === 'COBERTURA') {
        const response = await fetch('/api/pacientes/cobertura', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cobertura),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No se pudo guardar la cobertura.')
      }
      router.push(`/dashboard/paciente/reservar-turno/confirmacion?turno=${encodeURIComponent(idTurno)}&modalidad=${modalidad}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo continuar.')
      setEnviando(false)
    }
  }

  return (
    <div className={ui.conLateral}>
      <section className={ui.tarjeta}>
        <div className={ui.opciones} role="radiogroup" aria-label="Modalidad de la consulta">
          {OPCIONES.map((opcion) => {
            const activa = modalidad === opcion.valor
            return (
              <button
                key={opcion.valor}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => setModalidad(opcion.valor)}
                className={`${ui.opcion} ${activa ? ui.opcionActiva : ''}`}
              >
                <span className={ui.opcionMarca} aria-hidden="true" />
                <span>
                  <span className={ui.opcionTitulo}>{opcion.titulo}</span>
                  <span className={ui.opcionTexto}>{opcion.texto}</span>
                </span>
              </button>
            )
          })}
        </div>

        {modalidad === 'COBERTURA' && (
          <>
            <hr className={ui.separador} />
            <h2 className={ui.tarjetaTitulo}>Datos de tu cobertura</h2>
            <p className={ui.tarjetaTexto} style={{ marginBottom: '1.25rem' }}>
              Los traemos de tu perfil. Si los cambiás, se actualizan para tus próximas reservas.
            </p>
            <div className={ui.campos}>
              <label className={ui.campo}>
                Obra social
                <select
                  value={cobertura.obraSocial}
                  onChange={(event) => setCobertura({ ...cobertura, obraSocial: event.target.value })}
                  className={ui.control}
                >
                  <option value="">Seleccioná una opción</option>
                  {obrasSociales.map((obra) => <option key={obra} value={obra}>{obra}</option>)}
                </select>
              </label>
              <label className={ui.campo}>
                Nº de afiliado
                <input
                  value={cobertura.numeroAfiliado}
                  onChange={(event) => setCobertura({ ...cobertura, numeroAfiliado: event.target.value.replace(/\D/g, '').slice(0, 20) })}
                  inputMode="numeric"
                  minLength={4}
                  maxLength={20}
                  pattern="[0-9]{4,20}"
                  placeholder="Ej. 41209384901"
                  className={ui.control}
                />
                <span className={ui.ayuda}>Solo números, como figura en tu credencial.</span>
              </label>
              <label className={ui.campo}>
                Plan
                <input
                  value={cobertura.plan}
                  onChange={(event) => setCobertura({ ...cobertura, plan: event.target.value.slice(0, 30) })}
                  placeholder="Ej. 310 o Plan Básico"
                  maxLength={30}
                  className={ui.control}
                />
                <span className={ui.ayuda}>Nombre o código del plan de tu credencial.</span>
              </label>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className={`${ui.alerta} ${ui.alertaError}`} style={{ marginTop: '1.25rem' }}>
            {error}
          </p>
        )}

        <hr className={ui.separador} />
        <div className={ui.acciones}>
          <Link href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`} className={ui.botonSecundario}>
            Cambiar horario
          </Link>
          <button
            type="button"
            onClick={continuar}
            disabled={!modalidad || coberturaInvalida || enviando}
            className={ui.botonPrimario}
          >
            {enviando ? 'Guardando…' : 'Continuar'}
            {!enviando && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </section>

      <aside className={ui.lateral}>
        <ResumenTurno turno={turno} />
      </aside>
    </div>
  )
}
