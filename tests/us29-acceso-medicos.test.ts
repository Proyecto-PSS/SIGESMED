import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// 1. TIPOS (Simulando la base de datos y la sesión)
type Rol = 'MEDICO' | 'PACIENTE' | 'ENFERMERA' | 'ADMIN'

interface Usuario {
  id: string
  nombre: string
  rol: Rol
  especialidad?: string
  matricula?: string
}

// 2. LÓGICA DE SERVICIO (Simulando alta administrativa y middleware)
function registrarMedico(datos: { id: string; nombre: string; matricula: string; especialidad: string }): Usuario {
  // Simula la creación estricta de un perfil médico en la base de datos
  return {
    id: datos.id,
    nombre: datos.nombre,
    rol: 'MEDICO',
    matricula: datos.matricula,
    especialidad: datos.especialidad,
  }
}

// Simula la función getCurrentMedicalUser() de auth.ts
function verificarAccesoMedico(usuario: Usuario | null) {
  if (!usuario) {
    throw new Error('No autorizado: sesión no encontrada o perfil inexistente.')
  }

  if (usuario.rol !== 'MEDICO') {
    throw new Error('Acceso denegado: se requiere perfil médico.')
  }

  return true // Acceso concedido a módulos como "Mi Agenda" o "Mis Turnos"
}

// 3. EJECUCIÓN DE LAS PRUEBAS
async function runAllTests() {
  console.log('\n=== US-29: PRUEBAS DE ALTA DE MÉDICOS Y RESTRICCIONES DE SEGURIDAD ===\n')

  // Mocks de usuarios
  const medico = registrarMedico({ 
    id: 'med_001', 
    nombre: 'Dr. Roberto', 
    matricula: 'MN-445566', 
    especialidad: 'Cardiología' 
  })
  
  const paciente: Usuario = { id: 'pac_001', nombre: 'Carlos', rol: 'PACIENTE' }
  const enfermera: Usuario = { id: 'enf_001', nombre: 'Ana', rol: 'ENFERMERA' }

  await test('Esc.1: El alta de un médico asigna correctamente el rol "MEDICO", especialidad y matrícula', () => {
    assert.equal(medico.rol, 'MEDICO')
    assert.equal(medico.especialidad, 'Cardiología')
    assert.equal(medico.matricula, 'MN-445566')
  })

  await test('Esc.2: Un usuario con rol MEDICO tiene acceso concedido a las funciones de su perfil', () => {
    const acceso = verificarAccesoMedico(medico)
    assert.equal(acceso, true, 'El middleware debe permitir el paso al médico')
  })

  await test('Esc.3: Un PACIENTE intentando acceder a funciones de médico es rechazado por seguridad', () => {
    let lanzoError = false
    try {
      verificarAccesoMedico(paciente)
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'Acceso denegado: se requiere perfil médico.')
    }
    assert.equal(lanzoError, true, 'Debe rebotar al paciente con un error 403')
  })

  await test('Esc.4: Una ENFERMERA intentando acceder a funciones de médico es rechazada', () => {
    let lanzoError = false
    try {
      verificarAccesoMedico(enfermera)
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'Acceso denegado: se requiere perfil médico.')
    }
    assert.equal(lanzoError, true, 'Debe rebotar a la enfermera')
  })

  await test('Esc.5: Un intento de acceso sin estar autenticado (null) es rebotado inmediatamente', () => {
    let lanzoError = false
    try {
      verificarAccesoMedico(null)
    } catch (error: any) {
      lanzoError = true
      assert.equal(error.message, 'No autorizado: sesión no encontrada o perfil inexistente.')
    }
    assert.equal(lanzoError, true, 'Debe lanzar un error 401')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-29 PASARON EXITOSAMENTE ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-29:', error)
  process.exit(1)
})