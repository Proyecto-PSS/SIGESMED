// Suite complementaria de pruebas unitarias para US-38 (v2):
// Validación estricta de bordes, seguridad de payload, formateo horario Argentina y búsqueda real.
import assert from 'node:assert/strict'
import {
  TIPOS_DIAGNOSTICO_VALIDOS,
  ETIQUETAS_TIPO_DIAGNOSTICO,
  OPCIONES_TIPO_DIAGNOSTICO,
  HistoriaClinicaError,
  validarCargaAtencionMedica,
  construirMensajeExitoAtencion,
  formatearFechaHoraAtencionArgentina,
  filtrarPacientesPorTermino,
} from '../lib/utils/historia-clinica-utils.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

async function runAllTests() {
  console.log('\n=== US-38 (v2): PRUEBAS DE BORDES, VALIDACIÓN REAL Y FORMATEO ===\n')

  // --------------------------------------------------------------------------
  // 1. Validación estructural del payload
  // --------------------------------------------------------------------------
  await test('Esc.1: Rechaza payloads malformados (null, undefined, primitivos o arrays) con 400', () => {
    for (const payloadInvalido of [null, undefined, 'texto', 123, true, []]) {
      assert.throws(
        () => validarCargaAtencionMedica(payloadInvalido),
        (err: unknown) =>
          err instanceof HistoriaClinicaError &&
          err.statusCode === 400 &&
          err.message.includes('no son válidos')
      )
    }
  })

  // --------------------------------------------------------------------------
  // 2. Límites de longitud del diagnóstico principal (2000 caracteres)
  // --------------------------------------------------------------------------
  await test('Esc.2: Respeta el límite exacto de 2000 caracteres en diagnóstico principal (después de trim)', () => {
    const exacto2000 = 'a'.repeat(2000)
    const conEspacios = `   ${exacto2000}   `
    const validado = validarCargaAtencionMedica({
      diagnosticoPrincipal: conEspacios,
      tipoDiagnostico: 'DEFINITIVO',
    })
    assert.equal(validado.diagnosticoPrincipal.length, 2000)

    const excedido2001 = 'a'.repeat(2001)
    assert.throws(
      () =>
        validarCargaAtencionMedica({
          diagnosticoPrincipal: excedido2001,
          tipoDiagnostico: 'DEFINITIVO',
        }),
      (err: unknown) =>
        err instanceof HistoriaClinicaError &&
        err.statusCode === 400 &&
        err.message.includes('2000')
    )
  })

  // --------------------------------------------------------------------------
  // 3. Validación de tipos y longitudes (5000 caracteres) en campos opcionales
  // --------------------------------------------------------------------------
  await test('Esc.3: Rechaza tipos no string en campos opcionales (números, objetos, arrays, booleanos)', () => {
    const camposOpcionales = [
      'observacionesClinicas',
      'detalleTratamiento',
      'indicacionesFarmacologicas',
    ] as const

    for (const campo of camposOpcionales) {
      for (const valorInvalido of [123, true, {}, ['dato']]) {
        assert.throws(
          () =>
            validarCargaAtencionMedica({
              diagnosticoPrincipal: 'Cefalea tensional',
              tipoDiagnostico: 'PRESUNTIVO',
              [campo]: valorInvalido,
            }),
          (err: unknown) =>
            err instanceof HistoriaClinicaError &&
            err.statusCode === 400 &&
            err.message.includes('cadena de texto válida')
        )
      }
    }
  })

  await test('Esc.4: Respeta límite de 5000 caracteres y normaliza espacios en campos opcionales', () => {
    const texto5000 = 'b'.repeat(5000)
    const ok = validarCargaAtencionMedica({
      diagnosticoPrincipal: '  Control postoperatorio  ',
      tipoDiagnostico: 'EN_ESTUDIO',
      observacionesClinicas: `  ${texto5000}  `,
      detalleTratamiento: '  Curación diaria con clorhexidina  ',
      indicacionesFarmacologicas: '   \n\t  ',
    })

    assert.equal(ok.diagnosticoPrincipal, 'Control postoperatorio')
    assert.equal(ok.observacionesClinicas?.length, 5000)
    assert.equal(ok.detalleTratamiento, 'Curación diaria con clorhexidina')
    assert.equal(ok.indicacionesFarmacologicas, null)

    const texto5001 = 'c'.repeat(5001)
    for (const campo of ['observacionesClinicas', 'detalleTratamiento', 'indicacionesFarmacologicas']) {
      assert.throws(
        () =>
          validarCargaAtencionMedica({
            diagnosticoPrincipal: 'Control postoperatorio',
            tipoDiagnostico: 'DEFINITIVO',
            [campo]: texto5001,
          }),
        (err: unknown) =>
          err instanceof HistoriaClinicaError &&
          err.statusCode === 400 &&
          err.message.includes('5000')
      )
    }
  })

  // --------------------------------------------------------------------------
  // 4. Protección contra mass assignment (stripping real de campos externos)
  // --------------------------------------------------------------------------
  await test('Esc.5: validarCargaAtencionMedica descarta cualquier campo externo inyectado (idMedico, idPaciente, createdAt)', () => {
    const validado = validarCargaAtencionMedica({
      idAtencion: 'atn_falsa',
      idMedico: 'med_suplantado',
      idPaciente: 'pac_suplantado',
      createdAt: '2020-01-01T00:00:00.000Z',
      diagnosticoPrincipal: 'Otitis media aguda',
      tipoDiagnostico: 'DEFINITIVO',
    })

    const claves = Object.keys(validado).sort()
    assert.deepEqual(claves, [
      'detalleTratamiento',
      'diagnosticoPrincipal',
      'indicacionesFarmacologicas',
      'observacionesClinicas',
      'tipoDiagnostico',
    ])
    assert.equal('idMedico' in validado, false)
    assert.equal('idPaciente' in validado, false)
    assert.equal('createdAt' in validado, false)
  })

  // --------------------------------------------------------------------------
  // 5. Tabla de verdad completa de construirMensajeExitoAtencion
  // --------------------------------------------------------------------------
  await test('Esc.6: construirMensajeExitoAtencion cubre los 4 casos de tratamiento/indicaciones', () => {
    const msgConTratamiento =
      'Diagnóstico y tratamiento guardados exitosamente en la historia clínica del paciente'
    const msgSinTratamiento = 'Registro clínico guardado exitosamente.'

    assert.equal(
      construirMensajeExitoAtencion({ detalleTratamiento: null, indicacionesFarmacologicas: null }),
      msgSinTratamiento
    )
    assert.equal(
      construirMensajeExitoAtencion({ detalleTratamiento: 'Reposo', indicacionesFarmacologicas: null }),
      msgConTratamiento
    )
    assert.equal(
      construirMensajeExitoAtencion({ detalleTratamiento: null, indicacionesFarmacologicas: 'Amoxicilina 500mg' }),
      msgConTratamiento
    )
    assert.equal(
      construirMensajeExitoAtencion({
        detalleTratamiento: 'Reposo',
        indicacionesFarmacologicas: 'Amoxicilina 500mg',
      }),
      msgConTratamiento
    )
  })

  // --------------------------------------------------------------------------
  // 6. Formateo determinista de fecha/hora en Argentina (UTC-3)
  // --------------------------------------------------------------------------
  await test('Esc.7: formatearFechaHoraAtencionArgentina maneja UTC-3, cambio de día, medianoche 00:00 y fechas inválidas', () => {
    // 01:30 UTC del día 16 equivale a 22:30 hs del día 15 en Argentina (cambio de día)
    assert.equal(
      formatearFechaHoraAtencionArgentina(new Date('2026-11-16T01:30:00.000Z')),
      '15 de noviembre de 2026 · 22:30 hs'
    )

    // 03:00 UTC equivale a medianoche 00:00 hs en Argentina (valida conversión de '24' -> '00')
    assert.equal(
      formatearFechaHoraAtencionArgentina('2026-11-16T03:00:00.000Z'),
      '16 de noviembre de 2026 · 00:00 hs'
    )

    // Fecha regular con día y minuto de un dígito (padding con cero)
    assert.equal(
      formatearFechaHoraAtencionArgentina('2026-01-05T15:05:00.000Z'),
      '05 de enero de 2026 · 12:05 hs'
    )

    // Entradas inválidas no arrojan excepciones
    assert.equal(formatearFechaHoraAtencionArgentina('fecha-invalida'), 'fecha-invalida')
    assert.equal(formatearFechaHoraAtencionArgentina(new Date('invalid')), '')
  })

  // --------------------------------------------------------------------------
  // 7. Buscador multi-término de pacientes (orden invertido, email, obra social y nulls)
  // --------------------------------------------------------------------------
  await test('Esc.8: filtrarPacientesPorTermino soporta orden invertido, obra social, email, tildes y no muta el arreglo', () => {
    const pacientes = [
      {
        nombre: 'Sofía',
        apellido: 'Peña',
        dni: '38111222',
        email: 'sofia.p@correo.com',
        obraSocial: 'OSDE 210',
      },
      {
        nombre: 'Tomás',
        apellido: 'Gutiérrez',
        dni: '40333444',
        email: 'tomas@clinica.ar',
        obraSocial: null,
      },
    ]

    const todos = filtrarPacientesPorTermino(pacientes, '   ')
    assert.equal(todos.length, 2)
    assert.notEqual(todos, pacientes, 'No debe devolver la misma referencia del arreglo original')

    // Orden apellido + nombre con y sin tildes
    assert.equal(filtrarPacientesPorTermino(pacientes, 'Pena Sofia').length, 1)
    assert.equal(filtrarPacientesPorTermino(pacientes, 'gutiérrez tomás').length, 1)

    // Búsqueda por obra social y email
    assert.equal(filtrarPacientesPorTermino(pacientes, 'osde 210').length, 1)
    assert.equal(filtrarPacientesPorTermino(pacientes, 'tomas@clinica.ar').length, 1)

    // Combinación de nombre + obra social inexistente en ese paciente
    assert.equal(filtrarPacientesPorTermino(pacientes, 'tomas osde').length, 0)
  })

  // --------------------------------------------------------------------------
  // 8. Consistencia del catálogo de tipos de diagnóstico
  // --------------------------------------------------------------------------
  await test('Esc.9: TIPOS_DIAGNOSTICO_VALIDOS, etiquetas y opciones del selector están sincronizados', () => {
    assert.equal(OPCIONES_TIPO_DIAGNOSTICO.length, TIPOS_DIAGNOSTICO_VALIDOS.length)
    for (const tipo of TIPOS_DIAGNOSTICO_VALIDOS) {
      assert.ok(ETIQUETAS_TIPO_DIAGNOSTICO[tipo], `Falta etiqueta para ${tipo}`)
      const opcion = OPCIONES_TIPO_DIAGNOSTICO.find((o) => o.value === tipo)
      assert.ok(opcion, `Falta opción en selector para ${tipo}`)
      assert.equal(opcion.label, ETIQUETAS_TIPO_DIAGNOSTICO[tipo])
    }
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-38 (v2) PASARON EXITOSAMENTE (9/9) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-38 (v2):', err)
  process.exit(1)
})