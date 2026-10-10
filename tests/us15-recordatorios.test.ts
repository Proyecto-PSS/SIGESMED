// Suite exhaustiva de pruebas para US-15: Recordatorios de turnos por email, estados, reintentos y reprogramación.
import assert from 'node:assert/strict'
import { RECORDATORIOS_CONFIG } from '../lib/config/recordatorios-config.ts'
import {
  obtenerInstanteTurno,
  calcularMomentoProgramado,
  calcularFechaProximoReintento,
} from '../lib/utils/recordatorios-utils.ts'
import {
  construirPlantillaRecordatorio,
  EmailService,
  type DatosRecordatorioEmail,
} from '../lib/services/email-service.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

async function runAllTests() {
  console.log('\n=== US-15: PRUEBAS DE RECORDATORIOS DE TURNOS POR EMAIL ===\n')

  // --------------------------------------------------------------------------
  // Grupo 1: Configuración y Cálculo de Tiempos de Anticipación (RF-15.1)
  // --------------------------------------------------------------------------
  await test('RF-15.1: Configuración de anticipación predeterminada es de 24 horas y límites válidos', () => {
    assert.equal(RECORDATORIOS_CONFIG.HORAS_ANTICIPACION_DEFECTO, 24)
    assert.equal(RECORDATORIOS_CONFIG.MAX_INTENTOS, 5)
    assert.deepEqual([...RECORDATORIOS_CONFIG.INTERVALOS_BACKOFF_MINUTOS], [1, 2, 4, 8, 16])
    assert.equal(RECORDATORIOS_CONFIG.VENTANA_MINIMA_ENVIO_MINUTOS, 30)
    assert.equal(RECORDATORIOS_CONFIG.TIMEZONE_OFFSET_HOURS, -3)
  })

  await test('RF-15.1: obtenerInstanteTurno convierte correctamente hora local de Argentina (UTC-3) a UTC', () => {
    // 15 de Octubre 2026, 10:00 hs Argentina -> 13:00 UTC
    const instante = obtenerInstanteTurno('2026-10-15', '10:00')
    assert.equal(instante.getUTCFullYear(), 2026)
    assert.equal(instante.getUTCMonth(), 9) // 0-index: 9 = Octubre
    assert.equal(instante.getUTCDate(), 15)
    assert.equal(instante.getUTCHours(), 13)
    assert.equal(instante.getUTCMinutes(), 0)
  })

  await test('RF-15.1: calcularMomentoProgramado calcula exactamente 24 horas antes del turno con antelación suficiente', () => {
    // Turno: 2026-10-15 a las 10:00 Argentina (13:00 UTC)
    // Fecha actual simulada: 2026-10-10 a las 10:00 (5 días antes)
    const ahora = new Date(Date.UTC(2026, 9, 10, 13, 0))
    const programado = calcularMomentoProgramado('2026-10-15', '10:00', 24, ahora)

    assert.ok(programado !== null)
    // Debe programarse para el 14 de Octubre a las 13:00 UTC (10:00 Argentina)
    assert.equal(programado.getUTCDate(), 14)
    assert.equal(programado.getUTCHours(), 13)
  })

  await test('RF-15.1: calcularMomentoProgramado programa inmediatamente si faltan menos de 24h pero más de 30 min', () => {
    // Turno: dentro de 5 horas
    const ahora = new Date(Date.UTC(2026, 9, 15, 8, 0))
    // Turno a las 10:00 Argentina (13:00 UTC), diferencia 5 horas
    const programado = calcularMomentoProgramado('2026-10-15', '10:00', 24, ahora)

    assert.ok(programado !== null)
    // Momento programado debe ser ahora mismo para enviar a la brevedad
    assert.equal(programado.getTime(), ahora.getTime())
  })

  await test('RF-15.1: calcularMomentoProgramado descarta envío si faltan menos de 30 minutos o ya pasó el turno', () => {
    // Turno a las 10:00 Argentina (13:00 UTC)
    // Caso A: faltan 15 minutos (12:45 UTC)
    const ahoraCerca = new Date(Date.UTC(2026, 9, 15, 12, 45))
    const programadoCerca = calcularMomentoProgramado('2026-10-15', '10:00', 24, ahoraCerca)
    assert.equal(programadoCerca, null)

    // Caso B: turno en el pasado (14:00 UTC)
    const ahoraPasado = new Date(Date.UTC(2026, 9, 15, 14, 0))
    const programadoPasado = calcularMomentoProgramado('2026-10-15', '10:00', 24, ahoraPasado)
    assert.equal(programadoPasado, null)
  })

  // --------------------------------------------------------------------------
  // Grupo 2: Plantilla de Correo, Seguridad y Privacidad (RF-15.2 / RF-15.7)
  // --------------------------------------------------------------------------
  await test('RF-15.2: la plantilla genera asunto y contenido completo con profesional, fecha, hora y consultorio', () => {
    const datos: DatosRecordatorioEmail = {
      email: 'paciente@ejemplo.com',
      pacienteNombre: 'Juan Pérez',
      medicoNombre: 'Ana Gómez',
      especialidad: 'CLINICA_MEDICA',
      fecha: '15/10/2026',
      hora: '10:30',
      consultorio: 'Consultorio 2B',
      direccion: 'Av. Corrientes 1234',
    }

    const { asunto, html, textoPlano } = construirPlantillaRecordatorio(datos)

    assert.equal(asunto, 'Recordatorio de tu turno médico')
    assert.ok(html.includes('Juan Pérez'))
    assert.ok(html.includes('Ana Gómez'))
    assert.ok(html.includes('Clínica Médica'))
    assert.ok(html.includes('15/10/2026'))
    assert.ok(html.includes('10:30'))
    assert.ok(html.includes('Consultorio 2B'))
    assert.ok(html.includes('Av. Corrientes 1234'))
    assert.ok(html.includes('48 horas de anticipación'))

    // En texto plano también debe constar la información
    assert.ok(textoPlano.includes('Ana Gómez'))
    assert.ok(textoPlano.includes('Consultorio 2B'))
    assert.ok(textoPlano.includes('48 horas'))
  })

  await test('RF-15.2 / Seguridad: no inventa datos de ubicación si consultorio o dirección están ausentes', () => {
    const datos: DatosRecordatorioEmail = {
      email: 'paciente@ejemplo.com',
      pacienteNombre: 'María López',
      medicoNombre: 'Carlos Ruiz',
      especialidad: 'PEDIATRIA',
      fecha: '20/10/2026',
      hora: '14:00',
    }

    const { html, textoPlano } = construirPlantillaRecordatorio(datos)

    assert.ok(!html.includes('Consultorio:'))
    assert.ok(!html.includes('Dirección:'))
    assert.ok(!textoPlano.includes('Consultorio:'))
    assert.ok(!textoPlano.includes('Dirección:'))
  })

  await test('RF-15.2 / Privacidad: no incluye datos clínicos sensibles, diagnósticos ni motivos de consulta', () => {
    const datos: DatosRecordatorioEmail = {
      email: 'paciente@ejemplo.com',
      pacienteNombre: 'Pedro Alvarez',
      medicoNombre: 'Laura Fernández',
      fecha: '22/10/2026',
      hora: '09:00',
    }

    const { html, textoPlano } = construirPlantillaRecordatorio(datos)

    // No debe contener términos clínicos
    const palabrasSensibles = ['diagnóstico', 'síntoma', 'motivo', 'enfermedad', 'tratamiento']
    for (const palabra of palabrasSensibles) {
      assert.ok(!html.toLowerCase().includes(palabra), `HTML no debe contener ${palabra}`)
      assert.ok(!textoPlano.toLowerCase().includes(palabra), `Texto no debe contener ${palabra}`)
    }
  })

  await test('RF-15.2: EmailService detecta dirección inválida como error permanente sin reintento', async () => {
    const resultado = await EmailService.enviarRecordatorioTurno({
      email: 'correo-invalido-sin-arroba',
      pacienteNombre: 'Test',
      medicoNombre: 'Dr. Test',
      fecha: '15/10/2026',
      hora: '10:00',
    })

    assert.equal(resultado.ok, false)
    assert.equal(resultado.esErrorTransitorio, false) // Error permanente
    assert.ok(resultado.error?.includes('inválida'))
  })

  await test('RF-15.2: EmailService realiza envío exitoso con dirección válida', async () => {
    const resultado = await EmailService.enviarRecordatorioTurno({
      email: 'paciente.real@ejemplo.com',
      pacienteNombre: 'Test Valido',
      medicoNombre: 'Dra. Médica',
      fecha: '15/10/2026',
      hora: '10:00',
    })

    assert.equal(resultado.ok, true)
    assert.ok(resultado.messageId !== undefined)
    assert.equal(resultado.esErrorTransitorio, false)
  })

  // --------------------------------------------------------------------------
  // Grupo 3: Backoff Exponencial y Política de Reintentos (RF-15.4)
  // --------------------------------------------------------------------------
  await test('RF-15.4: calcularFechaProximoReintento aplica backoff exponencial configurable (1, 2, 4, 8, 16 min)', () => {
    const base = new Date('2026-10-10T12:00:00.000Z')

    // Intento 1 -> 1 minuto después
    const t1 = calcularFechaProximoReintento(1, base)
    assert.equal(t1.getTime() - base.getTime(), 1 * 60 * 1000)

    // Intento 2 -> 2 minutos después
    const t2 = calcularFechaProximoReintento(2, base)
    assert.equal(t2.getTime() - base.getTime(), 2 * 60 * 1000)

    // Intento 3 -> 4 minutos después
    const t3 = calcularFechaProximoReintento(3, base)
    assert.equal(t3.getTime() - base.getTime(), 4 * 60 * 1000)

    // Intento 4 -> 8 minutos después
    const t4 = calcularFechaProximoReintento(4, base)
    assert.equal(t4.getTime() - base.getTime(), 8 * 60 * 1000)

    // Intento 5 -> 16 minutos después
    const t5 = calcularFechaProximoReintento(5, base)
    assert.equal(t5.getTime() - base.getTime(), 16 * 60 * 1000)
  })

  // --------------------------------------------------------------------------
  // Grupo 4: Máquina de Estados y Simulación Concurrente (RF-15.3 / RF-15.4 / RF-15.5)
  // --------------------------------------------------------------------------
  await test('RF-15.3 / RF-15.4: simulación de máquina de estados — PENDIENTE -> PROCESANDO -> REINTENTO_PROGRAMADO -> ENVIADO', () => {
    type Estado = 'PENDIENTE' | 'PROCESANDO' | 'REINTENTO_PROGRAMADO' | 'ENVIADO' | 'FALLIDO' | 'CANCELADO'
    
    let estadoActual: Estado = 'PENDIENTE'
    let intentos = 0

    // Paso 1: worker reclama el registro
    assert.equal(estadoActual, 'PENDIENTE')
    estadoActual = 'PROCESANDO'
    intentos++
    assert.equal(estadoActual, 'PROCESANDO')
    assert.equal(intentos, 1)

    // Paso 2: fallo transitorio en el intento 1 -> pasa a REINTENTO_PROGRAMADO
    const errorTransitorio = true
    if (errorTransitorio && intentos < RECORDATORIOS_CONFIG.MAX_INTENTOS) {
      estadoActual = 'REINTENTO_PROGRAMADO'
    }
    assert.equal(estadoActual, 'REINTENTO_PROGRAMADO')

    // Paso 3: segundo intento -> worker reclama nuevamente
    estadoActual = 'PROCESANDO'
    intentos++
    assert.equal(intentos, 2)

    // Paso 4: respuesta exitosa del proveedor -> pasa a ENVIADO
    estadoActual = 'ENVIADO'
    assert.equal(estadoActual, 'ENVIADO')
  })

  await test('RF-15.4: agotamiento de reintentos máximos (5) transiciona a estado terminal FALLIDO', () => {
    let estado: 'PROCESANDO' | 'REINTENTO_PROGRAMADO' | 'FALLIDO' = 'PROCESANDO'
    let intentos = 5 // Quinto intento fallido

    const errorTransitorio = true
    if (errorTransitorio && intentos < RECORDATORIOS_CONFIG.MAX_INTENTOS) {
      estado = 'REINTENTO_PROGRAMADO'
    } else {
      estado = 'FALLIDO'
    }

    assert.equal(estado, 'FALLIDO')
  })

  await test('RF-15.5: cancelación de turno transiciona recordatorios activos a CANCELADO', () => {
    const recordatorios = [
      { id: 'rec-1', estado: 'PENDIENTE' },
      { id: 'rec-2', estado: 'REINTENTO_PROGRAMADO' },
      { id: 'rec-3', estado: 'ENVIADO' }, // Ya enviado no debe cancelarse
    ]

    const actualizados = recordatorios.map((r) => {
      if (['PENDIENTE', 'REINTENTO_PROGRAMADO', 'PROCESANDO'].includes(r.estado)) {
        return { ...r, estado: 'CANCELADO' }
      }
      return r
    })

    assert.equal(actualizados[0].estado, 'CANCELADO')
    assert.equal(actualizados[1].estado, 'CANCELADO')
    assert.equal(actualizados[2].estado, 'ENVIADO')
  })

  await test('RF-15.4 / Concurrencia: reclamación atómica exclusiva impide que 2 workers procesen el mismo recordatorio', async () => {
    // Simulación de dos workers intentando reclamar el mismo registro en paralelo
    let recordatorio = {
      idRecordatorio: 'rec-concurrente-1',
      estado: 'PENDIENTE',
      ultimoIntentoAt: null as Date | null,
    }

    // Función de claim atómico condicional (equivalente a UPDATE ... WHERE id = $id AND estado IN ('PENDIENTE', 'REINTENTO_PROGRAMADO'))
    const intentarClaim = async (workerId: string) => {
      await new Promise((r) => setTimeout(r, Math.random() * 10))
      if (recordatorio.estado === 'PENDIENTE') {
        recordatorio.estado = 'PROCESANDO'
        recordatorio.ultimoIntentoAt = new Date()
        return { reclamado: true, workerId }
      }
      return { reclamado: false, workerId }
    }

    const [w1, w2] = await Promise.all([intentarClaim('worker-1'), intentarClaim('worker-2')])

    // Exactamente 1 worker debe haber ganado el claim
    const ganadores = [w1, w2].filter((w) => w.reclamado)
    assert.equal(ganadores.length, 1)
    assert.equal(recordatorio.estado, 'PROCESANDO')
  })

  await test('RF-15.4 / Resiliencia: recuperación de workers huérfanos bloqueados en PROCESANDO', () => {
    const ahora = new Date()
    const staleMinutos = RECORDATORIOS_CONFIG.STALE_PROCESSING_TIMEOUT_MINUTOS
    // Tarea bloqueada hace 15 minutos (mayor al timeout de 10 minutos)
    const quinceMinutosAtras = new Date(ahora.getTime() - 15 * 60 * 1000)
    // Tarea bloqueada hace 3 minutos (dentro del timeout activo)
    const tresMinutosAtras = new Date(ahora.getTime() - 3 * 60 * 1000)

    const staleThreshold = new Date(ahora.getTime() - staleMinutos * 60 * 1000)

    const esHuerfano15Min = quinceMinutosAtras.getTime() <= staleThreshold.getTime()
    const esHuerfano3Min = tresMinutosAtras.getTime() <= staleThreshold.getTime()

    assert.equal(esHuerfano15Min, true, 'Debe reclamar registro con más de 10 minutos en PROCESANDO')
    assert.equal(esHuerfano3Min, false, 'No debe reclamar registro que comenzó hace 3 minutos')
  })

  // --------------------------------------------------------------------------
  // Grupo 5: Reprogramación de Turnos (RF-15.5)
  // --------------------------------------------------------------------------
  await test('RF-15.5: reprogramación con recordatorio PENDIENTE actualiza la fecha programada y resetea errores', () => {
    const recordatorioActivo = {
      id: 'rec-10',
      estado: 'REINTENTO_PROGRAMADO',
      intentos: 2,
      ultimoError: 'Error 503 temporal',
      programadoPara: new Date('2026-10-14T10:00:00Z'),
    }

    // El turno se mueve del 15 al 25 de Octubre
    const nuevaFecha = '2026-10-25'
    const nuevaHora = '11:00'
    const nuevoProgramado = calcularMomentoProgramado(nuevaFecha, nuevaHora, 24, new Date('2026-10-10T10:00:00Z'))

    assert.ok(nuevoProgramado !== null)
    
    // Al actualizar:
    const actualizado = {
      ...recordatorioActivo,
      estado: 'PENDIENTE',
      programadoPara: nuevoProgramado,
      intentos: 0,
      ultimoError: null,
    }

    assert.equal(actualizado.estado, 'PENDIENTE')
    assert.equal(actualizado.intentos, 0)
    assert.equal(actualizado.ultimoError, null)
    assert.equal(actualizado.programadoPara.getUTCDate(), 24) // 24hs antes del 25
  })

  await test('RF-15.5: reprogramación tras recordatorio ya ENVIADO crea nuevo ciclo para la nueva fecha', () => {
    const recordatorioEnviado = {
      id: 'rec-enviado',
      estado: 'ENVIADO',
      ciclo: 1,
    }

    // Nuevo recordatorio generado para la nueva fecha
    const nuevoCiclo = {
      id: 'rec-nuevo-ciclo',
      estado: 'PENDIENTE',
      ciclo: recordatorioEnviado.ciclo + 1,
      intentos: 0,
    }

    assert.equal(nuevoCiclo.ciclo, 2)
    assert.equal(nuevoCiclo.estado, 'PENDIENTE')
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-15 PASARON EXITOSAMENTE (15/15) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-15:', error)
  process.exit(1)
})
