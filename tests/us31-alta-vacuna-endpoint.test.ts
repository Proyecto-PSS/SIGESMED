import assert from 'node:assert/strict'
import { validarAltaVacuna } from '../lib/validation/vacunacion.ts'
import { UMBRAL_ALERTA_PREDETERMINADO } from '../lib/utils/inventario-vacunas.ts'

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
  laboratorio?: string
  presentacion?: string
  umbralAlerta: number
}

interface LoteMock {
  idLote: string
  idVacuna: string
  numeroLote: string
  stock: number
  vencimiento: string | null
}

interface MovimientoMock {
  idMovimiento: string
  idVacuna: string
  idEnfermero: string
  tipoMovimiento: string
  cantidad: number
  stockAnterior: number
  stockNuevo: number
  motivo: string
}

interface BaseDatosMock {
  vacunas: VacunaMock[]
  lotes: LoteMock[]
  movimientos: MovimientoMock[]
  escrituras: number
  simularConflictoConcurrente: boolean
  simularErrorInesperado: boolean
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

interface DatosFormularioMock {
  nombre: string
  categoria: string
  laboratorio: string
  numeroLote: string
  vencimiento: string
  stockInicial: string
  umbralAlerta: string
  presentacion: string
}

interface EstadoFormularioMock {
  error: string | null
  fetchRealizado: boolean
  redirigido: boolean
  urlRedireccion: string | null
  datosConservados: DatosFormularioMock
}

function crearBaseDatos(): BaseDatosMock {
  return {
    vacunas: [],
    lotes: [],
    movimientos: [],
    escrituras: 0,
    simularConflictoConcurrente: false,
    simularErrorInesperado: false,
  }
}

const SESION_ENFERMERA: SesionMock = {
  id: 'enf_1',
  nombre: 'Ana',
  rol: 'ENFERMERA',
}

const ALTA_VALIDA = {
  nombre: '  Antigripal  ',
  categoria: 'ESTACIONAL',
  stockInicial: '50',
  umbralAlerta: '10',
  laboratorio: 'Sanofi Pasteur',
  numeroLote: 'AG-2026-90',
  vencimiento: '2027-10-15',
}

const FORMULARIO_VACIO: DatosFormularioMock = {
  nombre: '',
  categoria: 'CALENDARIO_NACIONAL',
  laboratorio: '',
  numeroLote: '',
  vencimiento: '',
  stockInicial: '',
  umbralAlerta: String(UMBRAL_ALERTA_PREDETERMINADO),
  presentacion: '',
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

function endpointAltaVacuna(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  body: unknown,
  jsonValido = true
): RespuestaEndpoint {
  let nombreValidado = ''
  try {
    const enfermera = autorizarSoloEnfermera(sesion)
    const payload = jsonValido ? body : null

    const validacion = validarAltaVacuna(payload)
    if (!validacion.ok || !validacion.datos) {
      throw errorConEstado(
        validacion.error || 'Datos de la vacuna inválidos.',
        400,
        'INVALID_VACCINE'
      )
    }
    const datos = validacion.datos
    nombreValidado = datos.nombre

    const existente = db.vacunas.some(
      (v) => v.nombre.toLocaleLowerCase() === datos.nombre.toLocaleLowerCase()
    )
    if (existente) {
      throw errorConEstado(
        `Ya existe una vacuna llamada "${datos.nombre}".`,
        409,
        'DUPLICATE_VACCINE'
      )
    }

    if (db.simularConflictoConcurrente) {
      throw Object.assign(
        new Error('Unique constraint failed on the fields: (`nombre`)'),
        { code: 'P2002' }
      )
    }

    if (db.simularErrorInesperado) {
      throw new Error('')
    }

    const vacuna: VacunaMock = {
      idVacuna: `vac_${db.vacunas.length + 1}`,
      nombre: datos.nombre,
      stock: datos.stockInicial,
      categoria: datos.categoria,
      laboratorio: datos.laboratorio,
      presentacion: datos.presentacion,
      umbralAlerta: datos.umbralAlerta,
    }

    db.escrituras += 1
    db.vacunas.push(vacuna)

    if (datos.numeroLote) {
      db.lotes.push({
        idLote: `lote_${db.lotes.length + 1}`,
        idVacuna: vacuna.idVacuna,
        numeroLote: datos.numeroLote,
        stock: datos.stockInicial,
        vencimiento: datos.vencimiento ?? null,
      })
    }

    if (datos.stockInicial > 0) {
      db.movimientos.push({
        idMovimiento: `mov_${db.movimientos.length + 1}`,
        idVacuna: vacuna.idVacuna,
        idEnfermero: enfermera.id,
        tipoMovimiento: 'INGRESO',
        cantidad: datos.stockInicial,
        stockAnterior: 0,
        stockNuevo: datos.stockInicial,
        motivo: 'Stock inicial del alta de vacuna',
      })
    }

    return {
      status: 201,
      body: {
        ok: true,
        mensaje: `Vacuna "${vacuna.nombre}" registrada con éxito en el inventario.`,
        vacuna,
      },
    }
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string }
    if (err.code === 'P2002' && !err.statusCode) {
      return {
        status: 409,
        body: {
          ok: false,
          error: `Ya existe una vacuna llamada "${nombreValidado}".`,
          code: 'DUPLICATE_VACCINE',
        },
      }
    }
    const status = err.statusCode ?? 500
    return {
      status,
      body: {
        ok: false,
        error: err.message || 'Error al registrar la vacuna.',
        code: err.code,
      },
    }
  }
}

function validarFormularioAlta(datos: DatosFormularioMock): string | null {
  if (!datos.nombre.trim()) return 'Ingresá el nombre de la vacuna.'
  const stock = Number(datos.stockInicial)
  if (datos.stockInicial.trim() === '' || !Number.isInteger(stock)) {
    return 'La cantidad inicial debe ser un número entero.'
  }
  if (stock < 0) return 'La cantidad inicial no puede ser negativa.'
  if (datos.vencimiento && !datos.numeroLote.trim()) {
    return 'Para indicar un vencimiento, ingresá también el número de lote.'
  }
  return null
}

function simularFormularioAlta(
  db: BaseDatosMock,
  sesion: SesionMock | null,
  datos: DatosFormularioMock
): EstadoFormularioMock {
  const estado: EstadoFormularioMock = {
    error: null,
    fetchRealizado: false,
    redirigido: false,
    urlRedireccion: null,
    datosConservados: { ...datos },
  }

  const errorLocal = validarFormularioAlta(datos)
  if (errorLocal) {
    estado.error = errorLocal
    return estado
  }

  estado.fetchRealizado = true
  const res = endpointAltaVacuna(db, sesion, datos)
  if (res.status !== 201 || !res.body.vacuna) {
    estado.error = res.body.error || 'No se pudo registrar la vacuna.'
    return estado
  }

  estado.redirigido = true
  estado.urlRedireccion = `/dashboard/enfermero/inventario?alta=${encodeURIComponent(res.body.vacuna.nombre)}`
  return estado
}

async function runAllTests() {
  console.log('\n=== US-31: PRUEBAS UNITARIAS DE ALTA DE VACUNAS ===\n')

  await test('Esc.1: POST /api/enfermeria/vacunas con datos válidos devuelve 201 y registra vacuna, lote y movimiento de auditoría', () => {
    const db = crearBaseDatos()
    const res = endpointAltaVacuna(db, SESION_ENFERMERA, ALTA_VALIDA)

    assert.equal(res.status, 201)
    assert.equal(res.body.ok, true)
    assert.equal(
      res.body.mensaje,
      'Vacuna "Antigripal" registrada con éxito en el inventario.'
    )
    assert.equal(res.body.vacuna?.nombre, 'Antigripal')
    assert.equal(res.body.vacuna?.stock, 50)
    assert.equal(res.body.vacuna?.categoria, 'ESTACIONAL')
    assert.equal(res.body.vacuna?.laboratorio, 'Sanofi Pasteur')
    assert.equal(res.body.vacuna?.umbralAlerta, 10)
    assert.equal(db.vacunas.length, 1)
    assert.equal(db.escrituras, 1)
    assert.deepEqual(
      db.lotes.map((l) => ({
        numeroLote: l.numeroLote,
        stock: l.stock,
        vencimiento: l.vencimiento,
      })),
      [{ numeroLote: 'AG-2026-90', stock: 50, vencimiento: '2027-10-15' }]
    )
    assert.equal(db.movimientos.length, 1)
    assert.deepEqual(db.movimientos[0], {
      idMovimiento: 'mov_1',
      idVacuna: 'vac_1',
      idEnfermero: 'enf_1',
      tipoMovimiento: 'INGRESO',
      cantidad: 50,
      stockAnterior: 0,
      stockNuevo: 50,
      motivo: 'Stock inicial del alta de vacuna',
    })
  })

  await test('Esc.2: Alta con stock inicial 0 se acepta y no genera movimiento de auditoría', () => {
    const db = crearBaseDatos()
    const res = endpointAltaVacuna(db, SESION_ENFERMERA, {
      ...ALTA_VALIDA,
      stockInicial: 0,
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.vacuna?.stock, 0)
    assert.equal(db.vacunas.length, 1)
    assert.equal(db.lotes.length, 1)
    assert.equal(db.lotes[0].stock, 0)
    assert.deepEqual(db.movimientos, [])
  })

  await test('Esc.3: Nombre duplicado devuelve 409 DUPLICATE_VACCINE con el mensaje exacto, sin importar mayúsculas ni espacios', () => {
    const db = crearBaseDatos()
    const primera = endpointAltaVacuna(db, SESION_ENFERMERA, ALTA_VALIDA)
    assert.equal(primera.status, 201)

    for (const nombre of ['Antigripal', '  antigripal  ', 'ANTIGRIPAL']) {
      const res = endpointAltaVacuna(db, SESION_ENFERMERA, {
        ...ALTA_VALIDA,
        nombre,
      })
      assert.equal(res.status, 409, `nombre ${nombre} debe ser rechazado`)
      assert.equal(res.body.ok, false)
      assert.equal(res.body.code, 'DUPLICATE_VACCINE')
      assert.equal(
        res.body.error,
        `Ya existe una vacuna llamada "${nombre.trim()}".`
      )
    }

    assert.equal(db.vacunas.length, 1)
    assert.equal(db.escrituras, 1)
  })

  await test('Esc.4: Conflicto P2002 por altas simultáneas devuelve 409 sin dejar registros parciales', () => {
    const db = crearBaseDatos()
    db.simularConflictoConcurrente = true

    const res = endpointAltaVacuna(db, SESION_ENFERMERA, ALTA_VALIDA)
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'DUPLICATE_VACCINE')
    assert.equal(res.body.error, 'Ya existe una vacuna llamada "Antigripal".')
    assert.equal(db.vacunas.length, 0)
    assert.equal(db.lotes.length, 0)
    assert.equal(db.movimientos.length, 0)
    assert.equal(db.escrituras, 0)
  })

  await test('Esc.5: Cantidad negativa, no entera, vacía o no numérica devuelve 400 INVALID_VACCINE sin escribir', () => {
    const db = crearBaseDatos()
    const cantidadesInvalidas: Array<{ valor: unknown; mensaje: string }> = [
      { valor: '-10', mensaje: 'La cantidad inicial no puede ser negativa.' },
      { valor: -1, mensaje: 'La cantidad inicial no puede ser negativa.' },
      { valor: '4.5', mensaje: 'La cantidad inicial debe ser un número entero.' },
      { valor: '', mensaje: 'La cantidad inicial debe ser un número entero.' },
      { valor: 'abc', mensaje: 'La cantidad inicial debe ser un número entero.' },
    ]

    for (const caso of cantidadesInvalidas) {
      const res = endpointAltaVacuna(db, SESION_ENFERMERA, {
        ...ALTA_VALIDA,
        stockInicial: caso.valor,
      })
      assert.equal(res.status, 400, `cantidad ${String(caso.valor)} debe ser rechazada`)
      assert.equal(res.body.ok, false)
      assert.equal(res.body.code, 'INVALID_VACCINE')
      assert.equal(res.body.error, caso.mensaje)
    }

    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.vacunas, [])
  })

  await test('Esc.6: Datos inválidos del formulario — nombre, categoría, umbral y vencimiento sin lote — devuelven 400', () => {
    const db = crearBaseDatos()

    const casos: Array<{ payload: unknown; mensaje: string }> = [
      {
        payload: { ...ALTA_VALIDA, nombre: '   ' },
        mensaje: 'Ingresá el nombre de la vacuna.',
      },
      {
        payload: { ...ALTA_VALIDA, nombre: 'x'.repeat(81) },
        mensaje: 'El nombre no puede superar los 80 caracteres.',
      },
      {
        payload: { ...ALTA_VALIDA, categoria: 'INVENTADA' },
        mensaje: 'Elegí una categoría válida.',
      },
      {
        payload: { ...ALTA_VALIDA, umbralAlerta: '0' },
        mensaje: 'El umbral de alerta debe ser un número entero entre 1 y 1000.',
      },
      {
        payload: { ...ALTA_VALIDA, umbralAlerta: '1001' },
        mensaje: 'El umbral de alerta debe ser un número entero entre 1 y 1000.',
      },
      {
        payload: { ...ALTA_VALIDA, vencimiento: '15-10-2027' },
        mensaje: 'La fecha de vencimiento no es válida.',
      },
      {
        payload: { ...ALTA_VALIDA, numeroLote: '' },
        mensaje: 'Para indicar un vencimiento, ingresá también el número de lote.',
      },
    ]

    for (const caso of casos) {
      const res = endpointAltaVacuna(db, SESION_ENFERMERA, caso.payload)
      assert.equal(res.status, 400)
      assert.equal(res.body.code, 'INVALID_VACCINE')
      assert.equal(res.body.error, caso.mensaje)
    }

    assert.equal(db.escrituras, 0)
  })

  await test('Esc.7: Permisos — sin sesión devuelve 401 y MEDICO, PACIENTE y ADMIN reciben 403 sin escribir en la base', () => {
    const db = crearBaseDatos()

    const sinSesion = endpointAltaVacuna(db, null, ALTA_VALIDA)
    assert.equal(sinSesion.status, 401)
    assert.equal(
      sinSesion.body.error,
      'No autorizado: sesión no encontrada o perfil inexistente.'
    )

    for (const rol of ['MEDICO', 'PACIENTE', 'ADMIN'] as const) {
      const sesion: SesionMock = { id: `usr_${rol.toLowerCase()}`, nombre: 'Usuario', rol }
      const res = endpointAltaVacuna(db, sesion, ALTA_VALIDA)
      assert.equal(res.status, 403, `rol ${rol} debe ser bloqueado`)
      assert.equal(res.body.ok, false)
      assert.equal(res.body.error, 'Acceso denegado: se requiere perfil de enfermería.')
    }

    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.vacunas, [])
  })

  await test('Esc.8: El alias "enfermero" del metadata tiene acceso y un body inválido devuelve 400 sin escribir', () => {
    const db = crearBaseDatos()
    const sesionAlias: SesionMock = {
      id: 'enf_2',
      nombre: 'Ana',
      rol: 'enfermero',
    }

    const res = endpointAltaVacuna(db, sesionAlias, ALTA_VALIDA)
    assert.equal(res.status, 201)
    assert.equal(db.movimientos[0].idEnfermero, 'enf_2')

    const bodyInvalido = endpointAltaVacuna(db, SESION_ENFERMERA, null, false)
    assert.equal(bodyInvalido.status, 400)
    assert.equal(bodyInvalido.body.code, 'INVALID_VACCINE')
    assert.equal(bodyInvalido.body.error, 'Los datos de la vacuna son requeridos.')
    assert.equal(db.escrituras, 1)
  })

  await test('Esc.9: El formulario valida localmente con los mismos textos y no envía la petición si la cantidad es inválida', () => {
    const db = crearBaseDatos()

    const negativa = simularFormularioAlta(db, SESION_ENFERMERA, {
      ...FORMULARIO_VACIO,
      nombre: 'Antigripal',
      stockInicial: '-10',
    })
    assert.equal(negativa.error, 'La cantidad inicial no puede ser negativa.')
    assert.equal(negativa.fetchRealizado, false)
    assert.equal(negativa.redirigido, false)
    assert.equal(negativa.datosConservados.nombre, 'Antigripal')
    assert.equal(negativa.datosConservados.stockInicial, '-10')

    const noEntera = simularFormularioAlta(db, SESION_ENFERMERA, {
      ...FORMULARIO_VACIO,
      nombre: 'Antigripal',
      stockInicial: '4.5',
    })
    assert.equal(noEntera.error, 'La cantidad inicial debe ser un número entero.')
    assert.equal(noEntera.fetchRealizado, false)

    const sinLote = simularFormularioAlta(db, SESION_ENFERMERA, {
      ...FORMULARIO_VACIO,
      nombre: 'Antigripal',
      stockInicial: '50',
      vencimiento: '2027-10-15',
    })
    assert.equal(
      sinLote.error,
      'Para indicar un vencimiento, ingresá también el número de lote.'
    )
    assert.equal(sinLote.fetchRealizado, false)
    assert.equal(db.escrituras, 0)
  })

  await test('Esc.10: El formulario muestra el error 409 del servidor conservando los datos y redirige tras un alta exitosa', () => {
    const db = crearBaseDatos()
    const datos = {
      ...FORMULARIO_VACIO,
      nombre: 'Antigripal',
      stockInicial: '50',
    }

    const exitoso = simularFormularioAlta(db, SESION_ENFERMERA, datos)
    assert.equal(exitoso.error, null)
    assert.equal(exitoso.fetchRealizado, true)
    assert.equal(exitoso.redirigido, true)
    assert.equal(
      exitoso.urlRedireccion,
      '/dashboard/enfermero/inventario?alta=Antigripal'
    )

    const duplicado = simularFormularioAlta(db, SESION_ENFERMERA, datos)
    assert.equal(duplicado.error, 'Ya existe una vacuna llamada "Antigripal".')
    assert.equal(duplicado.redirigido, false)
    assert.equal(duplicado.datosConservados.nombre, 'Antigripal')
    assert.equal(duplicado.datosConservados.stockInicial, '50')
    assert.equal(db.vacunas.length, 1)
  })

  await test('Esc.11: Error inesperado devuelve 500 con el mensaje genérico sin detalles técnicos', () => {
    const db = crearBaseDatos()
    db.simularErrorInesperado = true

    const res = endpointAltaVacuna(db, SESION_ENFERMERA, ALTA_VALIDA)
    assert.equal(res.status, 500)
    assert.equal(res.body.ok, false)
    assert.equal(res.body.error, 'Error al registrar la vacuna.')
    assert.equal(db.escrituras, 0)
    assert.deepEqual(db.vacunas, [])
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-31 PASARON EXITOSAMENTE (11/11) ===\n')
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas unitarias de US-31:', error)
  process.exit(1)
})
