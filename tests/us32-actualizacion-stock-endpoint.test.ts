import assert from 'node:assert/strict'
import { validarActualizacionStock } from '../lib/validation/vacunacion.ts'
import { nivelStock } from '../lib/utils/inventario-vacunas.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

type RolSesion = 'ENFERMERA' | 'enfermero' | 'MEDICO' | 'PACIENTE' | 'ADMIN'

interface SesionMock {
  id: string
  nombre: string
  rol: RolSesion
}

interface VacunaMock {
  idVacuna: string
  nombre: string
  stock: number
  categoria: string
  laboratorio: string | null
  presentacion: string | null
  umbralAlerta: number
}

interface MovimientoMock {
  idMovimiento: string
  idVacuna: string
  idEnfermero: string | undefined
  tipoMovimiento: string
  cantidad: number
  stockAnterior: number
  stockNuevo: number
  motivo: string
}

interface BaseDatosMock {
  vacunas: VacunaMock[]
  movimientos: MovimientoMock[]
  escrituras: number
}

interface RespuestaEndpoint {
  status: number
  body: {
    ok: boolean
    mensaje?: string
    vacuna?: VacunaMock
    error?: string
    code?: string
  }
}

interface OpcionesEndpoint {
  jsonValido?: boolean
  stockLeido?: number
}

interface EstadoModalMock {
  error: string | null
  fetchRealizado: boolean
  urlFetch: string | null
  bodyEnviado: { stockNuevo: number; motivo: string } | null
  mensaje: string | null
  refreshSolicitado: boolean
}

function crearBaseDatos(stockInicial = 8): BaseDatosMock {
  return {
    vacunas: [
      {
        idVacuna: 'vac_1',
        nombre: 'Antigripal',
        stock: stockInicial,
        categoria: 'ESTACIONAL',
        laboratorio: 'Sanofi Pasteur',
        presentacion: null,
        umbralAlerta: 10,
      },
    ],
    movimientos: [],
    escrituras: 0,
  }
}

const SESION_ENFERMERA: SesionMock = {
  id: 'enf_1',
  nombre: 'Ana',
  rol: 'ENFERMERA',
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

function endpointActualizarStock(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  idVacuna: string | null,
  body: unknown,
  opciones: OpcionesEndpoint = {}
): RespuestaEndpoint {
  try {
    const enfermera = autorizarSoloEnfermera(sesion)
    const payload = opciones.jsonValido === false ? null : body

    const validacion = validarActualizacionStock(payload)
    if (!validacion.ok || !validacion.datos) {
      throw errorConEstado(
        validacion.error || 'Cantidad inválida.',
        400,
        'INVALID_STOCK'
      )
    }
    const { stockNuevo, motivo } = validacion.datos

    const indice = db.vacunas.findIndex((v) => v.idVacuna === idVacuna)
    if (indice === -1) {
      throw errorConEstado('La vacuna indicada no existe.', 404, 'VACCINE_NOT_FOUND')
    }

    const vacuna = db.vacunas[indice]
    const stockLeido = opciones.stockLeido ?? vacuna.stock
    const diferencia = stockNuevo - stockLeido

    if (diferencia === 0) {
      return {
        status: 200,
        body: {
          ok: true,
          mensaje: 'La cantidad ingresada es igual al stock actual; no hubo cambios.',
          vacuna: { ...vacuna },
        },
      }
    }

    if (vacuna.stock !== stockLeido) {
      throw errorConEstado(
        'El stock cambió mientras lo editabas. Volvé a cargar el inventario e intentá de nuevo.',
        409,
        'CONCURRENT_MODIFICATION'
      )
    }

    db.escrituras += 1
    db.vacunas[indice] = { ...vacuna, stock: stockNuevo }
    db.movimientos.push({
      idMovimiento: `mov_${db.movimientos.length + 1}`,
      idVacuna: vacuna.idVacuna,
      idEnfermero: enfermera.id,
      tipoMovimiento: 'AJUSTE',
      cantidad: diferencia,
      stockAnterior: stockLeido,
      stockNuevo,
      motivo: motivo || 'Actualización de stock desde el inventario',
    })

    return {
      status: 200,
      body: {
        ok: true,
        mensaje: `Stock de "${vacuna.nombre}" actualizado a ${stockNuevo} dosis.`,
        vacuna: { ...db.vacunas[indice] },
      },
    }
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string }
    const status = err.statusCode ?? 500
    return {
      status,
      body: {
        ok: false,
        error: err.message || 'Error al actualizar el stock.',
        code: err.code,
      },
    }
  }
}

function consultarInventario(db: BaseDatosMock) {
  return db.vacunas.map((v) => ({
    idVacuna: v.idVacuna,
    nombre: v.nombre,
    stockDisponible: v.stock,
    nivel: nivelStock(v.stock, v.umbralAlerta),
  }))
}

function consultarHistorialMovimientos(db: BaseDatosMock, idVacuna: string) {
  return db.movimientos.filter((m) => m.idVacuna === idVacuna)
}

function validarModal(cantidad: string): string | null {
  const stockNuevo = Number(cantidad)
  if (cantidad.trim() === '' || !Number.isInteger(stockNuevo)) {
    return 'Ingresá una cantidad entera.'
  }
  if (stockNuevo < 0) {
    return 'La cantidad no puede ser negativa.'
  }
  return null
}

function simularCancelarModal() {
  return { guardo: false, fetchRealizado: false, refreshSolicitado: false }
}

function simularModalActualizarStock(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  vacuna: VacunaMock,
  cantidad: string,
  motivo: string,
  opciones: OpcionesEndpoint = {}
): EstadoModalMock {
  const estado: EstadoModalMock = {
    error: null,
    fetchRealizado: false,
    urlFetch: null,
    bodyEnviado: null,
    mensaje: null,
    refreshSolicitado: false,
  }

  const errorLocal = validarModal(cantidad)
  if (errorLocal) {
    estado.error = errorLocal
    return estado
  }

  estado.fetchRealizado = true
  estado.urlFetch = `/api/enfermeria/vacunas/${encodeURIComponent(vacuna.idVacuna)}/stock`
  const body = { stockNuevo: Number(cantidad), motivo }
  estado.bodyEnviado = body

  const res = endpointActualizarStock(db, sesion, vacuna.idVacuna, body, opciones)
  if (res.status !== 200) {
    estado.error = res.body.error || 'No se pudo actualizar el stock.'
    return estado
  }

  estado.mensaje = res.body.mensaje ?? null
  estado.refreshSolicitado = true
  return estado
}

async function runAllTests() {
  console.log('\n=== US-32: PRUEBAS UNITARIAS DE ACTUALIZACIÓN DE STOCK ===\n')

  await test('Esc.1: PUT con cantidad mayor al stock actual devuelve 200, actualiza la vacuna y registra el AJUSTE positivo', () => {
    const db = crearBaseDatos()
    const res = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', {
      stockNuevo: '20',
      motivo: '  recepción de pedido  ',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(res.body.mensaje, 'Stock de "Antigripal" actualizado a 20 dosis.')
    assert.equal(res.body.vacuna?.stock, 20)
    assert.equal(db.vacunas[0].stock, 20)
    assert.equal(db.escrituras, 1)
    assert.equal(consultarHistorialMovimientos(db, 'vac_1').length, 1)
    assert.deepEqual(consultarHistorialMovimientos(db, 'vac_1')[0], {
      idMovimiento: 'mov_1',
      idVacuna: 'vac_1',
      idEnfermero: 'enf_1',
      tipoMovimiento: 'AJUSTE',
      cantidad: 12,
      stockAnterior: 8,
      stockNuevo: 20,
      motivo: 'recepción de pedido',
    })
  })

  await test('Esc.2: Actualización a 0 se acepta y registra un AJUSTE negativo con el motivo por defecto', () => {
    const db = crearBaseDatos()
    const res = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', {
      stockNuevo: 0,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.mensaje, 'Stock de "Antigripal" actualizado a 0 dosis.')
    assert.equal(db.vacunas[0].stock, 0)
    const movimiento = consultarHistorialMovimientos(db, 'vac_1')[0]
    assert.equal(movimiento.cantidad, -8)
    assert.equal(movimiento.stockAnterior, 8)
    assert.equal(movimiento.stockNuevo, 0)
    assert.equal(movimiento.motivo, 'Actualización de stock desde el inventario')
  })

  await test('Esc.3: La actualización se refleja en las consultas de inventario y en el historial de movimientos', () => {
    const db = crearBaseDatos()

    const antes = consultarInventario(db)
    assert.equal(antes[0].stockDisponible, 8)
    assert.equal(antes[0].nivel, 'BAJO')
    assert.deepEqual(consultarHistorialMovimientos(db, 'vac_1'), [])

    endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', { stockNuevo: 20 })

    const despues = consultarInventario(db)
    assert.equal(despues[0].stockDisponible, 20)
    assert.equal(despues[0].nivel, 'NORMAL')
    const movimientos = consultarHistorialMovimientos(db, 'vac_1')
    assert.equal(movimientos.length, 1)
    assert.equal(movimientos[0].tipoMovimiento, 'AJUSTE')
    assert.equal(movimientos[0].stockNuevo, 20)
  })

  await test('Esc.4: Cantidad igual al stock actual devuelve 200 "sin cambios" y no escribe ni audita', () => {
    const db = crearBaseDatos()
    const res = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', {
      stockNuevo: 8,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(
      res.body.mensaje,
      'La cantidad ingresada es igual al stock actual; no hubo cambios.'
    )
    assert.equal(res.body.vacuna?.stock, 8)
    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.movimientos, [])
  })

  await test('Esc.5: Datos inválidos devuelven 400 INVALID_STOCK con los mensajes exactos y sin escribir', () => {
    const db = crearBaseDatos()
    const casos: Array<{ body: unknown; mensaje: string; opciones?: OpcionesEndpoint }> = [
      {
        body: null,
        mensaje: 'Los datos de la actualización son requeridos.',
      },
      {
        body: {},
        mensaje: 'La cantidad debe ser un número entero.',
      },
      {
        body: { stockNuevo: '-10' },
        mensaje: 'La cantidad no puede ser negativa.',
      },
      {
        body: { stockNuevo: -1 },
        mensaje: 'La cantidad no puede ser negativa.',
      },
      {
        body: { stockNuevo: '4.5' },
        mensaje: 'La cantidad debe ser un número entero.',
      },
      {
        body: { stockNuevo: 'abc' },
        mensaje: 'La cantidad debe ser un número entero.',
      },
      {
        body: { stockNuevo: '' },
        mensaje: 'La cantidad debe ser un número entero.',
      },
      {
        body: { stockNuevo: 20 },
        mensaje: 'Los datos de la actualización son requeridos.',
        opciones: { jsonValido: false },
      },
    ]

    for (const caso of casos) {
      const res = endpointActualizarStock(
        db,
        SESION_ENFERMERA,
        'vac_1',
        caso.body,
        caso.opciones
      )
      assert.equal(res.status, 400, `body ${JSON.stringify(caso.body)} debe fallar`)
      assert.equal(res.body.ok, false)
      assert.equal(res.body.code, 'INVALID_STOCK')
      assert.equal(res.body.error, caso.mensaje)
    }

    assert.equal(db.vacunas[0].stock, 8)
    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.movimientos, [])
  })

  await test('Esc.6: Vacuna inexistente devuelve 404 VACCINE_NOT_FOUND sin escribir', () => {
    const db = crearBaseDatos()
    const res = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_inexistente', {
      stockNuevo: 20,
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.ok, false)
    assert.equal(res.body.code, 'VACCINE_NOT_FOUND')
    assert.equal(res.body.error, 'La vacuna indicada no existe.')
    assert.equal(db.escrituras, 0)
  })

  await test('Esc.7: Concurrencia — dos actualizaciones con el mismo stock leído: una aplica y la otra devuelve 409 sin dejar movimiento huérfano', () => {
    const db = crearBaseDatos()

    const primera = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', {
      stockNuevo: 20,
    }, { stockLeido: 8 })
    const segunda = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', {
      stockNuevo: 30,
    }, { stockLeido: 8 })

    assert.equal(primera.status, 200)
    assert.equal(segunda.status, 409)
    assert.equal(segunda.body.code, 'CONCURRENT_MODIFICATION')
    assert.equal(
      segunda.body.error,
      'El stock cambió mientras lo editabas. Volvé a cargar el inventario e intentá de nuevo.'
    )
    assert.equal(db.vacunas[0].stock, 20)
    assert.equal(db.escrituras, 1)
    assert.equal(consultarHistorialMovimientos(db, 'vac_1').length, 1)

    const reintento = endpointActualizarStock(db, SESION_ENFERMERA, 'vac_1', {
      stockNuevo: 30,
    }, { stockLeido: 20 })
    assert.equal(reintento.status, 200)
    assert.equal(db.vacunas[0].stock, 30)
    assert.equal(db.escrituras, 2)
    assert.equal(consultarHistorialMovimientos(db, 'vac_1').length, 2)
  })

  await test('Esc.8: Permisos — sin sesión devuelve 401 y MEDICO, PACIENTE y ADMIN reciben 403 sin escribir', () => {
    const db = crearBaseDatos()

    const sinSesion = endpointActualizarStock(db, null, 'vac_1', { stockNuevo: 20 })
    assert.equal(sinSesion.status, 401)
    assert.equal(
      sinSesion.body.error,
      'No autorizado: sesión no encontrada o perfil inexistente.'
    )

    for (const rol of ['MEDICO', 'PACIENTE', 'ADMIN'] as const) {
      const sesion: SesionMock = { id: `usr_${rol.toLowerCase()}`, nombre: 'Usuario', rol }
      const res = endpointActualizarStock(db, sesion, 'vac_1', { stockNuevo: 20 })
      assert.equal(res.status, 403, `rol ${rol} debe ser bloqueado`)
      assert.equal(res.body.error, 'Acceso denegado: se requiere perfil de enfermería.')
    }

    const aliasEnfermero = endpointActualizarStock(
      db,
      { id: 'enf_2', nombre: 'Ana', rol: 'enfermero' },
      'vac_1',
      { stockNuevo: 20 }
    )
    assert.equal(aliasEnfermero.status, 200)
    assert.equal(db.movimientos[0].idEnfermero, 'enf_2')

    assert.equal(db.vacunas[0].stock, 20)
    assert.equal(db.escrituras, 1)
  })

  await test('Esc.9: El modal valida la cantidad en el cliente y no envía la petición si es inválida', () => {
    const db = crearBaseDatos()
    const vacuna = db.vacunas[0]

    const noEntera = simularModalActualizarStock(db, SESION_ENFERMERA, vacuna, '4.5', '')
    assert.equal(noEntera.error, 'Ingresá una cantidad entera.')
    assert.equal(noEntera.fetchRealizado, false)

    const vacia = simularModalActualizarStock(db, SESION_ENFERMERA, vacuna, '   ', '')
    assert.equal(vacia.error, 'Ingresá una cantidad entera.')
    assert.equal(vacia.fetchRealizado, false)

    const negativa = simularModalActualizarStock(db, SESION_ENFERMERA, vacuna, '-5', '')
    assert.equal(negativa.error, 'La cantidad no puede ser negativa.')
    assert.equal(negativa.fetchRealizado, false)

    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.movimientos, [])
  })

  await test('Esc.10: El modal confirma con la URL correcta, muestra el mensaje del endpoint y solicita refrescar el inventario', () => {
    const db = crearBaseDatos()
    const vacuna = db.vacunas[0]

    const confirmado = simularModalActualizarStock(
      db,
      SESION_ENFERMERA,
      vacuna,
      '20',
      'conteo físico'
    )
    assert.equal(confirmado.fetchRealizado, true)
    assert.equal(
      confirmado.urlFetch,
      '/api/enfermeria/vacunas/vac_1/stock'
    )
    assert.deepEqual(confirmado.bodyEnviado, {
      stockNuevo: 20,
      motivo: 'conteo físico',
    })
    assert.equal(confirmado.error, null)
    assert.equal(confirmado.mensaje, 'Stock de "Antigripal" actualizado a 20 dosis.')
    assert.equal(confirmado.refreshSolicitado, true)
    assert.equal(consultarInventario(db)[0].stockDisponible, 20)
  })

  await test('Esc.11: El modal muestra el error 409 del servidor sin refrescar, y cancelar no escribe', () => {
    const db = crearBaseDatos()
    const vacuna = db.vacunas[0]

    const conflictivo = simularModalActualizarStock(
      db,
      SESION_ENFERMERA,
      vacuna,
      '20',
      '',
      { stockLeido: 5 }
    )
    assert.equal(conflictivo.error, 'El stock cambió mientras lo editabas. Volvé a cargar el inventario e intentá de nuevo.')
    assert.equal(conflictivo.refreshSolicitado, false)
    assert.equal(conflictivo.mensaje, null)
    assert.equal(db.escrituras, 0)

    const cancelado = simularCancelarModal()
    assert.equal(cancelado.guardo, false)
    assert.equal(cancelado.fetchRealizado, false)
    assert.equal(cancelado.refreshSolicitado, false)
    assert.equal(db.vacunas[0].stock, 8)
    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.movimientos, [])
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-32 PASARON EXITOSAMENTE (11/11) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas unitarias de US-32:', error)
  process.exit(1)
})
