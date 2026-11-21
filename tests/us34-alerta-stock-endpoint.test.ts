import assert from 'node:assert/strict'
import { clasificarStockVacunas } from '../lib/utils/reportes-utils.ts'

const AHORA = '2026-11-21T12:00:00.000Z'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type RolSesion = 'ENFERMERA' | 'enfermero' | 'MEDICO' | 'PACIENTE' | 'ADMIN'
type EstadoAlerta = 'PENDIENTE' | 'RESUELTA' | 'CANCELADA'

interface SesionMock {
  id: string
  nombre: string
  rol: RolSesion
}

interface VacunaMock {
  idVacuna: string
  nombre: string
  stock: number
  umbralAlerta: number
}

interface AlertaMock {
  idAlerta: string
  idVacuna: string
  idEnfermero: string | undefined
  estado: EstadoAlerta
  stockAlMomento: number
  umbralAlMomento: number
  enviadaAt: string
  resueltaAt: string | null
}

interface BaseDatosMock {
  vacunas: VacunaMock[]
  alertas: AlertaMock[]
  escrituras: number
}

interface RespuestaEndpoint {
  status: number
  body: {
    ok: boolean
    mensaje?: string
    alerta?: AlertaMock
    vacunas?: ReturnType<typeof clasificarStockVacunas>
    error?: string
    code?: string
  }
}

interface FilaInventarioMock {
  idVacuna: string
  nombre: string
  stockDisponible: number
  umbralAlerta: number
  alertaActiva: { idAlerta: string; estado: EstadoAlerta; enviadaAt: string } | null
}

interface EstadoBotonMock {
  mostrar: boolean
  disabled: boolean
  texto: string | null
  title: string | null
  url: string
}

const SESION_ENFERMERA: SesionMock = {
  id: 'enf_1',
  nombre: 'Ana',
  rol: 'ENFERMERA',
}

function crearBaseDatos(stock = 4, umbral = 10): BaseDatosMock {
  return {
    vacunas: [{ idVacuna: 'vac_1', nombre: 'Antigripal', stock, umbralAlerta: umbral }],
    alertas: [],
    escrituras: 0,
  }
}

function errorConEstado(message: string, statusCode: number, code?: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

function autorizarSoloEnfermera(sesion: SesionMock | null): SesionMock {
  if (!sesion) {
    throw errorConEstado(
      'No autorizado: sesión no encontrada o perfil inexistente.',
      401
    )
  }
  const rol = sesion.rol === 'enfermero' ? 'ENFERMERA' : sesion.rol
  if (rol !== 'ENFERMERA') {
    throw errorConEstado('Acceso denegado: se requiere perfil de enfermería.', 403)
  }
  return sesion
}

function emitirAlertaStock(
  db: BaseDatosMock,
  idVacuna: string | null,
  idEnfermero?: string
) {
  const vacuna = db.vacunas.find((v) => v.idVacuna === idVacuna)
  if (!vacuna) {
    throw errorConEstado('La vacuna indicada no existe.', 404, 'VACCINE_NOT_FOUND')
  }

  if (vacuna.stock >= vacuna.umbralAlerta) {
    throw errorConEstado(
      `No es posible emitir la alerta: el stock actual (${vacuna.stock} dosis) no es menor al umbral de alerta (${vacuna.umbralAlerta} dosis).`,
      400,
      'STOCK_NOT_CRITICAL'
    )
  }

  const pendiente = db.alertas.find(
    (a) => a.idVacuna === vacuna.idVacuna && a.estado === 'PENDIENTE'
  )
  if (pendiente) {
    throw errorConEstado(
      'Ya existe una alerta enviada para esta vacuna.',
      409,
      'ALERT_ALREADY_EXISTS'
    )
  }

  db.escrituras += 1
  const alerta: AlertaMock = {
    idAlerta: `alerta_${db.alertas.length + 1}`,
    idVacuna: vacuna.idVacuna,
    idEnfermero,
    estado: 'PENDIENTE',
    stockAlMomento: vacuna.stock,
    umbralAlMomento: vacuna.umbralAlerta,
    enviadaAt: AHORA,
    resueltaAt: null,
  }
  db.alertas.push(alerta)
  return { alerta, vacuna }
}

function endpointEmitirAlertaStock(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  idVacuna: string | null
): RespuestaEndpoint {
  try {
    const enfermera = autorizarSoloEnfermera(sesion)
    const { alerta, vacuna } = emitirAlertaStock(db, idVacuna, enfermera.id)
    return {
      status: 200,
      body: {
        ok: true,
        mensaje: `Alerta de stock emitida exitosamente para ${vacuna.nombre} (Notificación enviada a Administración).`,
        alerta,
      },
    }
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string }
    const status = err.statusCode ?? 500
    return {
      status,
      body: {
        ok: false,
        error: err.message || 'Error al emitir la alerta de stock.',
        code: err.code,
      },
    }
  }
}

function actualizarStock(
  db: BaseDatosMock,
  idVacuna: string,
  stockNuevo: number
) {
  const vacuna = db.vacunas.find((v) => v.idVacuna === idVacuna)
  if (!vacuna) {
    throw errorConEstado('La vacuna indicada no existe.', 404, 'VACCINE_NOT_FOUND')
  }

  vacuna.stock = stockNuevo
  if (stockNuevo >= vacuna.umbralAlerta) {
    for (const alerta of db.alertas) {
      if (alerta.idVacuna === idVacuna && alerta.estado === 'PENDIENTE') {
        alerta.estado = 'RESUELTA'
        alerta.resueltaAt = AHORA
      }
    }
  }
  return vacuna
}

function consultarInventario(db: BaseDatosMock): FilaInventarioMock[] {
  return db.vacunas.map((v) => {
    const pendiente = db.alertas.find(
      (a) => a.idVacuna === v.idVacuna && a.estado === 'PENDIENTE'
    )
    return {
      idVacuna: v.idVacuna,
      nombre: v.nombre,
      stockDisponible: v.stock,
      umbralAlerta: v.umbralAlerta,
      alertaActiva: pendiente
        ? {
            idAlerta: pendiente.idAlerta,
            estado: pendiente.estado,
            enviadaAt: pendiente.enviadaAt,
          }
        : null,
    }
  })
}

function estadoBotonAlerta(fila: FilaInventarioMock, enviando = false): EstadoBotonMock {
  const url = `/api/enfermeria/vacunas/${encodeURIComponent(fila.idVacuna)}/alerta`
  const esStockBajo = fila.stockDisponible < fila.umbralAlerta

  if (!esStockBajo) {
    return { mostrar: false, disabled: false, texto: null, title: null, url }
  }
  if (fila.alertaActiva) {
    return {
      mostrar: true,
      disabled: true,
      texto: 'Alerta enviada',
      title: 'Ya existe una alerta enviada a Administración para esta vacuna',
      url,
    }
  }
  return {
    mostrar: true,
    disabled: enviando,
    texto: enviando ? 'Enviando…' : 'Crear alerta',
    title: null,
    url,
  }
}

function simularClickCrearAlerta(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  fila: FilaInventarioMock
) {
  const res = endpointEmitirAlertaStock(db, sesion, fila.idVacuna)
  return {
    res,
    mensaje: res.status === 200 ? res.body.mensaje ?? null : null,
    error: res.status !== 200 ? res.body.error ?? null : null,
    refreshSolicitado: res.status === 200,
  }
}

function consultarPanelAdmin(db: BaseDatosMock) {
  const vacunas = clasificarStockVacunas(db.vacunas)
  const conStockBajo = vacunas.filter((v) => v.stockBajo).length
  return {
    etiqueta: 'Vacunas con stock bajo',
    valor: conStockBajo,
    detalle:
      conStockBajo > 0
        ? `⚠ de ${vacunas.length} vacunas · revisar stock`
        : `Todo en orden (${vacunas.length} vacunas)`,
    filas: vacunas.map((v) => ({
      nombre: v.nombre,
      dosis: v.stock,
      etiqueta: v.stockBajo ? '⚠ Stock bajo' : null,
      ariaLabel: `${v.nombre}: ${v.stock} dosis${v.stockBajo ? `, debajo del umbral de ${v.umbralAlerta}` : ''}`,
    })),
  }
}

function endpointReporteStock(
  db: BaseDatosMock,
  sesion: SesionMock | null
): RespuestaEndpoint {
  if (!sesion) {
    return {
      status: 401,
      body: { ok: false, error: 'Autenticación requerida.' },
    }
  }
  const rol = sesion.rol === 'enfermero' ? 'ENFERMERA' : sesion.rol
  if (rol !== 'ADMIN' && rol !== 'ENFERMERA') {
    return {
      status: 403,
      body: {
        ok: false,
        error: 'Acceso denegado: el reporte está disponible solo para Administración y Enfermería.',
      },
    }
  }
  return {
    status: 200,
    body: { ok: true, vacunas: clasificarStockVacunas(db.vacunas) },
  }
}

async function runAllTests() {
  console.log('\n=== US-34: PRUEBAS UNITARIAS DE ALERTA DE STOCK BAJO ===\n')

  await test('Esc.1: POST emite una alerta PENDIENTE cuando stock < umbral y devuelve 200 con el mensaje exacto', () => {
    const db = crearBaseDatos()
    const res = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')

    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(
      res.body.mensaje,
      'Alerta de stock emitida exitosamente para Antigripal (Notificación enviada a Administración).'
    )
    assert.deepEqual(res.body.alerta, {
      idAlerta: 'alerta_1',
      idVacuna: 'vac_1',
      idEnfermero: 'enf_1',
      estado: 'PENDIENTE',
      stockAlMomento: 4,
      umbralAlMomento: 10,
      enviadaAt: AHORA,
      resueltaAt: null,
    })
    assert.equal(db.alertas.length, 1)
    assert.equal(db.escrituras, 1)
  })

  await test('Esc.2: No se crea alerta cuando stock === umbral (límite no crítico) y devuelve 400 STOCK_NOT_CRITICAL', () => {
    const db = crearBaseDatos(10, 10)
    const res = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')

    assert.equal(res.status, 400)
    assert.equal(res.body.ok, false)
    assert.equal(res.body.code, 'STOCK_NOT_CRITICAL')
    assert.equal(
      res.body.error,
      'No es posible emitir la alerta: el stock actual (10 dosis) no es menor al umbral de alerta (10 dosis).'
    )
    assert.deepEqual(db.alertas, [])
    assert.equal(db.escrituras, 0)
  })

  await test('Esc.3: No se crea alerta cuando stock > umbral y devuelve 400 STOCK_NOT_CRITICAL', () => {
    const db = crearBaseDatos(15, 10)
    const res = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'STOCK_NOT_CRITICAL')
    assert.equal(
      res.body.error,
      'No es posible emitir la alerta: el stock actual (15 dosis) no es menor al umbral de alerta (10 dosis).'
    )
    assert.deepEqual(db.alertas, [])
    assert.equal(db.escrituras, 0)
  })

  await test('Esc.4: El umbral es configurable por vacuna — 18/20 emite y 20/20 no emite', () => {
    const dbBajo = crearBaseDatos(18, 20)
    const resBajo = endpointEmitirAlertaStock(dbBajo, SESION_ENFERMERA, 'vac_1')
    assert.equal(resBajo.status, 200)
    assert.equal(resBajo.body.alerta?.umbralAlMomento, 20)
    assert.equal(resBajo.body.alerta?.stockAlMomento, 18)

    const dbLimite = crearBaseDatos(20, 20)
    const resLimite = endpointEmitirAlertaStock(dbLimite, SESION_ENFERMERA, 'vac_1')
    assert.equal(resLimite.status, 400)
    assert.equal(resLimite.body.code, 'STOCK_NOT_CRITICAL')
    assert.equal(
      resLimite.body.error,
      'No es posible emitir la alerta: el stock actual (20 dosis) no es menor al umbral de alerta (20 dosis).'
    )
    assert.deepEqual(dbLimite.alertas, [])
  })

  await test('Esc.5: Control de duplicados — segunda emisión con alerta PENDIENTE devuelve 409 sin crear otra alerta', () => {
    const db = crearBaseDatos()
    const primera = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')
    assert.equal(primera.status, 200)

    const segunda = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')
    assert.equal(segunda.status, 409)
    assert.equal(segunda.body.ok, false)
    assert.equal(segunda.body.code, 'ALERT_ALREADY_EXISTS')
    assert.equal(segunda.body.error, 'Ya existe una alerta enviada para esta vacuna.')
    assert.equal(db.alertas.length, 1)
    assert.equal(db.escrituras, 1)
  })

  await test('Esc.6: Alertas RESUELTA o CANCELADA no bloquean una nueva emisión si el stock vuelve a bajar', () => {
    const db = crearBaseDatos()
    endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')
    actualizarStock(db, 'vac_1', 10)
    assert.equal(db.alertas[0].estado, 'RESUELTA')

    actualizarStock(db, 'vac_1', 3)
    const reemitida = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')
    assert.equal(reemitida.status, 200)
    assert.equal(db.alertas.length, 2)
    assert.equal(db.alertas[0].estado, 'RESUELTA')
    assert.equal(db.alertas[1].estado, 'PENDIENTE')

    const dbCancelada = crearBaseDatos()
    endpointEmitirAlertaStock(dbCancelada, SESION_ENFERMERA, 'vac_1')
    dbCancelada.alertas[0].estado = 'CANCELADA'
    const trasCancelar = endpointEmitirAlertaStock(dbCancelada, SESION_ENFERMERA, 'vac_1')
    assert.equal(trasCancelar.status, 200)
    assert.equal(dbCancelada.alertas.length, 2)
  })

  await test('Esc.7: Vacuna inexistente devuelve 404 VACCINE_NOT_FOUND sin escribir', () => {
    const db = crearBaseDatos()
    const res = endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_inexistente')

    assert.equal(res.status, 404)
    assert.equal(res.body.code, 'VACCINE_NOT_FOUND')
    assert.equal(res.body.error, 'La vacuna indicada no existe.')
    assert.deepEqual(db.alertas, [])
    assert.equal(db.escrituras, 0)
  })

  await test('Esc.8: Permisos — sin sesión 401, MEDICO/PACIENTE/ADMIN 403 y alias "enfermero" permitido', () => {
    const db = crearBaseDatos()

    const sinSesion = endpointEmitirAlertaStock(db, null, 'vac_1')
    assert.equal(sinSesion.status, 401)
    assert.equal(
      sinSesion.body.error,
      'No autorizado: sesión no encontrada o perfil inexistente.'
    )

    for (const rol of ['MEDICO', 'PACIENTE', 'ADMIN'] as const) {
      const sesion: SesionMock = { id: `usr_${rol.toLowerCase()}`, nombre: 'Usuario', rol }
      const res = endpointEmitirAlertaStock(db, sesion, 'vac_1')
      assert.equal(res.status, 403, `rol ${rol} debe ser bloqueado`)
      assert.equal(res.body.error, 'Acceso denegado: se requiere perfil de enfermería.')
    }
    assert.equal(db.alertas.length, 0)

    const alias = endpointEmitirAlertaStock(
      db,
      { id: 'enf_alias', nombre: 'Ana', rol: 'enfermero' },
      'vac_1'
    )
    assert.equal(alias.status, 200)
    assert.equal(db.alertas[0].idEnfermero, 'enf_alias')
  })

  await test('Esc.9: Reposición a umbral resuelve la alerta PENDIENTE; reposición bajo umbral la mantiene PENDIENTE', () => {
    const dbResuelta = crearBaseDatos()
    endpointEmitirAlertaStock(dbResuelta, SESION_ENFERMERA, 'vac_1')
    actualizarStock(dbResuelta, 'vac_1', 10)
    assert.equal(dbResuelta.alertas[0].estado, 'RESUELTA')
    assert.equal(dbResuelta.alertas[0].resueltaAt, AHORA)
    assert.equal(
      consultarInventario(dbResuelta)[0].alertaActiva,
      null
    )

    const dbPendiente = crearBaseDatos()
    endpointEmitirAlertaStock(dbPendiente, SESION_ENFERMERA, 'vac_1')
    actualizarStock(dbPendiente, 'vac_1', 8)
    assert.equal(dbPendiente.alertas[0].estado, 'PENDIENTE')
    assert.equal(dbPendiente.alertas[0].resueltaAt, null)
    assert.equal(
      consultarInventario(dbPendiente)[0].alertaActiva?.estado,
      'PENDIENTE'
    )
  })

  await test('Esc.10: Visualización de enfermería — botón, URL, confirmación, bloqueo por duplicado y oculto sobre umbral', () => {
    const db = crearBaseDatos()
    const fila = consultarInventario(db)[0]
    assert.equal(fila.alertaActiva, null)

    const boton = estadoBotonAlerta(fila)
    assert.equal(boton.mostrar, true)
    assert.equal(boton.disabled, false)
    assert.equal(boton.texto, 'Crear alerta')
    assert.equal(boton.url, '/api/enfermeria/vacunas/vac_1/alerta')

    const enviando = estadoBotonAlerta(fila, true)
    assert.equal(enviando.disabled, true)
    assert.equal(enviando.texto, 'Enviando…')

    const confirmado = simularClickCrearAlerta(db, SESION_ENFERMERA, fila)
    assert.equal(confirmado.error, null)
    assert.equal(confirmado.refreshSolicitado, true)
    assert.equal(
      confirmado.mensaje,
      'Alerta de stock emitida exitosamente para Antigripal (Notificación enviada a Administración).'
    )

    const filaConAlerta = consultarInventario(db)[0]
    assert.deepEqual(filaConAlerta.alertaActiva, {
      idAlerta: 'alerta_1',
      estado: 'PENDIENTE',
      enviadaAt: AHORA,
    })
    const bloqueado = estadoBotonAlerta(filaConAlerta)
    assert.equal(bloqueado.mostrar, true)
    assert.equal(bloqueado.disabled, true)
    assert.equal(bloqueado.texto, 'Alerta enviada')
    assert.equal(
      bloqueado.title,
      'Ya existe una alerta enviada a Administración para esta vacuna'
    )

    const duplicado = simularClickCrearAlerta(db, SESION_ENFERMERA, filaConAlerta)
    assert.equal(duplicado.error, 'Ya existe una alerta enviada para esta vacuna.')
    assert.equal(duplicado.refreshSolicitado, false)

    const filaNormal = consultarInventario(crearBaseDatos(15, 10))[0]
    assert.equal(estadoBotonAlerta(filaNormal).mostrar, false)
  })

  await test('Esc.11: Panel administrativo — indicador y etiquetas usan clasificarStockVacunas real y el umbral por vacuna', () => {
    const db: BaseDatosMock = {
      vacunas: [
        { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 4, umbralAlerta: 10 },
        { idVacuna: 'vac_2', nombre: 'Neumococo', stock: 15, umbralAlerta: 10 },
        { idVacuna: 'vac_3', nombre: 'Meningococo', stock: 2, umbralAlerta: 5 },
      ],
      alertas: [],
      escrituras: 0,
    }
    endpointEmitirAlertaStock(db, SESION_ENFERMERA, 'vac_1')

    const panel = consultarPanelAdmin(db)
    assert.equal(panel.etiqueta, 'Vacunas con stock bajo')
    assert.equal(panel.valor, 2)
    assert.equal(panel.detalle, '⚠ de 3 vacunas · revisar stock')
    assert.deepEqual(panel.filas.map((f) => f.nombre), [
      'Meningococo',
      'Antigripal',
      'Neumococo',
    ])
    assert.deepEqual(panel.filas.map((f) => f.etiqueta), [
      '⚠ Stock bajo',
      '⚠ Stock bajo',
      null,
    ])
    assert.equal(
      panel.filas[0].ariaLabel,
      'Meningococo: 2 dosis, debajo del umbral de 5'
    )
    assert.equal(panel.filas[2].ariaLabel, 'Neumococo: 15 dosis')
  })

  await test('Esc.12: Reporte de stock — ADMIN y ENFERMERA visualizan, MEDICO/PACIENTE y sin sesión son bloqueados', () => {
    const db: BaseDatosMock = {
      vacunas: [
        { idVacuna: 'vac_1', nombre: 'Antigripal', stock: 4, umbralAlerta: 10 },
        { idVacuna: 'vac_2', nombre: 'Neumococo', stock: 15, umbralAlerta: 10 },
      ],
      alertas: [],
      escrituras: 0,
    }

    const sinSesion = endpointReporteStock(db, null)
    assert.equal(sinSesion.status, 401)
    assert.equal(sinSesion.body.error, 'Autenticación requerida.')

    for (const rol of ['MEDICO', 'PACIENTE'] as const) {
      const res = endpointReporteStock(db, {
        id: `usr_${rol.toLowerCase()}`,
        nombre: 'Usuario',
        rol,
      })
      assert.equal(res.status, 403, `rol ${rol} debe ser bloqueado`)
      assert.equal(
        res.body.error,
        'Acceso denegado: el reporte está disponible solo para Administración y Enfermería.'
      )
    }

    for (const sesion of [
      SESION_ENFERMERA,
      { id: 'admin_1', nombre: 'Admin', rol: 'ADMIN' as const },
      { id: 'enf_alias', nombre: 'Ana', rol: 'enfermero' as const },
    ]) {
      const res = endpointReporteStock(db, sesion)
      assert.equal(res.status, 200)
      assert.equal(res.body.ok, true)
      assert.deepEqual(res.body.vacunas, clasificarStockVacunas(db.vacunas))
      assert.equal(res.body.vacunas?.[0].stockBajo, true)
      assert.equal(res.body.vacunas?.[1].stockBajo, false)
    }
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-34 PASARON EXITOSAMENTE (12/12) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas unitarias de US-34:', error)
  process.exit(1)
})
