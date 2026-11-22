// Suite de pruebas unitarias para US-41:
// Clasificación de alertas de stock bajo, ordenamiento, bordes y consistencia con el inventario.
import assert from 'node:assert/strict'
import { clasificarStockVacunas } from '../lib/utils/reportes-utils.ts'
import { nivelStock } from '../lib/utils/inventario-vacunas.ts'

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

async function runAllTests() {
  console.log('\n=== US-41: PRUEBAS DE REPORTE DE STOCK DE VACUNAS ===\n')

  await test('Esc.1: Marca stockBajo = true solo cuando stock < umbralAlerta (borde exacto incluido)', () => {
    const entrada = [
      { idVacuna: 'v1', nombre: 'Sin stock', stock: 0, umbralAlerta: 10 },
      { idVacuna: 'v2', nombre: 'Justo debajo', stock: 9, umbralAlerta: 10 },
      { idVacuna: 'v3', nombre: 'En el umbral exacto', stock: 10, umbralAlerta: 10 },
      { idVacuna: 'v4', nombre: 'Sobre el umbral', stock: 25, umbralAlerta: 10 },
      { idVacuna: 'v5', nombre: 'Umbral personalizado bajo', stock: 14, umbralAlerta: 15 },
      { idVacuna: 'v6', nombre: 'Umbral mínimo (1) en cero', stock: 0, umbralAlerta: 1 },
      { idVacuna: 'v7', nombre: 'Umbral mínimo (1) en uno', stock: 1, umbralAlerta: 1 },
    ]

    const resultado = clasificarStockVacunas(entrada)
    const porId = new Map(resultado.map((v) => [v.idVacuna, v]))

    assert.equal(porId.get('v1')?.stockBajo, true)
    assert.equal(porId.get('v2')?.stockBajo, true)
    assert.equal(porId.get('v3')?.stockBajo, false, 'Cuando stock === umbralAlerta no debe marcar stock bajo')
    assert.equal(porId.get('v4')?.stockBajo, false)
    assert.equal(porId.get('v5')?.stockBajo, true)
    assert.equal(porId.get('v6')?.stockBajo, true)
    assert.equal(porId.get('v7')?.stockBajo, false)
  })

  await test('Esc.2: Coincide estrictamente con el criterio de alerta de enfermería (nivelStock !== NORMAL)', () => {
    const combinaciones = [
      { stock: 0, umbralAlerta: 1 },
      { stock: 1, umbralAlerta: 1 },
      { stock: 3, umbralAlerta: 7 },
      { stock: 4, umbralAlerta: 7 },
      { stock: 7, umbralAlerta: 7 },
      { stock: 5, umbralAlerta: 10 },
      { stock: 6, umbralAlerta: 10 },
      { stock: 9, umbralAlerta: 10 },
      { stock: 10, umbralAlerta: 10 },
      { stock: 50, umbralAlerta: 20 },
    ]

    const vacunas = combinaciones.map((c, i) => ({
      idVacuna: `vac_${i}`,
      nombre: `Vacuna ${i}`,
      ...c,
    }))

    const clasificadas = clasificarStockVacunas(vacunas)

    for (const v of clasificadas) {
      const esAlertaEnfermeria = nivelStock(v.stock, v.umbralAlerta) !== 'NORMAL'
      assert.equal(
        v.stockBajo,
        esAlertaEnfermeria,
        `Desfasaje entre reporte y enfermería para stock=${v.stock}, umbral=${v.umbralAlerta}`
      )
    }
  })

  await test('Esc.3: Ordena de menor a mayor stock y desempata alfabéticamente en español (tildes y ñ)', () => {
    const entrada = [
      { idVacuna: 'v_alta', nombre: 'Triple Viral', stock: 20, umbralAlerta: 10 },
      { idVacuna: 'v_cero_b', nombre: 'Hepatitis B', stock: 0, umbralAlerta: 10 },
      { idVacuna: 'v_cero_a', nombre: 'Ántrax', stock: 0, umbralAlerta: 10 },
      { idVacuna: 'v_media_o', nombre: 'Oral Polio', stock: 5, umbralAlerta: 10 },
      { idVacuna: 'v_media_n', nombre: 'Neumococo', stock: 5, umbralAlerta: 10 },
      { idVacuna: 'v_media_enie', nombre: 'Ñandú Experimental', stock: 5, umbralAlerta: 10 },
    ]

    const resultado = clasificarStockVacunas(entrada)

    assert.deepEqual(
      resultado.map((v) => v.nombre),
      [
        'Ántrax',
        'Hepatitis B',
        'Neumococo',
        'Ñandú Experimental',
        'Oral Polio',
        'Triple Viral',
      ]
    )
  })

  await test('Esc.4: Maneja catálogo vacío sin arrojar excepciones', () => {
    const resultado = clasificarStockVacunas([])
    assert.deepEqual(resultado, [])
  })

  await test('Esc.5: Preserva integridad exacta del DTO y no muta el arreglo ni los objetos de entrada', () => {
    const itemA = { idVacuna: 'id_2', nombre: 'Fiebre Amarilla', stock: 12, umbralAlerta: 10 }
    const itemB = { idVacuna: 'id_1', nombre: 'Antigripal', stock: 3, umbralAlerta: 10 }
    const entrada = [itemA, itemB]
    const copiaOriginal = structuredClone(entrada)

    const resultado = clasificarStockVacunas(entrada)

    assert.deepEqual(entrada, copiaOriginal, 'El arreglo original no debe ser reordenado ni mutado')
    assert.equal('stockBajo' in itemA, false, 'Los objetos de entrada no deben ser mutados')
    assert.deepEqual(Object.keys(resultado[0]).sort(), [
      'idVacuna',
      'nombre',
      'stock',
      'stockBajo',
      'umbralAlerta',
    ])
    assert.deepEqual(resultado[0], {
      idVacuna: 'id_1',
      nombre: 'Antigripal',
      stock: 3,
      umbralAlerta: 10,
      stockBajo: true,
    })
  })

  await test('Esc.6: Documenta ordenamiento por cantidad absoluta de stock ante umbrales heterogéneos', () => {
    const entrada = [
      { idVacuna: 'v_alerta_alta', nombre: 'Vacuna A (en alerta)', stock: 12, umbralAlerta: 20 },
      { idVacuna: 'v_normal_baja', nombre: 'Vacuna B (normal)', stock: 11, umbralAlerta: 10 },
    ]

    const resultado = clasificarStockVacunas(entrada)

    // Actualmente ordena por stock ascendente (11 antes que 12) aunque la de 12 tenga stockBajo: true
    assert.equal(resultado[0].idVacuna, 'v_normal_baja')
    assert.equal(resultado[0].stockBajo, false)
    assert.equal(resultado[1].idVacuna, 'v_alerta_alta')
    assert.equal(resultado[1].stockBajo, true)
  })

  console.log('\n=== TODAS LAS PRUEBAS DE US-41 PASARON EXITOSAMENTE (6/6) ===\n')
}

runAllTests().catch((err) => {
  console.error('\n❌ Error en las pruebas de US-41:', err)
  process.exit(1)
})