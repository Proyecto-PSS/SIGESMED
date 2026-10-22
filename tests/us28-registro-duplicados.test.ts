import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}


interface Paciente {
  idPaciente: string
  nombre: string
  email: string
  dni: string
}

let dbPacientes: Paciente[] = []

// LÓGICA DEL SERVICIO (Simulando auth.ts)
function procesarRegistroPaciente(clerkUser: { id: string; nombre: string; email: string; dni: string }) {
  // A. Intentar buscar por ID
  let paciente = dbPacientes.find((p) => p.idPaciente === clerkUser.id)

  // B. Si no se encontró por ID, buscar por email para evitar duplicados
  if (!paciente && clerkUser.email) {
    paciente = dbPacientes.find((p) => p.email === clerkUser.email)

    // Si existe con ese email pero tenía otro idPaciente, lo vinculamos (Lógica de auth.ts)
    if (paciente && paciente.idPaciente !== clerkUser.id) {
      paciente.idPaciente = clerkUser.id
    }
  }

  // C. Si el usuario definitivamente no existe, lo creamos validando datos únicos
  if (!paciente) {
    const dniExistente = dbPacientes.find((p) => p.dni === clerkUser.dni)
    
    if (dniExistente) {
      throw new Error('Validación fallida: El DNI ingresado ya se encuentra registrado para otro usuario.')
    }

    paciente = {
      idPaciente: clerkUser.id,
      nombre: clerkUser.nombre,
      email: clerkUser.email,
      dni: clerkUser.dni,
    }
    dbPacientes.push(paciente)
  }

  return paciente
}

// PRUEBAS
async function runAllTests() {
  console.log('\n=== US-28: PRUEBAS DE REGISTRO Y VALIDACIÓN DE DUPLICADOS ===\n')

  // Reiniciamos la base de datos falsa antes de empezar
  dbPacientes = [
    {
      idPaciente: 'user_viejo_123',
      nombre: 'Carlos',
      email: 'carlos@ejemplo.com',
      dni: '11111111',
    }
  ]

  await test('Esc.1: Registro de un usuario completamente nuevo funciona correctamente', () => {
    const nuevoUser = {
      id: 'user_nuevo_456',
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      dni: '22222222'
    }
    
    const resultado = procesarRegistroPaciente(nuevoUser)
    
    assert.equal(resultado.idPaciente, 'user_nuevo_456')
    assert.equal(dbPacientes.length, 2, 'El paciente debe haberse guardado en la base de datos')
  })

  await test('Esc.2: Intento con Email duplicado vincula la cuenta automáticamente (sin error)', () => {
    // Simulamos que Carlos inicia sesión con otro proveedor (ej. Google) generando un nuevo ID de Clerk,
    // pero usando su mismo email de siempre.
    const userMismoEmail = {
      id: 'user_google_789',
      nombre: 'Carlos',
      email: 'carlos@ejemplo.com',
      dni: '11111111'
    }
    
    const resultado = procesarRegistroPaciente(userMismoEmail)
    
    assert.equal(
      resultado.idPaciente, 
      'user_google_789', 
      'El sistema debe haber actualizado el ID del paciente existente'
    )
    assert.equal(
      dbPacientes.length, 
      2, 
      'No se debe crear un registro nuevo, se reutiliza el existente'
    )
  })

  await test('Esc.3: Intento con DNI duplicado lanza error de validación impidiendo el registro', () => {
    // Alguien intenta registrarse con un email nuevo, pero usando el DNI de Ana (22222222)
    const userRobandoDni = {
      id: 'user_falso_999',
      nombre: 'Pedro',
      email: 'pedro@ejemplo.com',
      dni: '22222222' // DNI ya existente
    }
    
    let lanzoError = false
    try {
      procesarRegistroPaciente(userRobandoDni)
    } catch (error: any) {
      lanzoError = true
      assert.ok(error.message.includes('El DNI ingresado ya se encuentra registrado'))
    }
    
    assert.equal(lanzoError, true, 'Debería haber lanzado el error de validación por DNI duplicado')
    assert.equal(dbPacientes.length, 2, 'La base de datos no debe haber sumado al usuario inválido')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-28 PASARON EXITOSAMENTE ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-28:', error)
  process.exit(1)
})