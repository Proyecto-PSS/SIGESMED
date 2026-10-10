import assert from 'node:assert/strict'
import { puedeRegistrarProfesionales, validarAltaProfesional } from '../lib/validation/profesional.ts'

function test(nombre: string, run: () => void) {
  run()
  process.stdout.write(`✓ ${nombre}\n`)
}

test('normaliza y valida los datos del alta de médico', () => {
  const result = validarAltaProfesional('medico', {
    nombre: ' Ana ', apellido: ' Pérez ', email: ' ANA@EXAMPLE.COM ', matricula: ' MN-123 ',
    especialidad: 'PEDIATRIA',
  })
  assert.deepEqual(result, {
    ok: true,
    datos: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', matricula: 'MN-123', especialidad: 'PEDIATRIA' },
  })
})

test('valida los datos del alta de enfermería sin pedir especialidad', () => {
  const result = validarAltaProfesional('enfermera', {
    nombre: 'Laura', apellido: 'Díaz', email: 'laura@example.com', matricula: 'LEG-987',
  })
  assert.deepEqual(result, {
    ok: true,
    datos: { nombre: 'Laura', apellido: 'Díaz', email: 'laura@example.com', matricula: 'LEG-987' },
  })
})

test('rechaza médicos sin especialidad válida y datos incompletos', () => {
  assert.equal(validarAltaProfesional('medico', {
    nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', matricula: 'MN-1', especialidad: 'OTRA',
  }).ok, false)
  assert.equal(validarAltaProfesional('enfermera', { nombre: 'Laura' }).ok, false)
})

test('solo el rol admin puede dar de alta profesionales', () => {
  assert.equal(puedeRegistrarProfesionales('admin'), true)
  assert.equal(puedeRegistrarProfesionales('medico'), false)
  assert.equal(puedeRegistrarProfesionales(undefined), false)
})
