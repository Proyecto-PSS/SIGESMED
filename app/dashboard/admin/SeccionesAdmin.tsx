'use client'

import { useState, type ReactNode } from 'react'
import styles from './secciones-admin.module.css'

interface Props {
  profesionales: ReactNode
  turnos: ReactNode
}

// Secciones de /dashboard/admin/gestion. El panel de administrador es el inicio del admin (/dashboard/admin).
export default function SeccionesAdmin({ profesionales, turnos }: Props) {
  const [seccion, setSeccion] = useState<'profesionales' | 'turnos'>('turnos')
  return <>
    <div className={styles.tabs} role="tablist" aria-label="Secciones de administración">
      <button type="button" role="tab" id="tab-turnos" aria-selected={seccion === 'turnos'} aria-controls="panel-turnos" onClick={() => setSeccion('turnos')} className={`${styles.tab} ${seccion === 'turnos' ? styles.tabActive : ''}`}>Gestión de turnos</button>
      <button type="button" role="tab" id="tab-profesionales" aria-selected={seccion === 'profesionales'} aria-controls="panel-profesionales" onClick={() => setSeccion('profesionales')} className={`${styles.tab} ${seccion === 'profesionales' ? styles.tabActive : ''}`}>Registro de profesionales</button>
    </div>
    {seccion === 'turnos' && <section role="tabpanel" id="panel-turnos" aria-labelledby="tab-turnos">{turnos}</section>}
    {seccion === 'profesionales' && <section role="tabpanel" id="panel-profesionales" aria-labelledby="tab-profesionales">{profesionales}</section>}
  </>
}
