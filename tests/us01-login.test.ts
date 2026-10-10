import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

const EMAIL_REGEX = /^\S+@\S+\.\S+$/

const roleDashboard: Record<string, string> = {
  paciente: '/dashboard/paciente',
  medico: '/dashboard/medico',
  enfermera: '/dashboard/enfermero',
  admin: '/dashboard/admin',
}

const usuariosDePrueba = [
  { email: 'paciente@gmail.com', password: 'SIGESMED', role: 'paciente' },
  { email: 'medico@gmail.com', password: 'SIGESMED1234567', role: 'medico' },
  { email: 'enfermero@gmail.com', password: 'SIGESMED1234567', role: 'enfermera' },
  { email: 'admin@gmail.com', password: 'SIGESMED', role: 'admin' },
]

function validarCredenciales(email: string, password: string) {
  const emailNormalizado = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_REGEX.test(emailNormalizado)) {
    return { ok: false as const, error: 'Ingresá un correo electrónico válido.' }
  }
  if (!password) {
    return { ok: false as const, error: 'Ingresá tu contraseña.' }
  }
  return { ok: true as const, email: emailNormalizado }
}

function iniciarSesion(email: string, password: string) {
  const formato = validarCredenciales(email, password)
  if (!formato.ok) return { ok: false as const, error: formato.error, sesion: null }

  const usuario = usuariosDePrueba.find((u) => u.email === formato.email)
  if (!usuario || usuario.password !== password) {
    return { ok: false as const, error: 'Email o contraseña incorrectos.', sesion: null }
  }

  return { ok: true as const, sesion: { email: usuario.email, role: usuario.role } }
}

function decidirAcceso(role: string | undefined, path: string, mustChangePassword = false) {
  const dashboard = role ? roleDashboard[role] : undefined
  if (mustChangePassword && path !== '/cambiar-password') return '/cambiar-password'
  if (path === '/cambiar-password' && !mustChangePassword) return dashboard || '/acceso-denegado'
  if (path === '/' && dashboard) return dashboard
  if (path === '/' && !dashboard) return '/acceso-denegado'
  return null
}

async function runAllTests() {
  console.log('\n=== US-01: PRUEBAS UNITARIAS DE INICIO DE SESIÓN SEGURO ===\n')

  await test('Escenario 1: acepta un correo electrónico válido con contraseña provista', () => {
    const res = validarCredenciales('paciente@gmail.com', 'SIGESMED')
    assert.equal(res.ok, true)
  })

  await test('Escenario 2: rechaza un correo electrónico con formato inválido', () => {
    const res = validarCredenciales('sin-arroba', 'SIGESMED')
    assert.equal(res.ok, false)
  })

  await test('Rechaza un correo electrónico vacío', () => {
    const res = validarCredenciales('', 'SIGESMED')
    assert.equal(res.ok, false)
  })

  await test('Rechaza un intento sin contraseña', () => {
    const res = validarCredenciales('paciente@gmail.com', '')
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Ingresá tu contraseña.')
  })

  await test('Normaliza el correo electrónico (espacios y mayúsculas) antes de validar', () => {
    const res = validarCredenciales('  PACIENTE@Gmail.com  ', 'SIGESMED')
    if (!res.ok) throw new Error('Se esperaba un correo válido')
    assert.equal(res.email, 'paciente@gmail.com')
  })

  await test('Escenario 1: las credenciales válidas crean una sesión autenticada', () => {
    const res = iniciarSesion('paciente@gmail.com', 'SIGESMED')
    assert.equal(res.ok, true)
    assert.ok(res.sesion)
    assert.equal(res.sesion?.email, 'paciente@gmail.com')
    assert.equal(res.sesion?.role, 'paciente')
  })

  await test('Escenario 1: el ingreso redirige al dashboard correspondiente al rol', () => {
    const res = iniciarSesion('medico@gmail.com', 'SIGESMED1234567')
    assert.equal(res.ok, true)
    assert.equal(decidirAcceso(res.sesion?.role, '/'), '/dashboard/medico')
  })

  await test('Escenario 2: la contraseña incorrecta no habilita el ingreso', () => {
    const res = iniciarSesion('paciente@gmail.com', 'clave-incorrecta')
    assert.equal(res.ok, false)
    assert.equal(res.sesion, null)
    assert.equal(res.error, 'Email o contraseña incorrectos.')
  })

  await test('Escenario 2: un usuario no registrado no habilita el ingreso', () => {
    const res = iniciarSesion('desconocido@gmail.com', 'SIGESMED')
    assert.equal(res.ok, false)
    assert.equal(res.sesion, null)
  })

  await test('Cada rol válido accede a su propio dashboard', () => {
    assert.equal(decidirAcceso('paciente', '/'), '/dashboard/paciente')
    assert.equal(decidirAcceso('medico', '/'), '/dashboard/medico')
    assert.equal(decidirAcceso('enfermera', '/'), '/dashboard/enfermero')
    assert.equal(decidirAcceso('admin', '/'), '/dashboard/admin')
  })

  await test('Un rol desconocido es derivado a acceso denegado', () => {
    assert.equal(decidirAcceso('invitado', '/'), '/acceso-denegado')
    assert.equal(decidirAcceso(undefined, '/'), '/acceso-denegado')
  })

  await test('Una cuenta con cambio de contraseña pendiente es redirigida a cambiar-password', () => {
    assert.equal(decidirAcceso('medico', '/dashboard/medico', true), '/cambiar-password')
  })

  await test('Una cuenta sin cambio pendiente no permanece en cambiar-password', () => {
    assert.equal(decidirAcceso('paciente', '/cambiar-password', false), '/dashboard/paciente')
  })

  await test('Las rutas públicas quedan permitidas sin redirección', () => {
    assert.equal(decidirAcceso('paciente', '/sign-in'), null)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-01 PASARON EXITOSAMENTE (14/14) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-01:', error)
  process.exit(1)
})
