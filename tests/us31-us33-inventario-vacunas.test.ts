import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  coincideBusqueda,
  contarPorFiltro,
  cumpleFiltro,
  diasHastaVencimiento,
  esCategoriaVacuna,
  loteVigente,
  nivelStock,
  porcentajeNivel,
  proximoAVencer,
} from '../lib/utils/inventario-vacunas.ts'
import { validarActualizacionStock, validarAltaVacuna } from '../lib/validation/vacunacion.ts'

const HOY = '2026-11-14'

const ALTA_VALIDA = {
  nombre: '  Antigripal  ',
  categoria: 'ESTACIONAL',
  stockInicial: '50',
  umbralAlerta: '10',
  laboratorio: 'Sanofi Pasteur',
  numeroLote: 'AG-2026-90',
  vencimiento: '2027-10-15',
}

describe('US-31: alta de vacuna', () => {
  it('acepta un alta válida y limpia los espacios', () => {
    const resultado = validarAltaVacuna(ALTA_VALIDA)
    assert.equal(resultado.ok, true)
    assert.equal(resultado.datos?.nombre, 'Antigripal')
    assert.equal(resultado.datos?.stockInicial, 50)
    assert.equal(resultado.datos?.umbralAlerta, 10)
  })

  it('alcanza con nombre y cantidad: la categoría queda en calendario nacional', () => {
    const resultado = validarAltaVacuna({ nombre: 'Antigripal', stockInicial: '50' })
    assert.equal(resultado.ok, true)
    assert.equal(resultado.datos?.categoria, 'CALENDARIO_NACIONAL')
  })

  it('acepta stock inicial 0', () => {
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, stockInicial: 0 }).ok, true)
  })

  it('rechaza stock inicial negativo con un mensaje claro', () => {
    const resultado = validarAltaVacuna({ ...ALTA_VALIDA, stockInicial: '-10' })
    assert.equal(resultado.ok, false)
    assert.match(resultado.error ?? '', /no puede ser negativa/)
  })

  it('rechaza nombre vacío, categoría inválida y cantidades no enteras', () => {
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, nombre: '   ' }).ok, false)
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, categoria: 'INVENTADA' }).ok, false)
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, stockInicial: '4.5' }).ok, false)
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, stockInicial: '' }).ok, false)
  })

  it('usa umbral 10 si no se indica y rechaza umbrales fuera de rango', () => {
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, umbralAlerta: '' }).datos?.umbralAlerta, 10)
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, umbralAlerta: '0' }).ok, false)
  })

  it('exige número de lote si se carga un vencimiento', () => {
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, numeroLote: '' }).ok, false)
    assert.equal(validarAltaVacuna({ ...ALTA_VALIDA, numeroLote: '', vencimiento: '' }).ok, true)
  })

  it('solo acepta categorías conocidas', () => {
    assert.equal(esCategoriaVacuna('CALENDARIO_NACIONAL'), true)
    assert.equal(esCategoriaVacuna('toString'), false)
  })
})

describe('US-32: actualización de stock', () => {
  it('acepta una cantidad nueva de 0 o más', () => {
    assert.deepEqual(validarActualizacionStock({ stockNuevo: '50' }), { ok: true, datos: { stockNuevo: 50, motivo: undefined } })
    assert.equal(validarActualizacionStock({ stockNuevo: 0 }).ok, true)
  })

  it('rechaza cantidades negativas o no enteras', () => {
    const negativa = validarActualizacionStock({ stockNuevo: '-10' })
    assert.equal(negativa.ok, false)
    assert.match(negativa.error ?? '', /no puede ser negativa/)
    assert.equal(validarActualizacionStock({ stockNuevo: 'abc' }).ok, false)
    assert.equal(validarActualizacionStock({}).ok, false)
  })
})

describe('US-33: nivel de stock', () => {
  it('clasifica con el umbral de 10: crítico hasta 5, bajo de 6 a 9, normal desde 10', () => {
    assert.equal(nivelStock(0, 10), 'CRITICO')
    assert.equal(nivelStock(5, 10), 'CRITICO')
    assert.equal(nivelStock(6, 10), 'BAJO')
    assert.equal(nivelStock(9, 10), 'BAJO')
    assert.equal(nivelStock(10, 10), 'NORMAL')
  })

  it('la barra de nivel se mide contra el doble del umbral y no pasa de 100', () => {
    assert.equal(porcentajeNivel(10, 10), 50)
    assert.equal(porcentajeNivel(500, 10), 100)
  })
})

describe('US-33: lotes y vencimientos', () => {
  const lotes = [
    { numeroLote: 'B', stock: 5, vencimiento: '2027-05-01' },
    { numeroLote: 'A', stock: 0, vencimiento: '2026-12-01' },
    { numeroLote: 'C', stock: 3, vencimiento: '2027-01-10' },
  ]

  it('muestra el lote con dosis que vence primero', () => {
    assert.equal(loteVigente(lotes)?.numeroLote, 'C')
    assert.equal(loteVigente([]), null)
  })

  it('cuenta los días hasta el vencimiento', () => {
    assert.equal(diasHastaVencimiento('2026-11-24', HOY), 10)
    assert.equal(diasHastaVencimiento('2026-11-13', HOY), -1)
  })

  it('es próximo a vencer si un lote con dosis vence en 90 días o menos', () => {
    assert.equal(proximoAVencer(lotes, HOY), true)
    assert.equal(proximoAVencer([{ numeroLote: 'A', stock: 0, vencimiento: '2026-12-01' }], HOY), false)
    assert.equal(proximoAVencer([{ numeroLote: 'X', stock: 4, vencimiento: null }], HOY), false)
  })
})

describe('US-33: filtros y búsqueda', () => {
  const vacunas = [
    { nombre: 'Antigripal', stock: 4, umbralAlerta: 10, lotes: [{ numeroLote: 'AG-2026-90', stock: 4, vencimiento: '2027-11-01' }] },
    { nombre: 'Triple Viral', stock: 8, umbralAlerta: 10, lotes: [] },
    { nombre: 'Hepatitis B', stock: 45, umbralAlerta: 10, lotes: [{ numeroLote: 'HB-1', stock: 45, vencimiento: '2026-12-20' }] },
  ]

  it('filtra por stock crítico / bajo, normal y próximo a vencer', () => {
    const nombres = (filtro: Parameters<typeof cumpleFiltro>[1]) =>
      vacunas.filter((v) => cumpleFiltro(v, filtro, HOY)).map((v) => v.nombre)
    assert.deepEqual(nombres('CRITICO_BAJO'), ['Antigripal', 'Triple Viral'])
    assert.deepEqual(nombres('NORMAL'), ['Hepatitis B'])
    assert.deepEqual(nombres('PROXIMO_A_VENCER'), ['Hepatitis B'])
    assert.equal(nombres('TODOS').length, 3)
  })

  it('cuenta cuántas vacunas entran en cada filtro', () => {
    assert.deepEqual(contarPorFiltro(vacunas, HOY), { TODOS: 3, CRITICO_BAJO: 2, NORMAL: 1, PROXIMO_A_VENCER: 1 })
  })

  it('busca por nombre o lote sin importar mayúsculas ni acentos', () => {
    assert.equal(coincideBusqueda(vacunas[2], 'hepatitis'), true)
    assert.equal(coincideBusqueda(vacunas[0], 'ag-2026'), true)
    assert.equal(coincideBusqueda({ ...vacunas[0], nombre: 'Tétanos' }, 'TETANOS'), true)
    assert.equal(coincideBusqueda(vacunas[1], 'polio'), false)
    assert.equal(coincideBusqueda(vacunas[1], '   '), true)
  })
})
