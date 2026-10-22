'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="border border-slate-200 bg-white p-6">
        <p className="mb-4 text-xs font-mono uppercase tracking-widest text-slate-500">¿Cómo vas a abonar la consulta? *</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setModalidad('PARTICULAR')} className={`border p-4 text-left ${modalidad === 'PARTICULAR' ? 'border-black ring-1 ring-black' : 'border-slate-300'}`}>
            <strong>◯ Particular</strong>
            <span className="mt-2 block text-xs text-slate-600">Abonás la consulta en línea al confirmar la reserva.</span>
          </button>
          <button type="button" onClick={() => setModalidad('COBERTURA')} className={`border p-4 text-left ${modalidad === 'COBERTURA' ? 'border-black ring-1 ring-black' : 'border-slate-300'}`}>
            <strong>● Cobertura médica</strong>
            <span className="mt-2 block text-xs text-slate-600">La consulta se registra con tu obra social.</span>
          </button>
        </div>

        {modalidad === 'COBERTURA' && (
          <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
            <label className="text-xs font-medium uppercase">Obra social
              <select value={cobertura.obraSocial} onChange={(event) => setCobertura({ ...cobertura, obraSocial: event.target.value })} className="mt-2 w-full border border-slate-300 bg-white p-3 text-sm">
                <option value="">Seleccioná una opción</option>
                {obrasSociales.map((obra) => <option key={obra} value={obra}>{obra}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium uppercase">Nº de afiliado
              <input
                value={cobertura.numeroAfiliado}
                onChange={(event) => setCobertura({ ...cobertura, numeroAfiliado: event.target.value.replace(/\D/g, '').slice(0, 20) })}
                inputMode="numeric"
                minLength={4}
                maxLength={20}
                pattern="[0-9]{4,20}"
                placeholder="Ej. 41209384901"
                className="mt-2 w-full border border-slate-300 p-3 text-sm"
              />
              <span className="mt-1 block text-[10px] normal-case text-slate-500">Solo números, entre 4 y 20 dígitos, tal como figura en tu credencial.</span>
            </label>
            <label className="text-xs font-medium uppercase">Plan
              <input value={cobertura.plan} onChange={(event) => setCobertura({ ...cobertura, plan: event.target.value.slice(0, 30) })} placeholder="Ej. 310 o Plan Básico" maxLength={30} className="mt-2 w-full border border-slate-300 p-3 text-sm" />
              <span className="mt-1 block text-[10px] normal-case text-slate-500">Es el nombre o código del plan de cobertura que aparece en tu credencial.</span>
            </label>
            <p className="border-l-2 border-black bg-slate-100 p-3 text-xs text-slate-600 sm:col-span-3">Los datos se precargan desde tu perfil. Si los modificás, se actualizan en tu perfil para futuras reservas.</p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
        <div className="mt-6 flex justify-between gap-3 border-t border-slate-200 pt-5">
          <Link href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`} className="border border-slate-300 px-5 py-3 text-sm">← Volver</Link>
          <button type="button" onClick={continuar} disabled={!modalidad || coberturaInvalida || enviando} className="bg-black px-8 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {enviando ? 'Guardando...' : 'Continuar →'}
          </button>
        </div>
      </section>

      <aside className="h-fit border border-slate-200 bg-white p-5 text-xs">
        <h2 className="mb-4 font-mono font-bold uppercase tracking-widest">// Resumen del turno</h2>
        <dl className="space-y-3">
          <div><dt className="text-slate-500">Médico</dt><dd className="font-semibold">Dr. {turno.medico}</dd></div>
          <div><dt className="text-slate-500">Especialidad</dt><dd>{turno.especialidad}</dd></div>
          <div><dt className="text-slate-500">Fecha</dt><dd>{turno.fecha}</dd></div>
          <div><dt className="text-slate-500">Hora</dt><dd>{turno.hora} hs</dd></div>
          <div><dt className="text-slate-500">Consultorio</dt><dd>{turno.consultorio ?? 'No informado'}</dd></div>
        </dl>
      </aside>
    </div>
  )
}
