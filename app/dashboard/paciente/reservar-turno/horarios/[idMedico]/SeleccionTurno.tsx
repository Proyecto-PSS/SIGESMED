'use client'

// Permite seleccionar un día y un horario sin duplicar la lógica de consulta del servidor.
import Link from 'next/link'
import { useMemo, useState } from 'react'

type Turno = {
  id: string
  fecha: string
  hora: string
  duracionMinutos: number
  estado: string
}

type Props = {
  turnos: Turno[]
}

const nombresDias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const nombresMeses = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function fechaLocal(fecha: string) {
  return new Date(`${fecha}T12:00:00`)
}

function fechaCorta(fecha: string) {
  const fechaFormateada = fechaLocal(fecha)
  return {
    dia: nombresDias[fechaFormateada.getDay()],
    numero: fechaFormateada.getDate(),
    mes: nombresMeses[fechaFormateada.getMonth()],
  }
}

export default function SeleccionTurno({ turnos }: Props) {
  const meses = useMemo(() => {
    const fechas = [...new Set(turnos.map((turno) => turno.fecha.slice(0, 7)))].sort()
    return fechas.map((mes) => ({
      mes,
      turnos: turnos.filter((turno) => turno.fecha.startsWith(mes)),
    }))
  }, [turnos])
  const [mesSeleccionado, setMesSeleccionado] = useState(meses[0]?.mes ?? '')
  const mesActual = meses.find((mes) => mes.mes === mesSeleccionado) ?? meses[0]
  const dias = useMemo(
    () =>
      [...new Set(mesActual?.turnos.map((turno) => turno.fecha) ?? [])].sort().map((fecha) => ({
        fecha,
        turnos: mesActual?.turnos.filter((turno) => turno.fecha === fecha) ?? [],
      })),
    [mesActual]
  )
  const [diaSeleccionado, setDiaSeleccionado] = useState(dias[0]?.fecha ?? '')
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string | null>(null)
  const diaActual = dias.find((dia) => dia.fecha === diaSeleccionado)
  const disponibles = diaActual?.turnos.filter((turno) => turno.estado === 'DISPONIBLE') ?? []
  const seleccionado = disponibles.find((turno) => turno.id === turnoSeleccionado)

  if (dias.length === 0) {
    return (
      <p className="border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No hay días disponibles para este médico.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between border-b border-slate-300 pb-1">
          <h2 className="text-xs font-bold uppercase">1. Seleccionar día</h2>
          <div className="flex flex-wrap justify-end gap-2">
            {meses.map((mes) => (
              <button
                key={mes.mes}
                type="button"
                onClick={() => {
                  setMesSeleccionado(mes.mes)
                  setDiaSeleccionado(mes.turnos[0]?.fecha ?? '')
                  setTurnoSeleccionado(null)
                }}
                className={`text-[10px] capitalize ${
                  mes.mes === mesSeleccionado ? 'font-bold text-slate-900' : 'text-slate-500'
                }`}
              >
                {fechaCorta(`${mes.mes}-01`).mes}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {dias.map((dia) => {
            const info = fechaCorta(dia.fecha)
            const tieneDisponibles = dia.turnos.some((turno) => turno.estado === 'DISPONIBLE')
            const seleccionado = dia.fecha === diaSeleccionado

            return (
              <button
                key={dia.fecha}
                type="button"
                disabled={!tieneDisponibles}
                onClick={() => {
                  setDiaSeleccionado(dia.fecha)
                  setTurnoSeleccionado(null)
                }}
                className={`border px-2 py-3 text-center text-xs uppercase ${
                  seleccionado
                    ? 'border-black bg-black text-white'
                    : tieneDisponibles
                      ? 'border-slate-200 bg-white hover:border-slate-500'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <span className="block text-[10px]">{info.dia.slice(0, 3)}</span>
                <span className="my-1 block text-base font-semibold">{info.numero}</span>
                <span className="block text-[10px]">
                  {tieneDisponibles ? (seleccionado ? 'Elegido' : 'Libre') : 'Agotado'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between border-b border-slate-300 pb-1">
          <h2 className="text-xs font-bold uppercase">
            2. Seleccionar horario {diaActual && `(${fechaCorta(diaActual.fecha).dia.slice(0, 3)} ${fechaCorta(diaActual.fecha).numero})`}
          </h2>
          <span className="text-[10px] text-slate-600">
            Duración: {seleccionado?.duracionMinutos ?? disponibles[0]?.duracionMinutos ?? 0} min
          </span>
        </div>
        {disponibles.length === 0 ? (
          <p className="text-xs text-slate-500">No hay horarios seleccionables para este día.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {disponibles.map((turno) => (
              <button
                key={turno.id}
                type="button"
                onClick={() => setTurnoSeleccionado(turno.id)}
                className={`border px-3 py-2 text-xs ${
                  turno.id === turnoSeleccionado
                    ? 'border-black bg-black text-white'
                    : 'border-slate-200 bg-white hover:border-slate-500'
                }`}
              >
                {turno.hora}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase">
          {seleccionado ? (
            <>
              Turno seleccionado:{' '}
              <span className="normal-case">
                {fechaCorta(seleccionado.fecha).dia} {fechaCorta(seleccionado.fecha).numero}{' '}
                {fechaCorta(seleccionado.fecha).mes} - {seleccionado.hora} hs
              </span>
            </>
          ) : (
            'Seleccioná un día y un horario'
          )}
        </p>
        {seleccionado ? (
          <Link
            href={`/dashboard/paciente/reservar-turno/confirmacion?turno=${seleccionado.id}`}
            className="bg-black px-4 py-3 text-center text-xs font-semibold text-white hover:bg-slate-800"
          >
            Continuar a Confirmación
          </Link>
        ) : (
          <span className="cursor-not-allowed bg-slate-300 px-4 py-3 text-center text-xs font-semibold text-slate-500">
            Continuar a Confirmación
          </span>
        )}
      </section>
    </div>
  )
}
