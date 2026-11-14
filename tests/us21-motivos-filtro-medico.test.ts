import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MOTIVOS_CANCELACION_ADMINISTRATIVA,
  esMotivoCancelacionValido,
  normalizarFiltroMedico,
} from '../lib/utils/admin-turnos-utils.ts'

describe('US-21: motivos de cancelación administrativa', () => {
  it('acepta todos los motivos de la lista', () => {
    for (const motivo of MOTIVOS_CANCELACION_ADMINISTRATIVA) {
      assert.equal(esMotivoCancelacionValido(motivo), true)
    }
  })

  it('rechaza motivos que no están en la lista', () => {
    assert.equal(esMotivoCancelacionValido('Porque sí'), false)
    assert.equal(esMotivoCancelacionValido(''), false)
  })

  it('rechaza valores que no son texto', () => {
    assert.equal(esMotivoCancelacionValido(undefined), false)
    assert.equal(esMotivoCancelacionValido(null), false)
    assert.equal(esMotivoCancelacionValido(1), false)
    assert.equal(esMotivoCancelacionValido({ motivo: MOTIVOS_CANCELACION_ADMINISTRATIVA[0] }), false)
  })

  it('no acepta variaciones de mayúsculas o espacios', () => {
    const motivo = MOTIVOS_CANCELACION_ADMINISTRATIVA[0]
    assert.equal(esMotivoCancelacionValido(motivo.toUpperCase()), false)
    assert.equal(esMotivoCancelacionValido(` ${motivo} `), false)
  })
})

describe('US-21: filtro por médico', () => {
  it('devuelve el id sin espacios cuando hay valor', () => {
    assert.equal(normalizarFiltroMedico('med_123'), 'med_123')
    assert.equal(normalizarFiltroMedico('  med_123  '), 'med_123')
  })

  it('trata vacío, espacios o ausencia como "sin filtro"', () => {
    assert.equal(normalizarFiltroMedico(''), undefined)
    assert.equal(normalizarFiltroMedico('   '), undefined)
    assert.equal(normalizarFiltroMedico(null), undefined)
    assert.equal(normalizarFiltroMedico(undefined), undefined)
  })
})
