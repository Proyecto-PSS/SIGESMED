import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// 1. TIPOS (Simulando la sesión de Clerk y la base de datos)
type Rol = 'MEDICO' | 'PACIENTE' | 'ENFERMERA'

interface Usuario {
  id: string
  nombre: string
  rol: Rol
  matricula?: string
}

// 2. LÓGICA DE SERVICIO (Simulando auth.ts y el middleware de protección)
function registrarEnfermera(datos: { id: string; nombre: string; matricula: string }): Usuario {
  // Simula la creación del registro en la tabla Enfermero
  return {
    id: datos.id,
    nombre: datos.nombre,
    rol: 'ENFERMERA',
    matricula: datos.matricula,
  }
}

// Simula la función getCurrentNurseUser() de auth.ts actuando como barrera de seguridad
function verificarAccesoModulo(usuario: Usuario | null, modulo: 'VACUNACION' | 'TURNOS' | 'AGENDA_MEDICA') {
  if (!usuario) {
    throw new Error('No autorizado: sesión no encontrada.')
  }

  // Reglas de acceso para Vacunación y Turnos
  if (modulo === 'VACUNACION' || modulo === 'TURNOS') {
    if (usuario.rol !== 'ENFERMERA') {
      throw new Error('Acceso denegado: se requiere perfil de enfermería.')
    }
    return true // Acceso concedido
  }

  // Reglas de acceso para otros módulos (ejemplo, agenda médica)
  if (modulo === 'AGENDA_MEDICA') {
    if (usuario.rol !== 'MEDICO') {
      throw new Error('Acceso denegado: se requiere perfil médico.')
    }
    return true
  }

  return false
}

// 3. EJECUCIÓN DE LAS PRUEBAS
async function runAllTests() {
  console.log('\n=== US-30: PRUEBAS DE CREACIÓN DE ENFERMERAS Y ACCESO A MÓDULOS ===\n')

  // Usuarios de prueba
  const enfermera = registrarEnfermera({ id: 'enf_001', nombre: 'Carla', matricula: 'MAT-123' })
  const paciente: Usuario = { id: 'pac_001', nombre: 'Juan', rol: 'PACIENTE' }
  const medico: Usuario = { id: 'med_001', nombre: 'Dr. Pérez', rol: 'MEDICO' }

  await test('Esc.1: La creación de una enfermera asigna correctamente el rol "ENFERMERA"', () => {
    assert.equal(enfermera.rol, 'ENFERMERA', 'El sistema debe asignar el rol correcto al registrarse')
    assert.equal(enfermera.matricula, 'MAT-123', 'Debe guardar la matrícula provista')
  })

  await test('Esc.2: Una enfermera tiene acceso concedido al módulo de VACUNACION', () => {
    const acceso = verificarAccesoModulo(enfermera, 'VACUNACION')
    assert.equal(acceso, true, 'El middleware debe permitir el paso')
  })

  await test('Esc.2: Una enfermera tiene acceso concedido al módulo de TURNOS', () => {
    const acceso = verificarAccesoModulo(enfermera, 'TURNOS')
    assert.equal(acceso, true, 'El middleware debe permitir el paso')
  })

  await test('Esc.3: Un Paciente NO puede acceder al módulo de Vacunación (RBAC)', () => {
    let lanzoError = false
    try {
      verificarAccesoModulo(paciente, 'VACUNACION')
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'Acceso denegado: se requiere perfil de enfermería.')
    }
    assert.equal(lanzoError, true, 'Debe rebotar al paciente')
  })

  await test('Esc.3: Un Médico NO puede acceder al módulo de Vacunación (RBAC)', () => {
    let lanzoError = false
    try {
      verificarAccesoModulo(medico, 'VACUNACION')
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'Acceso denegado: se requiere perfil de enfermería.')
    }
    assert.equal(lanzoError, true, 'Debe rebotar al médico')
  })

  await test('Esc.4: Un usuario no autenticado (null) es rebotado por el sistema', () => {
    let lanzoError = false
    try {
      verificarAccesoModulo(null, 'TURNOS')
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'No autorizado: sesión no encontrada.')
    }
    assert.equal(lanzoError, true)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-30 PASARON EXITOSAMENTE ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-30:', error)
  process.exit(1)
})