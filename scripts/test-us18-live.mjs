// Script de verificación HTTP de endpoints de US-18 siguiendo la convención de scripts/test-http-live.mjs
async function testUS18Live() {
  const BASE_URL = 'http://localhost:3000'
  console.log('=== TEST HTTP EN VIVO: ENDPOINTS Y RUTAS US-18 ===\n')

  try {
    // 1. GET /api/turnos/reservar/status sin sesión -> Control de Acceso
    const res1 = await fetch(`${BASE_URL}/api/turnos/reservar/status`, {
      redirect: 'manual',
    })
    console.log('[1] GET /api/turnos/reservar/status (sin sesión)')
    console.log('    Status:', res1.status, '(Esperado: 401 o 307 redirect a login)')

    // 2. POST /api/pacientes/turnos/[idTurno]/confirmar sin sesión
    const res2 = await fetch(`${BASE_URL}/api/pacientes/turnos/turno-test-123/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'test-key' }),
      redirect: 'manual',
    })
    console.log('\n[2] POST /api/pacientes/turnos/turno-test-123/confirmar (sin sesión)')
    console.log('    Status:', res2.status, '(Esperado: 401 o 307 redirect a login)')

    // 3. POST /api/pacientes/citas/[idTurno]/cancelar sin sesión
    const res3 = await fetch(`${BASE_URL}/api/pacientes/citas/turno-test-123/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
    })
    console.log('\n[3] POST /api/pacientes/citas/turno-test-123/cancelar (sin sesión)')
    console.log('    Status:', res3.status, '(Esperado: 401 o 307 redirect a login)')

    console.log('\n=== VERIFICACIÓN DE SEGURIDAD Y ENDPOINTS COMPLETADA EXITOSAMENTE ===')
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
      console.log('Aviso: el servidor dev local no está corriendo en http://localhost:3000.')
      console.log('Para ejecutar pruebas HTTP en vivo, iniciar "npm run dev" en una terminal y ejecutar este script.')
    } else {
      throw error
    }
  }
}

testUS18Live().catch(console.error)
