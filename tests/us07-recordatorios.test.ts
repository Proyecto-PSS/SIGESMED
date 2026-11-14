import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// 1. FUNCIONES A TESTEAR
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function construirPlantillaRecordatorio(datos: any) {
  const asunto = 'Recordatorio de tu turno médico'
  const html = `Hola <strong>${escapeHtml(datos.pacienteNombre)}</strong>, turno con Dr. ${escapeHtml(datos.medicoNombre)} el ${datos.fecha} a las ${datos.hora} hs.`
  return { asunto, html }
}

// 2. MOCKS DE BASE DE DATOS Y SERVICIO DE CORREO
interface TurnoRecordatorio {
  id: string
  pacienteNombre: string
  email: string
  medicoNombre: string
  fecha: string
  hora: string
  estado: 'CONFIRMADO' | 'CANCELADO' | 'REPROGRAMADO'
  recordatorioEnviado: boolean
  intentos: number
}

let dbTurnos: TurnoRecordatorio[] = []
let correosEnviados = 0
let simularCaidaDeRed = false

// Simula la función enviarRecordatorioTurno
async function mockEnviarRecordatorioTurno(email: string) {
  if (simularCaidaDeRed) {
    return { ok: false, error: 'Timeout connection', esErrorTransitorio: true }
  }
  if (!email.includes('@')) {
    return { ok: false, error: 'Email inválido', esErrorTransitorio: false }
  }
  correosEnviados++
  return { ok: true, messageId: 'mock_123', esErrorTransitorio: false }
}

// Simula el "Cron Job" que corre todos los días para buscar turnos de mañana
async function procesarRecordatoriosDiarios() {
  for (const turno of dbTurnos) {
    // A. Regla: Cancelados o Reprogramados NO reciben recordatorio
    if (turno.estado === 'CANCELADO' || turno.estado === 'REPROGRAMADO') continue

    // B. Regla: No duplicados
    if (turno.recordatorioEnviado) continue

    // C. Regla: Límite de reintentos
    if (turno.intentos >= 3) continue

    const resultado = await mockEnviarRecordatorioTurno(turno.email)

    if (resultado.ok) {
      turno.recordatorioEnviado = true
    } else if (resultado.esErrorTransitorio) {
      turno.intentos++ // D. Regla: Reintento ante falla transitoria
    } else {
      turno.intentos = 99 // Falla permanente (ej. mal email)
    }
  }
}

// 3. EJECUCIÓN DE LAS PRUEBAS
async function runAllTests() {
  console.log('\n=== US-07: PRUEBAS DE RECORDATORIOS DE TURNO ===\n')

  await test('Esc.1: Pruebas de contenido del email (Plantilla)', () => {
    const datos = {
      email: 'paciente@test.com',
      pacienteNombre: 'Diego Galan',
      medicoNombre: 'Pérez',
      fecha: '2026-10-26',
      hora: '10:00'
    }
    const plantilla = construirPlantillaRecordatorio(datos)
    
    assert.equal(plantilla.asunto, 'Recordatorio de tu turno médico')
    assert.ok(plantilla.html.includes('Diego Galan'), 'Debe contener el nombre del paciente')
    assert.ok(plantilla.html.includes('Pérez'), 'Debe contener el nombre del médico')
    assert.ok(plantilla.html.includes('2026-10-26'), 'Debe contener la fecha')
  })

  await test('Esc.2: No duplicados (Un turno confirmado solo recibe un correo)', async () => {
    correosEnviados = 0
    dbTurnos = [{
      id: 't1', pacienteNombre: 'Juan', email: 'juan@test.com', medicoNombre: 'Pérez', fecha: '2026-10-26', hora: '10:00',
      estado: 'CONFIRMADO', recordatorioEnviado: false, intentos: 0
    }]

    // Primera pasada del sistema (debería enviar)
    await procesarRecordatoriosDiarios()
    assert.equal(correosEnviados, 1, 'Debe enviar el correo la primera vez')
    assert.equal(dbTurnos[0].recordatorioEnviado, true)

    // Segunda pasada del sistema al día siguiente (NO debería enviar)
    await procesarRecordatoriosDiarios()
    assert.equal(correosEnviados, 1, 'No debe enviar correos duplicados')
  })

  await test('Esc.3: Cancelación y reprogramación de turno (No envía correos a turnos dados de baja)', async () => {
    correosEnviados = 0
    dbTurnos = [
      { id: 't2', pacienteNombre: 'Ana', email: 'ana@test.com', medicoNombre: 'López', fecha: '2026-10-26', hora: '11:00', estado: 'CANCELADO', recordatorioEnviado: false, intentos: 0 },
      { id: 't3', pacienteNombre: 'Sol', email: 'sol@test.com', medicoNombre: 'López', fecha: '2026-10-26', hora: '12:00', estado: 'REPROGRAMADO', recordatorioEnviado: false, intentos: 0 }
    ]

    await procesarRecordatoriosDiarios()
    assert.equal(correosEnviados, 0, 'No se deben enviar recordatorios a turnos cancelados o reprogramados')
  })

  await test('Esc.4: Reintento ante falla (Manejo de errores transitorios)', async () => {
    correosEnviados = 0
    dbTurnos = [{
      id: 't4', pacienteNombre: 'Luis', email: 'luis@test.com', medicoNombre: 'Gómez', fecha: '2026-10-26', hora: '15:00',
      estado: 'CONFIRMADO', recordatorioEnviado: false, intentos: 0
    }]

    simularCaidaDeRed = true // Simulamos que el proveedor de correo se cayó
    await procesarRecordatoriosDiarios()
    
    assert.equal(correosEnviados, 0, 'No pudo enviar por caída de red')
    assert.equal(dbTurnos[0].intentos, 1, 'Debe registrar 1 intento fallido')
    assert.equal(dbTurnos[0].recordatorioEnviado, false)

    simularCaidaDeRed = false // El sistema de correos vuelve a funcionar
    await procesarRecordatoriosDiarios()

    assert.equal(correosEnviados, 1, 'Debe lograr enviarlo en el reintento')
    assert.equal(dbTurnos[0].recordatorioEnviado, true, 'Debe marcarse como enviado tras el reintento exitoso')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-07 PASARON EXITOSAMENTE ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-07:', error)
  process.exit(1)
})