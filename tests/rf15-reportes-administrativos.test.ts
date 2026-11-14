import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparTurnosPorEspecialidad,
  calcularAsistencia,
  clasificarStockVacunas,
  fechaHoyArgentina,
  limitesInstantesArgentina,
  porcentaje,
  rangoUltimosDias,
  resolverRangoReporte,
  resumirPagos,
} from '../lib/utils/reportes-utils.ts'

const ESPECIALIDADES = ['CLINICA_MEDICA', 'PEDIATRIA', 'TRAUMATOLOGIA_ORTOPEDIA']
// 14/11/2026 01:00 UTC = 13/11/2026 22:00 en Argentina
const AHORA = new Date('2026-11-14T01:00:00.000Z')

describe('RF-15: rango de fechas del reporte', () => {
  it('toma la fecha de hoy en hora argentina, no en UTC', () => {
    assert.equal(fechaHoyArgentina(AHORA), '2026-11-13')
  })

  it('los últimos N días incluyen el día de hoy', () => {
    assert.deepEqual(rangoUltimosDias(7, AHORA), { desde: '2026-11-07', hasta: '2026-11-13' })
    assert.deepEqual(rangoUltimosDias(1, AHORA), { desde: '2026-11-13', hasta: '2026-11-13' })
  })

  it('sin fechas usa los últimos 30 días', () => {
    const resultado = resolverRangoReporte(null, null, AHORA)
    assert.deepEqual(resultado, { ok: true, rango: { desde: '2026-10-15', hasta: '2026-11-13' } })
  })

  it('rechaza rangos incompletos, inválidos o invertidos', () => {
    assert.equal(resolverRangoReporte('2026-11-01', null, AHORA).ok, false)
    assert.equal(resolverRangoReporte('01/11/2026', '2026-11-10', AHORA).ok, false)
    assert.equal(resolverRangoReporte('2026-11-10', '2026-11-01', AHORA).ok, false)
  })

  it('acepta un rango válido de un solo día', () => {
    const resultado = resolverRangoReporte('2026-11-05', '2026-11-05', AHORA)
    assert.deepEqual(resultado, { ok: true, rango: { desde: '2026-11-05', hasta: '2026-11-05' } })
  })

  it('cubre los días completos en hora argentina (UTC-3)', () => {
    const { inicio, fin } = limitesInstantesArgentina({ desde: '2026-11-01', hasta: '2026-11-02' })
    assert.equal(inicio.toISOString(), '2026-11-01T03:00:00.000Z')
    assert.equal(fin.toISOString(), '2026-11-03T03:00:00.000Z')
  })
})

describe('RF-15: turnos por especialidad', () => {
  it('suma los estados por especialidad y ordena de mayor a menor', () => {
    const resultado = agruparTurnosPorEspecialidad(
      [
        { especialidad: 'PEDIATRIA', estado: 'CONFIRMADO', cantidad: 3 },
        { especialidad: 'PEDIATRIA', estado: 'ATENDIDO', cantidad: 4 },
        { especialidad: 'CLINICA_MEDICA', estado: 'AUSENTE', cantidad: 2 },
        { especialidad: 'PEDIATRIA', estado: 'CONFIRMADO', cantidad: 1 },
      ],
      ESPECIALIDADES
    )
    assert.deepEqual(
      resultado.map((r) => [r.especialidad, r.total]),
      [['PEDIATRIA', 8], ['CLINICA_MEDICA', 2], ['TRAUMATOLOGIA_ORTOPEDIA', 0]]
    )
    assert.equal(resultado[0].porEstado.CONFIRMADO, 4)
    assert.equal(resultado[0].porEstado.ATENDIDO, 4)
  })

  it('incluye las especialidades sin turnos e ignora los turnos disponibles', () => {
    const resultado = agruparTurnosPorEspecialidad(
      [{ especialidad: 'PEDIATRIA', estado: 'DISPONIBLE', cantidad: 10 }],
      ESPECIALIDADES
    )
    assert.equal(resultado.length, 3)
    assert.ok(resultado.every((r) => r.total === 0))
  })
})

describe('RF-15: asistencia de pacientes', () => {
  it('calcula el porcentaje solo sobre atendidos y ausentes', () => {
    const turnos = agruparTurnosPorEspecialidad(
      [
        { especialidad: 'PEDIATRIA', estado: 'ATENDIDO', cantidad: 9 },
        { especialidad: 'CLINICA_MEDICA', estado: 'AUSENTE', cantidad: 3 },
        { especialidad: 'CLINICA_MEDICA', estado: 'CONFIRMADO', cantidad: 20 },
        { especialidad: 'CLINICA_MEDICA', estado: 'CANCELADO', cantidad: 5 },
      ],
      ESPECIALIDADES
    )
    assert.deepEqual(calcularAsistencia(turnos), {
      asistieron: 9,
      ausentes: 3,
      total: 12,
      porcentajeAsistencia: 75,
    })
  })

  it('sin turnos resueltos el porcentaje queda vacío (no 0%)', () => {
    assert.equal(calcularAsistencia([]).porcentajeAsistencia, null)
    assert.equal(porcentaje(0, 0), null)
  })

  it('redondea el porcentaje a entero', () => {
    assert.equal(porcentaje(2, 3), 67)
  })
})

describe('RF-15: pagos realizados', () => {
  it('solo los aprobados suman al monto recaudado', () => {
    const resumen = resumirPagos([
      { estado: 'APROBADO', cantidad: 4, monto: 60000 },
      { estado: 'RECHAZADO', cantidad: 2, monto: 30000 },
      { estado: 'ERROR', cantidad: 1, monto: 15000 },
      { estado: 'PENDIENTE', cantidad: 1, monto: 15000 },
      { estado: 'PROCESANDO', cantidad: 1, monto: 15000 },
    ])
    assert.deepEqual(resumen, {
      montoAprobado: 60000,
      aprobados: 4,
      rechazados: 3,
      pendientes: 2,
      ticketPromedio: 15000,
    })
  })

  it('sin pagos aprobados no hay monto promedio', () => {
    assert.equal(resumirPagos([]).ticketPromedio, null)
    assert.equal(resumirPagos([]).montoAprobado, 0)
  })
})

describe('RF-15: stock de vacunas', () => {
  it('marca como críticas las vacunas con stock menor o igual al umbral', () => {
    const resultado = clasificarStockVacunas([
      { idVacuna: 'v1', nombre: 'Gripe', stock: 40 },
      { idVacuna: 'v2', nombre: 'Hepatitis B', stock: 2 },
      { idVacuna: 'v3', nombre: 'Tétanos', stock: 0 },
      { idVacuna: 'v4', nombre: 'Sarampión', stock: 3 },
    ])
    assert.deepEqual(
      resultado.map((v) => [v.nombre, v.critico]),
      [['Tétanos', true], ['Hepatitis B', true], ['Sarampión', false], ['Gripe', false]]
    )
  })

  it('permite cambiar el umbral', () => {
    const [vacuna] = clasificarStockVacunas([{ idVacuna: 'v1', nombre: 'Gripe', stock: 5 }], 5)
    assert.equal(vacuna.critico, true)
  })
})
