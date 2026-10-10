'use client'

import { useState, type FormEvent } from 'react'
import styles from './usuarios.module.css'

type Rol = 'medico' | 'enfermera'
type AltaExitosa = { email: string; passwordProvisoria: string; aviso: string }

export default function RegistroProfesional() {
  const [rol, setRol] = useState<Rol>('medico')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [alta, setAlta] = useState<AltaExitosa | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setEnviando(true)
    setError('')
    setAlta(null)
    const payload = Object.fromEntries(new FormData(form))
    try {
      const response = await fetch(`/api/admin/usuarios/${rol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar al profesional.')
      setAlta(result as AltaExitosa)
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar al profesional.')
    } finally {
      setEnviando(false)
    }
  }

  async function copiar(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      setError('El navegador no permitió copiar. Seleccioná la contraseña y copiala manualmente.')
    }
  }

  function nuevaAlta() {
    setAlta(null)
    setError('')
    setCopiado(false)
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>Personal y accesos</p>
          <h2 className={styles.title}>Registrar profesional</h2>
          <p className={styles.description}>Creá una cuenta para el equipo de salud. La contraseña inicial aparecerá una sola vez al completar el alta.</p>
        </div>
        {!alta && <div className={styles.roleSwitch} aria-label="Tipo de profesional">
          <button type="button" aria-pressed={rol === 'medico'} onClick={() => { setRol('medico'); setError('') }} className={`${styles.roleButton} ${rol === 'medico' ? styles.roleButtonActive : ''}`}>Médico</button>
          <button type="button" aria-pressed={rol === 'enfermera'} onClick={() => { setRol('enfermera'); setError('') }} className={`${styles.roleButton} ${rol === 'enfermera' ? styles.roleButtonActive : ''}`}>Enfermería</button>
        </div>}
      </div>

      {!alta ? <form onSubmit={submit} className={styles.form}>
        <div className={styles.grid}>
          <label className={styles.label}>Nombre<input name="nombre" required autoComplete="given-name" className={styles.input} placeholder="Nombre" /></label>
          <label className={styles.label}>Apellido<input name="apellido" required autoComplete="family-name" className={styles.input} placeholder="Apellido" /></label>
          <label className={styles.label}>Correo electrónico<input name="email" required type="email" autoComplete="email" className={styles.input} placeholder="nombre@institución.com" /></label>
          <label className={styles.label}>Matrícula / legajo<input name="matricula" required className={styles.input} placeholder={rol === 'medico' ? 'Ej. MN-12345' : 'Número de matrícula o legajo'} /></label>
          {rol === 'medico' && <label className={styles.label}>Especialidad<select name="especialidad" required defaultValue="" className={styles.select}>
            <option value="" disabled>Seleccioná una especialidad</option>
            <option value="CLINICA_MEDICA">Clínica Médica</option>
            <option value="PEDIATRIA">Pediatría</option>
            <option value="TRAUMATOLOGIA_ORTOPEDIA">Traumatología y Ortopedia</option>
          </select></label>}
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" disabled={enviando} className={styles.submit}>{enviando ? 'Creando cuenta…' : `Registrar ${rol === 'medico' ? 'médico' : 'enfermera'}`}<span aria-hidden="true">→</span></button>
      </form> : <div className={styles.success} role="status">
        <h3 className={styles.successTitle}>Cuenta creada correctamente</h3>
        <p className={styles.successText}>Compartí estos datos de acceso con el profesional por un canal seguro.</p>
        <div className={styles.credentialRow}><span className={styles.credentialLabel}>Email</span><span className={styles.credentialValue}>{alta.email}</span><button type="button" onClick={() => copiar(alta.email)} className={styles.copyButton}>Copiar</button></div>
        <div className={styles.credentialRow}><span className={styles.credentialLabel}>Contraseña</span><span className={styles.credentialValue}>{alta.passwordProvisoria}</span><button type="button" onClick={() => copiar(alta.passwordProvisoria)} className={styles.copyButton}>Copiar</button></div>
        {copiado && <p className={styles.copied}>Copiado al portapapeles.</p>}
        <p className={styles.warning}>La contraseña provisoria se muestra únicamente en esta pantalla. El profesional deberá cambiarla al ingresar por primera vez.</p>
        <button type="button" onClick={nuevaAlta} className={styles.newButton}>Registrar otro profesional</button>
      </div>}
    </section>
  )
}
