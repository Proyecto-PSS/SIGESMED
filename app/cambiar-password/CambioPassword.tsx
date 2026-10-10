'use client'

import { useState, type FormEvent } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import styles from './cambiar-password.module.css'

export default function CambioPassword() {
  const { isLoaded, user } = useUser()
  const router = useRouter()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)

  async function finalizarAcceso() {
    const response = await fetch('/api/cuenta/cambiar-password', { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'No se pudo finalizar la configuración de la cuenta.')
    router.replace('/')
    router.refresh()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const actual = String(values.get('actual') || '')
    const nueva = String(values.get('nueva') || '')
    const repetir = String(values.get('repetir') || '')
    if (!passwordChanged && nueva !== repetir) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setEnviando(true)
    setError('')
    let passwordChangedOnServer = passwordChanged
    try {
      if (!passwordChanged) {
        if (!user) throw new Error('No se pudo cargar la sesión. Volvé a iniciar sesión.')
        await user.updatePassword({ currentPassword: actual, newPassword: nueva, signOutOfOtherSessions: true })
        passwordChangedOnServer = true
        setPasswordChanged(true)
      }
      await finalizarAcceso()
    } catch (err) {
      const clerkErrors = (err as { errors?: Array<{ message?: string; longMessage?: string }> } | null)?.errors
      const message = [
        err instanceof Error ? err.message : '',
        ...(clerkErrors || []).flatMap((item) => [item.longMessage, item.message]),
      ].filter(Boolean).join(' ')
      if (passwordChangedOnServer) {
        setError('La contraseña ya se cambió, pero no se pudo completar el acceso. Recargá la página e iniciá sesión con la nueva contraseña.')
      } else if (/data breach|breached password|found in an online/i.test(message)) {
        setError('Esta contraseña aparece en filtraciones de seguridad conocidas. Elegí una distinta para proteger tu cuenta.')
      } else if (/incorrect password|password is incorrect|current password/i.test(message)) {
        setError('La contraseña provisoria no es correcta. Revisá la clave que te entregó el administrador.')
      } else if (/too short|minimum.*characters|at least \d+ characters/i.test(message)) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.')
      } else {
        setError('No se pudo cambiar la contraseña. Revisá la contraseña provisoria y probá con otra clave nueva.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return <main className={styles.page}><section className={styles.card}>
    <p className={styles.brand}>SIGESMED · Primer acceso</p>
    <h1 className={styles.title}>Elegí una nueva contraseña</h1>
    <p className={styles.description}>Por seguridad, antes de continuar cambiá la contraseña provisoria que te entregó el administrador.</p>
    <form onSubmit={submit}>
      <label className={styles.label}>Contraseña provisoria<input name="actual" type="password" autoComplete="current-password" minLength={8} required className={styles.input} /></label>
      <label className={styles.label}>Nueva contraseña<input name="nueva" type="password" autoComplete="new-password" minLength={8} required className={styles.input} /></label>
      <label className={styles.label}>Repetir nueva contraseña<input name="repetir" type="password" autoComplete="new-password" minLength={8} required className={styles.input} /></label>
      {error && <p role="alert" aria-live="assertive" className={styles.error}>{error}</p>}
      <button disabled={!isLoaded || enviando || passwordChanged} aria-busy={enviando || passwordChanged} className={styles.submit}>{enviando || passwordChanged ? 'Actualizando…' : 'Guardar contraseña y continuar'}</button>
    </form>
  </section></main>
}
