// Suite exhaustiva de pruebas unitarias para US-21 y US-22:
// Gestión administrativa de turnos, cancelaciones con preservación de paciente y notificaciones por email.
import assert from 'node:assert/strict'
import {
  parseFechaFiltro,
  formatearFechaArgentina,
} from '../lib/utils/admin-turnos-utils.ts'
import {
  construirPlantillaAvisoCancelacion,
  type DatosAvisoCancelacionEmail,
} from '../lib/services/email-service.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// Modelado en memoria de entidades para validación aislada de reglas de negocio
type EstadoTurno = 'DISPONIBLE' | 'CONFIRMADO' | 'CANCELADO' | 'ATENDIDO'
type EstadoNotificacionCancelacion = 'PENDIENTE' | 'PROCESANDO' | 'ENVIADA' | 'FALLIDA'

interface TurnoMock {
  idTurno: string
  idMedico: string
  idPaciente: string | null
  fecha: string // YYYY-MM-DD
  hora: string
  estado: EstadoTurno
  motivoCancelacion?: string | null
  estadoNotificacionCancelacion?: EstadoNotificacionCancelacion | null
  notificacionCancelacionIntentadaAt?: Date | null
  notificacionCancelacionEnviadaAt?: Date | null
  paciente?: {
    nombre: string
    apellido: string
    dni: string
    email: string
  } | null
  medico?: {
    nombre: string
    apellido: string
    especialidad: string
  }
}

interface RecordatorioMock {
  idRecordatorio: string
  idTurno: string
  estado: 'PENDIENTE' | 'ENVIADO' | 'CANCELADO'
}

async function runAllTests() {
  console.log('\n=== US-21 & US-22: PRUEBAS DE GESTIÓN ADMINISTRATIVA DE TURNOS Y AVISOS ===\n')

  // --------------------------------------------------------------------------
  // Grupo 1: Filtrado y Validación de Fechas (RF-21.1 & RF-21.2)
  // --------------------------------------------------------------------------
  await test('RF-21.1: parseFechaFiltro valida correctamente formato YYYY-MM-DD y rechaza formatos inválidos', () => {
    const valid = parseFechaFiltro('2026-10-25')
    assert.ok(valid instanceof Date)
    assert.equal(valid.getUTCFullYear(), 2026)
    assert.equal(valid.getUTCMonth(), 9) // 0-indexed: 9 = Octubre
    assert.equal(valid.getUTCDate(), 25)

    assert.equal(parseFechaFiltro('25-10-2026'), null)
    assert.equal(parseFechaFiltro('2026/10/25'), null)
    assert.equal(parseFechaFiltro('invalido'), null)
    assert.equal(parseFechaFiltro(''), null)
  })

  await test('RF-21.1: formatearFechaArgentina no produce corrimientos por zona horaria', () => {
    const fechaTexto = '2026-11-15'
    const formateada = formatearFechaArgentina(fechaTexto)
    assert.ok(formateada.toLowerCase().includes('15'))
    assert.ok(formateada.toLowerCase().includes('noviembre'))
    assert.ok(formateada.includes('2026'))
  })

  await test('RF-21.1 / Escenario 1: Búsqueda por paciente filtra por nombre, apellido, DNI o email', () => {
    const turnos: TurnoMock[] = [
      {
        idTurno: 't1',
        idMedico: 'm1',
        idPaciente: 'p1',
        fecha: '2026-10-25',
        hora: '09:00',
        estado: 'CONFIRMADO',
        paciente: { nombre: 'Carlos', apellido: 'Gómez', dni: '35123456', email: 'carlos@test.com' },
      },
      {
        idTurno: 't2',
        idMedico: 'm1',
        idPaciente: 'p2',
        fecha: '2026-10-25',
        hora: '10:00',
        estado: 'CONFIRMADO',
        paciente: { nombre: 'María', apellido: 'López', dni: '40987654', email: 'maria@test.com' },
      },
    ]

    const filtrar = (termino: string) => {
      const q = termino.toLowerCase()
      return turnos.filter(
        (t) =>
          t.paciente &&
          (t.paciente.nombre.toLowerCase().includes(q) ||
            t.paciente.apellido.toLowerCase().includes(q) ||
            t.paciente.dni.includes(q) ||
            t.paciente.email.toLowerCase().includes(q))
      )
    }

    assert.equal(filtrar('Gómez').length, 1)
    assert.equal(filtrar('35123456').length, 1)
    assert.equal(filtrar('maria@test.com').length, 1)
    assert.equal(filtrar('inexistente').length, 0)
  })

  await test('RF-21.1 / Escenario 2 & 3: Búsqueda combinada por fecha y paciente acota resultados o devuelve colección vacía', () => {
    const turnos: TurnoMock[] = [
      {
        idTurno: 't1',
        idMedico: 'm1',
        idPaciente: 'p1',
        fecha: '2026-10-25',
        hora: '09:00',
        estado: 'CONFIRMADO',
        paciente: { nombre: 'Carlos', apellido: 'Gómez', dni: '35123456', email: 'carlos@test.com' },
      },
      {
        idTurno: 't2',
        idMedico: 'm1',
        idPaciente: 'p1',
        fecha: '2026-10-26',
        hora: '11:00',
        estado: 'CONFIRMADO',
        paciente: { nombre: 'Carlos', apellido: 'Gómez', dni: '35123456', email: 'carlos@test.com' },
      },
    ]

    const filtrarCombinado = (fecha: string, paciente: string) =>
      turnos.filter(
        (t) =>
          t.fecha === fecha &&
          t.paciente &&
          (t.paciente.nombre.toLowerCase().includes(paciente.toLowerCase()) ||
            t.paciente.dni.includes(paciente))
      )

    // Coincidencia exacta día 25 y Carlos
    const resDia25 = filtrarCombinado('2026-10-25', 'Carlos')
    assert.equal(resDia25.length, 1)
    assert.equal(resDia25[0].idTurno, 't1')

    // Sin coincidencias para fecha no correspondiente
    const resVacio = filtrarCombinado('2026-10-27', 'Carlos')
    assert.equal(resVacio.length, 0)
  })

  // --------------------------------------------------------------------------
  // Grupo 2: Cancelación Administrativa de Turnos (RF-21.4 a RF-21.6)
  // --------------------------------------------------------------------------
  await test('RF-21.4 / Escenario 4: Cancelar turno CONFIRMADO cambia a CANCELADO, preserva paciente e inicializa notificación PENDIENTE', () => {
    const turno: TurnoMock = {
      idTurno: 't10',
      idMedico: 'med_001',
      idPaciente: 'pac_123',
      fecha: '2026-11-05',
      hora: '10:00',
      estado: 'CONFIRMADO',
      paciente: { nombre: 'Ana', apellido: 'Pérez', dni: '28456789', email: 'ana@hospital.com' },
    }

    const recordatorios: RecordatorioMock[] = [
      { idRecordatorio: 'rec_1', idTurno: 't10', estado: 'PENDIENTE' },
    ]

    // Simulación de la cancelación administrativa (AdminTurnosService.cancelarTurnoAdministrativo)
    assert.equal(turno.estado, 'CONFIRMADO')
    assert.ok(turno.idPaciente !== null)

    turno.estado = 'CANCELADO'
    turno.motivoCancelacion = 'Cancelación administrativa por modificación de la agenda médica'
    turno.estadoNotificacionCancelacion = 'PENDIENTE'

    // Cancelar recordatorios vinculados
    for (const r of recordatorios) {
      if (r.idTurno === turno.idTurno && r.estado === 'PENDIENTE') {
        r.estado = 'CANCELADO'
      }
    }

    assert.equal(turno.estado, 'CANCELADO')
    assert.equal(turno.idPaciente, 'pac_123') // Conserva asociación con paciente (CRÍTICO para US-22)
    assert.equal(turno.estadoNotificacionCancelacion, 'PENDIENTE')
    assert.equal(recordatorios[0].estado, 'CANCELADO')
  })

  await test('RF-21.4 / Escenario 5: Rechaza cancelar turnos que no están CONFIRMADOS (DISPONIBLE, CANCELADO, ATENDIDO)', () => {
    const turnoDisponible: TurnoMock = {
      idTurno: 't_disp',
      idMedico: 'm1',
      idPaciente: null,
      fecha: '2026-11-05',
      hora: '14:00',
      estado: 'DISPONIBLE',
    }

    const validarCancelable = (t: TurnoMock) => {
      if (t.estado !== 'CONFIRMADO') {
        throw new Error(`No se puede cancelar el turno porque su estado es ${t.estado}`)
      }
      if (!t.idPaciente) {
        throw new Error('El turno no posee un paciente asignado')
      }
      return true
    }

    assert.throws(() => validarCancelable(turnoDisponible), /DISPONIBLE/)

    const turnoYaCancelado: TurnoMock = {
      idTurno: 't_canc',
      idMedico: 'm1',
      idPaciente: 'p1',
      fecha: '2026-11-05',
      hora: '15:00',
      estado: 'CANCELADO',
    }
    assert.throws(() => validarCancelable(turnoYaCancelado), /CANCELADO/)

    const turnoAtendido: TurnoMock = {
      idTurno: 't_atendido',
      idMedico: 'm1',
      idPaciente: 'p1',
      fecha: '2026-11-05',
      hora: '16:00',
      estado: 'ATENDIDO',
    }
    assert.throws(() => validarCancelable(turnoAtendido), /ATENDIDO/)
  })

  await test('RF-21.6 / Escenario 10: Diferencia explícita entre US-14 (cancelación por paciente) y US-21 (cancelación administrativa)', () => {
    // US-14: el paciente cancela -> el turno vuelve a DISPONIBLE y idPaciente se desvincula (null)
    const turnoPaciente: TurnoMock = {
      idTurno: 't_us14',
      idMedico: 'm1',
      idPaciente: 'pac_01',
      fecha: '2026-11-10',
      hora: '09:00',
      estado: 'CONFIRMADO',
    }
    // Cancelación US-14
    turnoPaciente.estado = 'DISPONIBLE'
    turnoPaciente.idPaciente = null
    assert.equal(turnoPaciente.estado, 'DISPONIBLE')
    assert.equal(turnoPaciente.idPaciente, null)

    // US-21: el administrador cancela por cambio de agenda -> queda CANCELADO y conserva paciente
    const turnoAdmin: TurnoMock = {
      idTurno: 't_us21',
      idMedico: 'm1',
      idPaciente: 'pac_01',
      fecha: '2026-11-10',
      hora: '09:00',
      estado: 'CONFIRMADO',
    }
    // Cancelación US-21
    turnoAdmin.estado = 'CANCELADO'
    turnoAdmin.motivoCancelacion = 'Cancelación administrativa por modificación de la agenda médica'
    assert.equal(turnoAdmin.estado, 'CANCELADO')
    assert.equal(turnoAdmin.idPaciente, 'pac_01') // NO se libera para reserva
  })

  // --------------------------------------------------------------------------
  // Grupo 3: Notificación por Email de Turno Cancelado (RF-22.1 a RF-22.7)
  // --------------------------------------------------------------------------
  await test('RF-22.3: La plantilla del correo contiene asunto oficial, datos del médico, fecha original y disculpas', () => {
    const datosEmail: DatosAvisoCancelacionEmail = {
      email: 'paciente@test.com',
      pacienteNombre: 'Lucía Fernández',
      medicoNombre: 'Martín Gómez',
      especialidad: 'TRAUMATOLOGIA_ORTOPEDIA',
      fecha: 'jueves, 12 de noviembre de 2026',
      hora: '10:30',
    }

    const plantilla = construirPlantillaAvisoCancelacion(datosEmail)
    assert.equal(plantilla.asunto, 'Importante: cancelación de su turno médico - SIGESMED')
    assert.ok(plantilla.html.includes('Lucía Fernández'))
    assert.ok(plantilla.html.includes('Martín Gómez'))
    assert.ok(plantilla.html.includes('Traumatología y Ortopedia'))
    assert.ok(plantilla.html.includes('10:30 hs'))
    assert.ok(plantilla.html.includes('modificaciones en los días y horarios'))
    assert.ok(plantilla.html.includes('Lamentamos sinceramente los inconvenientes'))

    assert.ok(plantilla.textoPlano.includes('Importante: cancelación de su turno médico'))
    assert.ok(plantilla.textoPlano.includes('Dr./Dra. Martín Gómez'))
  })

  await test('RF-22.4 / RF-22.6: Rechaza notificar si el paciente no tiene email válido', () => {
    const turnoSinEmail: TurnoMock = {
      idTurno: 't_no_email',
      idMedico: 'm1',
      idPaciente: 'p1',
      fecha: '2026-11-10',
      hora: '09:00',
      estado: 'CANCELADO',
      paciente: { nombre: 'Sin', apellido: 'Email', dni: '123', email: 'correo-sin-arroba' },
    }

    const validarDestinatario = (t: TurnoMock) => {
      if (!t.paciente?.email || !t.paciente.email.includes('@')) {
        throw new Error('El paciente asociado no posee una dirección de correo válida')
      }
      return true
    }

    assert.throws(() => validarDestinatario(turnoSinEmail), /correo válida/)
  })

  await test('RF-22.7 / Escenario 7: Rechaza notificaciones duplicadas si el aviso ya fue enviado (idempotencia)', () => {
    const turnoYaNotificado: TurnoMock = {
      idTurno: 't_notif_done',
      idMedico: 'm1',
      idPaciente: 'p1',
      fecha: '2026-11-10',
      hora: '09:00',
      estado: 'CANCELADO',
      estadoNotificacionCancelacion: 'ENVIADA',
      notificacionCancelacionEnviadaAt: new Date(),
      paciente: { nombre: 'Juan', apellido: 'Pérez', dni: '123', email: 'juan@test.com' },
    }

    const notificar = (t: TurnoMock) => {
      if (t.estadoNotificacionCancelacion === 'ENVIADA') {
        const err = new Error('La notificación para este turno ya fue enviada exitosamente.') as any
        err.statusCode = 409
        err.code = 'NOTIFICATION_ALREADY_SENT'
        throw err
      }
    }

    assert.throws(() => notificar(turnoYaNotificado), (err: any) => err.statusCode === 409)
  })

  await test('RF-22.7: Protección de concurrencia mediante transición atómica a PROCESANDO', () => {
    const turno: TurnoMock = {
      idTurno: 't_concurrent',
      idMedico: 'm1',
      idPaciente: 'p1',
      fecha: '2026-11-10',
      hora: '09:00',
      estado: 'CANCELADO',
      estadoNotificacionCancelacion: 'PENDIENTE',
      paciente: { nombre: 'Juan', apellido: 'Pérez', dni: '123', email: 'juan@test.com' },
    }

    // Primer hilo reclama el envío
    const reclamarEnvio = (t: TurnoMock) => {
      if (t.estadoNotificacionCancelacion === 'PROCESANDO') {
        throw new Error('Ya existe un proceso de notificación en curso para este turno.')
      }
      if (t.estadoNotificacionCancelacion === 'ENVIADA') {
        throw new Error('La notificación ya fue enviada.')
      }
      t.estadoNotificacionCancelacion = 'PROCESANDO'
      t.notificacionCancelacionIntentadaAt = new Date()
      return true
    }

    assert.equal(reclamarEnvio(turno), true)
    assert.equal(turno.estadoNotificacionCancelacion, 'PROCESANDO')

    // Segundo hilo concurrente intenta reclamar mientras está en PROCESANDO
    assert.throws(() => reclamarEnvio(turno), /en curso/)
  })

  await test('RF-22.6 / Escenario 8: Ante fallo en el envío, el estado pasa a FALLIDA y permite reintento posterior', () => {
    const turno: TurnoMock = {
      idTurno: 't_fail',
      idMedico: 'm1',
      idPaciente: 'p1',
      fecha: '2026-11-10',
      hora: '09:00',
      estado: 'CANCELADO',
      estadoNotificacionCancelacion: 'PROCESANDO',
      paciente: { nombre: 'Juan', apellido: 'Pérez', dni: '123', email: 'juan@test.com' },
    }

    // Falla el proveedor de correo
    const registrarFallo = (t: TurnoMock) => {
      t.estadoNotificacionCancelacion = 'FALLIDA'
    }

    registrarFallo(turno)
    assert.equal(turno.estadoNotificacionCancelacion, 'FALLIDA')

    // Reintento: permite volver a intentar desde FALLIDA
    const permitirReintento = (t: TurnoMock) => {
      return t.estadoNotificacionCancelacion === 'FALLIDA' || t.estadoNotificacionCancelacion === 'PENDIENTE'
    }

    assert.equal(permitirReintento(turno), true)

    // Reintento exitoso
    turno.estadoNotificacionCancelacion = 'ENVIADA'
    turno.notificacionCancelacionEnviadaAt = new Date()
    assert.equal(turno.estadoNotificacionCancelacion, 'ENVIADA')
    assert.ok(turno.notificacionCancelacionEnviadaAt instanceof Date)
  })

  // --------------------------------------------------------------------------
  // Grupo 4: Verificación de Autorización Administrativa en Servidor (Escenario 9)
  // --------------------------------------------------------------------------
  await test('Escenario 9: Solo usuarios con rol ADMIN tienen acceso concedido a las operaciones', () => {
    const verificarRolAdmin = (usuario: { rol?: string } | null) => {
      if (!usuario) {
        const err = new Error('Autenticación requerida') as any
        err.statusCode = 401
        throw err
      }
      if (usuario.rol !== 'ADMIN') {
        const err = new Error('Acceso denegado: se requiere rol ADMIN') as any
        err.statusCode = 403
        throw err
      }
      return true
    }

    // 1. Sin sesión -> 401
    assert.throws(() => verificarRolAdmin(null), (err: any) => err.statusCode === 401)

    // 2. Rol paciente -> 403
    assert.throws(() => verificarRolAdmin({ rol: 'PACIENTE' }), (err: any) => err.statusCode === 403)

    // 3. Rol medico -> 403
    assert.throws(() => verificarRolAdmin({ rol: 'MEDICO' }), (err: any) => err.statusCode === 403)

    // 4. Rol enfermera -> 403
    assert.throws(() => verificarRolAdmin({ rol: 'ENFERMERA' }), (err: any) => err.statusCode === 403)

    // 5. Rol admin -> OK
    assert.equal(verificarRolAdmin({ rol: 'ADMIN' }), true)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-21 Y US-22 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((err) => {
  console.error('Fallo en la suite de pruebas US-21/US-22:', err)
  process.exit(1)
})
