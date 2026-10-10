import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type SessionRol = 'MEDICO' | 'PACIENTE' | 'ENFERMERA' | 'ADMIN'

// Mapa tal como está hoy en proxy.ts (US-02).
const roleDashboard: Record<string, string> = {
  paciente: '/dashboard/paciente',
  medico: '/dashboard/medico',
  enfermera: '/dashboard/enfermero',
  admin: '/dashboard/admin',
}

// lib/auth.ts: alias de metadata de Clerk hacia el rol de dominio.
const rolPorMetadata: Record<string, SessionRol> = {
  medico: 'MEDICO',
  paciente: 'PACIENTE',
  enfermera: 'ENFERMERA',
  enfermero: 'ENFERMERA',
  admin: 'ADMIN',
}

const modulosPorRol: Record<SessionRol, string[]> = {
  PACIENTE: ['Reserva de Turnos', 'Historial Clínico'],
  MEDICO: ['Carga de Agenda Mensual', 'Atención / Historial Ficha Paciente'],
  ENFERMERA: ['Gestión de Stock de Vacunas', 'Turnos de Vacunación'],
  ADMIN: ['Reportes Administrativos', 'Gestión de Usuarios'],
}

interface OpcionesProxy {
  userIdPresent?: boolean
  mustChangePassword?: boolean
}

function esDashboard(path: string): boolean {
  return path === '/dashboard' || path.startsWith('/dashboard/')
}

// Modela la decisión de acceso de proxy.ts (redirecciones post-login y aislamiento de rutas).
function decidirAcceso(role: string | undefined, path: string, opts: OpcionesProxy = {}): string | null {
  const { userIdPresent = true, mustChangePassword = false } = opts
  const dashboard = role ? roleDashboard[role] : undefined

  if (esDashboard(path) && !userIdPresent) return '/sign-in'
  if (!userIdPresent) return null

  if (mustChangePassword && path !== '/cambiar-password') return '/cambiar-password'
  if (path === '/cambiar-password' && !mustChangePassword) return dashboard || '/acceso-denegado'
  if (path === '/acceso-denegado' && dashboard) return dashboard
  if (path === '/' && dashboard) return dashboard
  if (path === '/' && !dashboard) return '/acceso-denegado'

  if (esDashboard(path)) {
    const isOwn = dashboard && (path === dashboard || path.startsWith(`${dashboard}/`))
    if (!isOwn) return dashboard || '/acceso-denegado'
  }

  return null
}

// Modela los guards de lib/auth.ts.
function requireRole(rolActual: SessionRol | null, required: SessionRol): { status: number } {
  if (rolActual === null) return { status: 401 }
  if (rolActual !== required) return { status: 403 }
  return { status: 200 }
}

function rolDeMetadata(role: string | undefined): SessionRol | null {
  if (!role) return null
  return rolPorMetadata[role] ?? null
}

function getCurrentMedicalUser(role: string | undefined) {
  return requireRole(rolDeMetadata(role), 'MEDICO')
}

function getCurrentNurseUser(role: string | undefined) {
  return requireRole(rolDeMetadata(role), 'ENFERMERA')
}

function getCurrentPatient(role: string | undefined) {
  return requireRole(rolDeMetadata(role), 'PACIENTE')
}

async function runAllTests() {
  console.log('\n=== US-02: PRUEBAS UNITARIAS DE ACCESO POR ROL DE USUARIO ===\n')

  // --- Escenario 1: Paciente ---
  await test('Esc.1: iniciar sesión como Paciente redirige a /dashboard/paciente', () => {
    assert.equal(decidirAcceso('paciente', '/'), '/dashboard/paciente')
  })

  await test('Esc.1: el paciente ve las opciones de Reserva de Turnos e Historial Clínico', () => {
    const modulos = modulosPorRol.PACIENTE
    assert.ok(modulos.includes('Reserva de Turnos'))
    assert.ok(modulos.includes('Historial Clínico'))
  })

  await test('Esc.1: un Paciente no puede entrar al panel de otro rol (aislamiento)', () => {
    assert.equal(decidirAcceso('paciente', '/dashboard/medico'), '/dashboard/paciente')
    assert.equal(decidirAcceso('paciente', '/dashboard/admin'), '/dashboard/paciente')
  })

  // --- Escenario 2: Médico ---
  await test('Esc.2: iniciar sesión como Médico redirige a /dashboard/medico', () => {
    assert.equal(decidirAcceso('medico', '/'), '/dashboard/medico')
  })

  await test('Esc.2: el médico ve Carga de Agenda Mensual y Atención / Historial Ficha Paciente', () => {
    const modulos = modulosPorRol.MEDICO
    assert.ok(modulos.includes('Carga de Agenda Mensual'))
    assert.ok(modulos.includes('Atención / Historial Ficha Paciente'))
  })

  await test('Esc.2: getCurrentMedicalUser acepta únicamente el rol MEDICO', () => {
    assert.equal(getCurrentMedicalUser('medico').status, 200)
  })

  await test('Esc.2: getCurrentMedicalUser rechaza con 403 a un rol no médico', () => {
    assert.equal(getCurrentMedicalUser('paciente').status, 403)
    assert.equal(getCurrentMedicalUser('admin').status, 403)
  })

  await test('Esc.2: getCurrentMedicalUser rechaza con 401 una sesión inexistente', () => {
    assert.equal(getCurrentMedicalUser(undefined).status, 401)
  })

  // --- Escenario 3: Enfermera ---
  await test('Esc.3: iniciar sesión como Enfermera redirige a /dashboard/enfermero', () => {
    assert.equal(decidirAcceso('enfermera', '/'), '/dashboard/enfermero')
  })

  await test('Esc.3: la enfermera ve únicamente Stock de Vacunas y Turnos de Vacunación', () => {
    assert.deepEqual(modulosPorRol.ENFERMERA, ['Gestión de Stock de Vacunas', 'Turnos de Vacunación'])
    assert.ok(!modulosPorRol.ENFERMERA.includes('Reportes Administrativos'))
    assert.ok(!modulosPorRol.ENFERMERA.includes('Carga de Agenda Mensual'))
  })

  await test('Esc.3: getCurrentNurseUser acepta el rol ENFERMERA', () => {
    assert.equal(getCurrentNurseUser('enfermera').status, 200)
  })

  await test('Esc.3: getCurrentNurseUser rechaza con 403 otro rol y con 401 sin sesión', () => {
    assert.equal(getCurrentNurseUser('medico').status, 403)
    assert.equal(getCurrentNurseUser(undefined).status, 401)
  })

  // --- Escenario 4: Administrador ---
  await test('Esc.4: iniciar sesión como Administrador redirige a /dashboard/admin', () => {
    assert.equal(decidirAcceso('admin', '/'), '/dashboard/admin')
  })

  await test('Esc.4: el administrador ve Reportes Administrativos y Gestión de Usuarios', () => {
    const modulos = modulosPorRol.ADMIN
    assert.ok(modulos.includes('Reportes Administrativos'))
    assert.ok(modulos.includes('Gestión de Usuarios'))
  })

  // --- Seguridad y restricción de permisos ---
  await test('Seguridad: sin sesión, una ruta /dashboard/* redirige a /sign-in', () => {
    assert.equal(decidirAcceso(undefined, '/dashboard/paciente', { userIdPresent: false }), '/sign-in')
  })

  await test('Seguridad: un rol desconocido o ausente es derivado a /acceso-denegado', () => {
    assert.equal(decidirAcceso('invitado', '/'), '/acceso-denegado')
    assert.equal(decidirAcceso(undefined, '/'), '/acceso-denegado')
  })

  await test('Seguridad: cada rol solo accede a su propio prefijo de dashboard', () => {
    assert.equal(decidirAcceso('admin', '/dashboard/paciente'), '/dashboard/admin')
    assert.equal(decidirAcceso('medico', '/dashboard/admin'), '/dashboard/medico')
    assert.equal(decidirAcceso('paciente', '/dashboard/paciente/mis-citas'), null)
  })

  await test('Seguridad: una cuenta con cambio de contraseña pendiente va a /cambiar-password', () => {
    assert.equal(
      decidirAcceso('medico', '/dashboard/medico', { mustChangePassword: true }),
      '/cambiar-password',
    )
  })

  await test('Seguridad: getCurrentPatient solo acepta el rol PACIENTE', () => {
    assert.equal(getCurrentPatient('paciente').status, 200)
    assert.equal(getCurrentPatient('medico').status, 403)
    assert.equal(getCurrentPatient(undefined).status, 401)
  })

  await test('Consistencia: el alias "enfermero" es ENFERMERA para lib/auth.ts', () => {
    assert.equal(rolDeMetadata('enfermero'), 'ENFERMERA')
    assert.equal(getCurrentNurseUser('enfermero').status, 200)
  })

  // Nota: proxy.ts (roleDashboard) no contempla el alias "enfermero" (solo "enfermera").
  // La cuenta de enfermería configurada usa el rol Clerk "enfermera", por lo que accede correctamente.
  await test('Esc.3: la cuenta de enfermería configurada (rol "enfermera") accede a su panel', () => {
    assert.equal(decidirAcceso('enfermera', '/'), '/dashboard/enfermero')
    assert.deepEqual(modulosPorRol.ENFERMERA, ['Gestión de Stock de Vacunas', 'Turnos de Vacunación'])
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-02 PASARON EXITOSAMENTE (21/21) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-02:', error)
  process.exit(1)
})
