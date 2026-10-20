'use client'

import { useState, type ReactNode } from 'react'
import styles from './secciones-admin.module.css'

interface Props {
  resumen: ReactNode
  profesionales: ReactNode
  turnos: ReactNode
}

export default function SeccionesAdmin({ resumen, profesionales, turnos }: Props) {
  const [seccion, setSeccion] = useState<'resumen' | 'profesionales' | 'turnos'>('resumen')
  return <>
    <div className={styles.tabs} role="tablist" aria-label="Secciones de administración">
      <button type="button" role="tab" id="tab-resumen" aria-selected={seccion === 'resumen'} aria-controls="panel-resumen" onClick={() => setSeccion('resumen')} className={`${styles.tab} ${seccion === 'resumen' ? styles.tabActive : ''}`}>Resumen</button>
      <button type="button" role="tab" id="tab-turnos" aria-selected={seccion === 'turnos'} aria-controls="panel-turnos" onClick={() => setSeccion('turnos')} className={`${styles.tab} ${seccion === 'turnos' ? styles.tabActive : ''}`}>Gestión de turnos</button>
      <button type="button" role="tab" id="tab-profesionales" aria-selected={seccion === 'profesionales'} aria-controls="panel-profesionales" onClick={() => setSeccion('profesionales')} className={`${styles.tab} ${seccion === 'profesionales' ? styles.tabActive : ''}`}>Registro de profesionales</button>
    </div>
    {seccion === 'resumen' && <section role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen">{resumen}</section>}
    {seccion === 'turnos' && <section role="tabpanel" id="panel-turnos" aria-labelledby="tab-turnos">{turnos}</section>}
    {seccion === 'profesionales' && <section role="tabpanel" id="panel-profesionales" aria-labelledby="tab-profesionales">{profesionales}</section>}
  </>
}
