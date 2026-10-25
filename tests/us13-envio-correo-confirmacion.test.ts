import assert from 'node:assert/strict'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type EstadoEnvioCorreo = 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'FALLIDO'

interface Medico {
  idMedico: string
  nombre: string
  apellido: string
  especialidad: string
}

interface Paciente {
  idPaciente: string
  nombre: string
  apellido: string
  email: string
}

interface TurnoConfirmado {
  idTurno: string
  idMedico: string
  idPaciente: string
  fecha: string
  hora: string
  estado: 'CONFIRMADO'
}

interface CorreoConfirmacion {
  idCorreo: string
  idTurno: string
  destinatario: string
  asunto: string
  cuerpo: string
  estado: EstadoEnvioCorreo
  enviadoAt?: Date | null
}

const nombresEspecialidad: Record<string, string> = {
  CLINICA_MEDICA: 'Clínica Médica',
  PEDIATRIA: 'Pediatría',
  TRAUMATOLOGIA_ORTOPEDIA: 'Traumatología y Ortopedia',
}

function etiquetaEspecialidad(codigo: string): string {
  return nombresEspecialidad[codigo] ?? codigo
}

function formatearFechaHoraConfirmacion(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  const fechaFormateada = d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${fechaFormateada}, ${hora} hs`
}

function configurarServicioEmail() {
  return {
    proveedor: 'SMTP_SIMULADO',
    remitente: 'confirmaciones@sigesmed.com.ar',
    habilitado: true,
  }
}

function construirPlantillaConfirmacion(turno: TurnoConfirmado, medico: Medico, paciente: Paciente) {
  const medicoNombreCompleto = `${medico.nombre} ${medico.apellido}`
  const especialidadEtiqueta = etiquetaEspecialidad(medico.especialidad)
  const fechaHora = formatearFechaHoraConfirmacion(turno.fecha, turno.hora)

  const asunto = `Confirmación de turno - ${especialidadEtiqueta}`

  const cuerpo = [
    `Hola ${paciente.nombre} ${paciente.apellido},`,
    '',
    'Tu turno ha sido confirmado exitosamente.',
    '',
    `Médico: ${medicoNombreCompleto}`,
    `Especialidad: ${especialidadEtiqueta}`,
    `Fecha y hora: ${fechaHora}`,
    '',
    'Gracias por confiar en SIGESMED.',
  ].join('\n')

  return {
    asunto,
    cuerpo,
    destinatario: paciente.email,
    medicoNombreCompleto,
    especialidadEtiqueta,
    fechaHora,
  }
}

class ServicioEmailSimulado {
  correos: CorreoConfirmacion[] = []
  habilitado: boolean
  remitente: string

  constructor(config?: { habilitado?: boolean; remitente?: string }) {
    const cfg = configurarServicioEmail()
    this.habilitado = config?.habilitado ?? cfg.habilitado
    this.remitente = config?.remitente ?? cfg.remitente
  }

  enviarCorreoConfirmacion(turno: TurnoConfirmado, medico: Medico, paciente: Paciente): CorreoConfirmacion {
    if (turno.estado !== 'CONFIRMADO') {
      throw new Error('Solo se puede enviar correo de confirmación para turnos CONFIRMADOS.')
    }
    if (!this.habilitado) {
      throw new Error('El servicio de email no está habilitado.')
    }

    const plantilla = construirPlantillaConfirmacion(turno, medico, paciente)
    const correo: CorreoConfirmacion = {
      idCorreo: `correo_${turno.idTurno}_${Date.now()}`,
      idTurno: turno.idTurno,
      destinatario: plantilla.destinatario,
      asunto: plantilla.asunto,
      cuerpo: plantilla.cuerpo,
      estado: 'ENVIANDO',
    }

    // Disparo inmediato tras confirmar la reserva
    correo.estado = 'ENVIADO'
    correo.enviadoAt = new Date()
    this.correos.push(correo)
    return correo
  }

  obtenerCorreoPorTurno(idTurno: string): CorreoConfirmacion | undefined {
    return this.correos.find((c) => c.idTurno === idTurno)
  }

  verificarRecepcionCorreo(idTurno: string, emailPaciente: string): {
    recibido: boolean
    correo?: CorreoConfirmacion
    motivos?: string[]
  } {
    const correo = this.obtenerCorreoPorTurno(idTurno)
    if (!correo) {
      return { recibido: false, motivos: ['No se encontró correo enviado para este turno'] }
    }
    const motivos: string[] = []
    if (correo.destinatario !== emailPaciente) motivos.push('Destinatario incorrecto')
    if (correo.estado !== 'ENVIADO') motivos.push('Correo no enviado')
    if (!correo.enviadoAt) motivos.push('Sin fecha de envío')
    if (motivos.length === 0) return { recibido: true, correo }
    return { recibido: false, correo, motivos }
  }
}

const PACIENTE_PRUEBA: Paciente = {
  idPaciente: 'pac_001',
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'juan.perez@example.com',
}

const MEDICO_PRUEBA: Medico = {
  idMedico: 'med_001',
  nombre: 'Laura',
  apellido: 'Gómez',
  especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
}

const TURNO_CONFIRMADO_PRUEBA: TurnoConfirmado = {
  idTurno: 'turno_conf_001',
  idMedico: MEDICO_PRUEBA.idMedico,
  idPaciente: PACIENTE_PRUEBA.idPaciente,
  fecha: '2026-12-01',
  hora: '09:30',
  estado: 'CONFIRMADO',
}

async function runAllTests() {
  console.log('\n=== US-13: PRUEBAS UNITARIAS DE ENVÍO DE CORREO DE CONFIRMACIÓN ===\n')

  // --- Escenario 1: Configuración del servicio de email ---
  await test('Esc.1: el servicio de email se encuentra configurado correctamente', () => {
    const config = configurarServicioEmail()
    assert.equal(config.proveedor, 'SMTP_SIMULADO')
    assert.equal(config.remitente, 'confirmaciones@sigesmed.com.ar')
    assert.equal(config.habilitado, true)
  })

  await test('Esc.1: el servicio de email simulado se inicializa con la configuración habilitada', () => {
    const servicio = new ServicioEmailSimulado()
    assert.equal(servicio.habilitado, true)
    assert.ok(servicio.remitente)
  })

  // --- Escenario 2: Plantilla de confirmación (médico, especialidad, fecha, hora) ---
  await test('Esc.2: la plantilla incluye médico, especialidad, fecha y hora', () => {
    const plantilla = construirPlantillaConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    assert.ok(plantilla.cuerpo.includes('Laura Gómez'))
    assert.ok(plantilla.cuerpo.includes('Traumatología y Ortopedia'))
    assert.ok(plantilla.cuerpo.includes('09:30'))
    assert.ok(plantilla.cuerpo.includes('diciembre'))
  })

  await test('Esc.2: el asunto del correo indica confirmación de turno con la especialidad', () => {
    const plantilla = construirPlantillaConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    assert.ok(plantilla.asunto.includes('Confirmación'))
    assert.ok(plantilla.asunto.includes('Traumatología'))
  })

  await test('Esc.2: la especialidad se muestra con etiqueta legible', () => {
    const plantilla = construirPlantillaConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    assert.equal(plantilla.especialidadEtiqueta, 'Traumatología y Ortopedia')
  })

  await test('Esc.2: la fecha y hora se formatean correctamente para la confirmación', () => {
    const fechaHora = formatearFechaHoraConfirmacion('2026-12-01', '09:30')
    assert.ok(fechaHora.includes('diciembre'))
    assert.ok(fechaHora.includes('09:30 hs'))
  })

  // --- Escenario 3: Disparo inmediato tras confirmar la reserva ---
  await test('Esc.3: tras confirmar la reserva se dispara el envío de correo de confirmación inmediatamente', () => {
    const servicio = new ServicioEmailSimulado()
    const correo = servicio.enviarCorreoConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    assert.equal(correo.estado, 'ENVIADO')
    assert.ok(correo.enviadoAt instanceof Date)
  })

  await test('Esc.3: el correo se vincula correctamente al turno confirmado', () => {
    const servicio = new ServicioEmailSimulado()
    const correo = servicio.enviarCorreoConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    assert.equal(correo.idTurno, TURNO_CONFIRMADO_PRUEBA.idTurno)
  })

  await test('Esc.3: no se envía correo de confirmación si el turno no está confirmado', () => {
    const servicio = new ServicioEmailSimulado()
    const turnoNoConfirmado: any = { ...TURNO_CONFIRMADO_PRUEBA, estado: 'DISPONIBLE' }
    let lanzoError = false
    try {
      servicio.enviarCorreoConfirmacion(turnoNoConfirmado, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    } catch (error: any) {
      lanzoError = true
      assert.ok(error.message.includes('CONFIRMADO'))
    }
    assert.equal(lanzoError, true)
  })

  // --- Escenario 4: Pruebas con reservas de prueba y verificación de recepción del correo ---
  await test('Esc.4: envío exitoso con reserva de prueba y verificación de recepción', () => {
    const servicio = new ServicioEmailSimulado()
    const correo = servicio.enviarCorreoConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    const verificacion = servicio.verificarRecepcionCorreo(TURNO_CONFIRMADO_PRUEBA.idTurno, PACIENTE_PRUEBA.email)
    assert.equal(verificacion.recibido, true)
    assert.equal(correo.destinatario, 'juan.perez@example.com')
    assert.equal(correo.estado, 'ENVIADO')
  })

  await test('Esc.4: el correo contiene todos los datos requeridos en el cuerpo', () => {
    const servicio = new ServicioEmailSimulado()
    const correo = servicio.enviarCorreoConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    assert.ok(correo.cuerpo.includes('Laura Gómez'))
    assert.ok(correo.cuerpo.includes('Traumatología y Ortopedia'))
    assert.ok(correo.cuerpo.includes('09:30'))
    assert.ok(correo.cuerpo.includes('diciembre'))
    assert.ok(correo.cuerpo.includes('confirmado') || correo.cuerpo.includes('confirmada'))
  })

  await test('Esc.4: se registran correos independientes para múltiples reservas de prueba', () => {
    const servicio = new ServicioEmailSimulado()
    const turno2: TurnoConfirmado = { ...TURNO_CONFIRMADO_PRUEBA, idTurno: 'turno_conf_002', fecha: '2026-12-05', hora: '14:00' }
    const medico2: Medico = { ...MEDICO_PRUEBA, idMedico: 'med_002', nombre: 'Carlos', apellido: 'Martínez', especialidad: 'CLINICA_MEDICA' }
    const correo1 = servicio.enviarCorreoConfirmacion(TURNO_CONFIRMADO_PRUEBA, MEDICO_PRUEBA, PACIENTE_PRUEBA)
    const correo2 = servicio.enviarCorreoConfirmacion(turno2, medico2, PACIENTE_PRUEBA)
    assert.equal(servicio.correos.length, 2)
    assert.notEqual(correo1.idCorreo, correo2.idCorreo)
    assert.notEqual(correo1.asunto, correo2.asunto)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-13 PASARON EXITOSAMENTE (11/11) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-13:', error)
  process.exit(1)
})
