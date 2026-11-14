'use client'

import React, { useEffect, useState, useCallback } from 'react'
import styles from './panel-enfermeria.module.css'

export type EstadoConexion = 'online' | 'offline' | 'reconnecting'

const ESTADOS: Record<EstadoConexion, { texto: string; clase: string }> = {
  online: { texto: 'En línea', clase: styles.conexionOnline },
  reconnecting: { texto: 'Reconectando…', clase: styles.conexionReconectando },
  offline: { texto: 'Sin conexión (offline)', clase: styles.conexionOffline },
}

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

  const { texto, clase } = ESTADOS[estado]

  return (
    <div role="status" aria-live="polite" className={`${styles.conexion} ${clase}`}>
      <span className={styles.conexionPunto} aria-hidden="true" />
      <span>{texto}</span>

      {estado === 'offline' && (
        <button
          type="button"
          onClick={() => {
            setEstado('reconnecting')
            verificarServidor()
          }}
          className={styles.conexionReintentar}
          title="Volver a comprobar la conexión con el servidor"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
