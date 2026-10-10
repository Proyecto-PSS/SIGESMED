'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../registro-paciente.module.css'

const obrasSociales = [
  'Particular', 'OSDE', 'Swiss Medical', 'Galeno', 'OSECAC', 'UOCRA', 'Medife',
  'PAMI', 'Federada Salud', 'SanCor Salud', 'Avalian', 'IOMA', 'Medicus', 'OMINT', 'OSPE',
]

export default function RegistroPacienteForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [obraSocial, setObraSocial] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEnviando(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const response = await fetch('/api/registro/paciente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo crear la cuenta.')
      router.push('/sign-in?registered=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
    } finally {
      setEnviando(false)
    }
  }

  function onlyDigits(event: FormEvent<HTMLInputElement>, limit?: number) {
    const digits = event.currentTarget.value.replace(/\D/g, '')
    event.currentTarget.value = limit ? digits.slice(0, limit) : digits
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.step}>1</span>
          <div><h3 className={styles.sectionTitle}>Tus datos personales</h3><p className={styles.sectionHint}>Los usamos para identificarte y gestionar tus turnos.</p></div>
        </div>
        <div className={styles.grid}>
          <label className={styles.label}>Nombre<input name="nombre" required autoComplete="given-name" placeholder="Tu nombre" className={styles.input} /></label>
          <label className={styles.label}>Apellido<input name="apellido" required autoComplete="family-name" placeholder="Tu apellido" className={styles.input} /></label>
          <label className={styles.label}>DNI<input name="dni" required inputMode="numeric" pattern="[0-9]{7,8}" maxLength={8} onInput={(event) => onlyDigits(event, 8)} placeholder="Sin puntos" className={styles.input} /><span className={styles.fieldHint}>Solo números, sin puntos.</span></label>
          <label className={styles.label}>Teléfono<input name="telefono" inputMode="numeric" autoComplete="tel" onInput={(event) => onlyDigits(event, 15)} placeholder="Ej. 1123456789" className={styles.input} /><span className={styles.fieldHint}>Solo números.</span></label>
          <label className={`${styles.label} ${styles.full}`}>Correo electrónico<input name="email" required type="email" autoComplete="email" placeholder="nombre@correo.com" className={styles.input} /></label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={`${styles.step} ${styles.stepTeal}`}>2</span>
          <div><h3 className={styles.sectionTitle}>Tu cobertura médica</h3><p className={styles.sectionHint}>Elegí Particular si no tenés obra social o prepaga.</p></div>
        </div>
        <div className={styles.grid}>
          <label className={styles.label}>Obra social o prepaga
            <span className={styles.selectWrap}>
              <select name="obraSocial" required value={obraSocial} onChange={(event) => setObraSocial(event.target.value)} className={`${styles.select} ${!obraSocial ? styles.selectPlaceholder : ''}`}>
                <option value="" disabled>Seleccioná una opción</option>
                {obrasSociales.map((obra) => <option key={obra} value={obra}>{obra}</option>)}
              </select>
              <svg aria-hidden="true" className={styles.chevron} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
            </span>
          </label>
          <label className={styles.label}>Número de afiliado
            <input name="numeroAfiliado" inputMode="numeric" disabled={!obraSocial || obraSocial === 'Particular'} required={!!obraSocial && obraSocial !== 'Particular'} onInput={(event) => onlyDigits(event, 20)} placeholder={obraSocial === 'Particular' ? 'No aplica' : 'Solo números'} className={`${styles.input} ${!obraSocial || obraSocial === 'Particular' ? styles.disabled : ''}`} />
            <span className={styles.fieldHint}>{obraSocial === 'Particular' ? 'No necesitás un número de afiliado.' : 'Ingresá los números que figuran en tu credencial.'}</span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={`${styles.step} ${styles.stepViolet}`}>3</span>
          <div><h3 className={styles.sectionTitle}>Creá tu contraseña</h3><p className={styles.sectionHint}>La vas a usar para ingresar a tu cuenta.</p></div>
        </div>
        <label className={styles.label}>Contraseña
          <span className={styles.passwordWrap}>
            <input name="password" required type={mostrarPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" placeholder="Al menos 8 caracteres" className={`${styles.input} ${styles.passwordInput}`} />
            <button type="button" onClick={() => setMostrarPassword((visible) => !visible)} aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={mostrarPassword} className={styles.eyeButton}>
              {mostrarPassword ? (
                <svg aria-hidden="true" className={styles.eyeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8"/><path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.7 4 10 7-.5 1.1-1.4 2.3-2.6 3.3M6.2 6.2C4.1 7.4 2.6 9.4 2 12c1.3 3 5 7 10 7 1 0 2-.2 2.9-.5"/></svg>
              ) : (
                <svg aria-hidden="true" className={styles.eyeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </span>
          <span className={styles.fieldHint}>Tu contraseña se administra de forma segura mediante Clerk.</span>
        </label>
      </section>

      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button disabled={enviando} className={styles.submit}>{enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}<span aria-hidden="true">→</span></button>
    </form>
  )
}
