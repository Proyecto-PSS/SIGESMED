'use client'

import React, { useEffect, useState, useCallback } from 'react'

export type EstadoConexion = 'online' | 'offline' | 'reconnecting'

interface IndicadorConectividadProps {
  onEstadoChange?: (estado: EstadoConexion) => void
  forzarVerificacion?: boolean
}

export default function IndicadorConectividad({
  onEstadoChange,
  forzarVerificacion,
}: IndicadorConectividadProps) {
  const [estado, setEstado] = useState<EstadoConexion>('online')
  const [ultimaComprobacion, setUltimaComprobacion] = useState<Date>(new Date())

  const verificarServidor = useCallback(async () => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setEstado('offline')
      onEstadoChange?.('offline')
      return false
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const res = await fetch('/api/enfermeria/ping', {
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        setEstado('online')
        onEstadoChange?.('online')
        setUltimaComprobacion(new Date())
        return true
      } else {
        setEstado('offline')
        onEstadoChange?.('offline')
        return false
      }
    } catch {
      setEstado('offline')
      onEstadoChange?.('offline')
      return false
    }
  }, [onEstadoChange])

  useEffect(() => {
    // 1. Escuchar eventos nativos de red
    const handleOnline = () => {
      setEstado('reconnecting')
      onEstadoChange?.('reconnecting')
      setTimeout(() => {
        verificarServidor()
      }, 500)
    }

    const handleOffline = () => {
      setEstado('offline')
      onEstadoChange?.('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 2. Ping periódico cada 20 segundos
    const intervalId = setInterval(() => {
      verificarServidor()
    }, 20000)

    verificarServidor()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [verificarServidor, onEstadoChange])

  useEffect(() => {
    if (forzarVerificacion) {
      setEstado('reconnecting')
      verificarServidor()
    }
  }, [forzarVerificacion, verificarServidor])

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 border border-black bg-white px-3 py-1.5 text-xs font-mono font-bold text-black shadow-sm"
    >
      <span className="flex items-center gap-1.5">
        <span className="inline-block text-sm leading-none">
          {estado === 'online' ? '●' : estado === 'reconnecting' ? '◐' : '○'}
        </span>
        <span>
          {estado === 'online'
            ? '[ ONLINE - NODO LOCAL SINCRONIZADO ]'
            : estado === 'reconnecting'
              ? 'RECONECTANDO - SINCRONIZANDO'
              : 'OFFLINE - MODO BUFFER LOCAL'}
        </span>
      </span>

      {estado === 'offline' && (
        <button
          type="button"
          onClick={() => {
            setEstado('reconnecting')
            verificarServidor()
          }}
          className="ml-1 text-[11px] underline text-black hover:text-slate-600 font-bold focus:outline-none"
          title="Reintentar verificación con el servidor"
        >
          [Reintentar]
        </button>
      )}
    </div>
  )
}
