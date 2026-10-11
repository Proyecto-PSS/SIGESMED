import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// 1. ESTRUCTURAS DE DATOS
interface FranjaHoraria {
  fecha: string      // YYYY-MM-DD
  horaInicio: string // HH:mm
}

interface ResultadoModificacion {
  ok: boolean
  mensaje: string
}

// 2. LÓGICA DE VALIDACIÓN (Simulando el cliente y el servicio)
function modificarHorarios(nuevasFranjas: FranjaHoraria[], ahora: Date): ResultadoModificacion {
  // Escenario 2: Validación de límite de días (Máximo 2 días distintos)
  const diasUnicos = new Set(nuevasFranjas.map((f) => f.fecha))
  if (diasUnicos.size > 2) {
    return {
      ok: false,
      mensaje: 'La validación en el lado del cliente deshabilita la selección al marcar más de 2 días a la semana',
    }
  }

  // Escenario 1: Validación de las 48 horas de anticipación
  for (const franja of nuevasFranjas) {
    const fechaFranja = new Date(`${franja.fecha}T${franja.horaInicio}:00Z`)
    const horasDeAnticipacion = (fechaFranja.getTime() - ahora.getTime()) / (1000 * 60 * 60)

    if (horasDeAnticipacion < 48) {
      return {
        ok: false,
        mensaje: 'Error: La franja horaria debe tener al menos 48 horas de anticipación respecto al momento actual',
      }
    }
  }

  // Camino exitoso
  return {
    ok: true,
    mensaje: 'Horarios actualizados.',
  }
}

// 3. EJECUCIÓN DE LAS PRUEBAS
async function runAllTests() {
  console.log('\n=== US-06: PRUEBAS DE MODIFICACIÓN DE HORARIOS ===\n')

  // Congelamos el tiempo simulando que "hoy" es 11 de Octubre de 2026 a las 10:00 AM
  const AHORA = new Date('2026-10-11T10:00:00Z')

  await test('Esc.1: Modificación exitosa con franjas de más de 48 horas de anticipación', () => {
    // Franjas para el 15 y 16 de Octubre (más de 4 días en el futuro)
    const nuevasFranjas: FranjaHoraria[] = [
      { fecha: '2026-10-15', horaInicio: '09:00' },
      { fecha: '2026-10-16', horaInicio: '14:00' },
    ]

    const resultado = modificarHorarios(nuevasFranjas, AHORA)

    assert.equal(resultado.ok, true, 'La acción debe procesarse sin errores')
    assert.equal(resultado.mensaje, 'Horarios actualizados.', 'Debe mostrar el cartel de éxito esperado')
  })

  await test('Esc.1 (Variante): Falla si alguna franja se intenta programar con menos de 48 horas', () => {
    // Franja para el 12 de Octubre a las 10:00 (exactamente 24 horas en el futuro, es inválido)
    const nuevasFranjas: FranjaHoraria[] = [
      { fecha: '2026-10-12', horaInicio: '10:00' },
    ]

    const resultado = modificarHorarios(nuevasFranjas, AHORA)

    assert.equal(resultado.ok, false)
    assert.ok(resultado.mensaje.includes('al menos 48 horas de anticipación'))
  })

  await test('Esc.2: Error de validación al intentar marcar franjas en 3 días distintos', () => {
    // Se seleccionan 3 días diferentes (15, 16 y 17 de Octubre)
    const nuevasFranjas: FranjaHoraria[] = [
      { fecha: '2026-10-15', horaInicio: '09:00' },
      { fecha: '2026-10-16', horaInicio: '10:00' },
      { fecha: '2026-10-17', horaInicio: '11:00' },
    ]

    const resultado = modificarHorarios(nuevasFranjas, AHORA)

    assert.equal(resultado.ok, false, 'No debe permitir guardar la modificación')
    assert.ok(
      resultado.mensaje.includes('más de 2 días a la semana'),
      'Debe coincidir con la validación del lado del cliente descrita en la US'
    )
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-06 PASARON EXITOSAMENTE ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-06:', error)
  process.exit(1)
})