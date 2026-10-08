'use client'

// Ejecuta la confirmación y maneja el conflicto cuando otro paciente tomó el turno.
import Link from 'next/link'
import { useState } from 'react'

type Props = {
  idTurno: string
  idMedico: string
}

export default function ConfirmarReserva({ idTurno, idMedico }: Props) {
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'confirmado' | 'error'>('inicial')
  const [mensaje, setMensaje] = useState('')

  async function confirmar() {
    setEstado('cargando')
    setMensaje('')

    try {
      const response = await fetch(`/api/pacientes/turnos/${idTurno}/confirmar`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setMensaje('Lo sentimos, este turno acaba de ser reservado por otro paciente.')
        } else {
          setMensaje(data.error ?? 'No se pudo confirmar el turno')
        }

        setEstado('error')
        return
      }

      setEstado('confirmado')
    } catch {
      setMensaje('No se pudo contactar al servidor. Intentá nuevamente.')
      setEstado('error')
    }
  }

  if (estado === 'confirmado') {
    return (
      <section className="space-y-3">
        <p className="border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Turno confirmado correctamente. Se registró la reserva a nombre del paciente.
        </p>

        <Link
          href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
          className="block bg-black px-4 py-3 text-center text-xs font-semibold text-white"
        >
          Volver a horarios
        </Link>
      </section>
    )
  }

  if (estado === 'error') {
    return (
      <section className="space-y-3">
        <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {mensaje}
        </p>

        <Link
          href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
          className="block bg-black px-4 py-3 text-center text-xs font-semibold text-white hover:bg-slate-800"
        >
          Volver a horarios disponibles
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={confirmar}
        disabled={estado === 'cargando'}
        className="w-full bg-black px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {estado === 'cargando' ? 'Confirmando...' : 'Confirmar Turno'}
      </button>

      <Link
        href={`/dashboard/paciente/reservar-turno/horarios/${idMedico}`}
        className="block text-center text-xs text-slate-600 no-underline hover:text-slate-900"
      >
        Cancelar / Volver
      </Link>
    </section>
  )
}