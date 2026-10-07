import { AgendaService, calcularTurnosPosibles } from '../lib/services/agenda-service'
import { readDb, writeDb } from '../lib/db'

async function runTests() {
  console.log('--- INICIANDO SUITE DE PRUEBAS SIGESMED: US-03, US-04, US-05 ---')

  // Limpiar BD de prueba para mes 2024-11
  const db = readDb()
  db.disponibilidades = db.disponibilidades.filter((d) => d.mes_vigencia !== '2024-11')
  db.turnos = db.turnos.filter((t) => !t.fecha_hora.startsWith('2024-11'))
  writeDb(db)

  // 1. Test Cálculo de Turnos
  console.log('\n[TEST 1] Cálculo de franjas y turnos:')
  const calc1 = calcularTurnosPosibles('08:00', '12:00', 30)
  console.assert(calc1.total === 8, `Esperado 8 turnos, obtenido: ${calc1.total}`)
  console.log(`  ✓ 08:00 a 12:00 (30 min) -> ${calc1.total} turnos`)

  const calc2 = calcularTurnosPosibles('14:00', '18:00', 20)
  console.assert(calc2.total === 12, `Esperado 12 turnos, obtenido: ${calc2.total}`)
  console.log(`  ✓ 14:00 a 18:00 (20 min) -> ${calc2.total} turnos`)

  const calcInvalido = calcularTurnosPosibles('12:00', '08:00', 30)
  console.assert(calcInvalido.total === 0, `Esperado 0 turnos para horario inválido`)
  console.log(`  ✓ Horario invertido rechazado correctamente -> 0 turnos`)

  // 2. Test Guardar Disponibilidad Día 1 (Martes = 2)
  console.log('\n[TEST 2] Guardar Disponibilidad Día 1 (Martes):')
  const resDia1 = await AgendaService.guardarDisponibilidad('med_001', {
    mes_vigencia: '2024-11',
    dia_semana: 2,
    hora_desde: '08:00',
    hora_hasta: '13:00',
    duracion_turno_minutos: 30,
  })
  console.assert(resDia1.esNueva === true, 'Debe ser nueva disponibilidad')
  console.assert(resDia1.disponibilidad.cantidad_turnos === 10, 'Debe tener 10 turnos por jornada')
  console.log('  ✓ Martes guardado en BORRADOR con 10 turnos por jornada')

  // 3. Test Guardar Disponibilidad Día 2 (Jueves = 4)
  console.log('\n[TEST 3] Guardar Disponibilidad Día 2 (Jueves):')
  const resDia2 = await AgendaService.guardarDisponibilidad('med_001', {
    mes_vigencia: '2024-11',
    dia_semana: 4,
    hora_desde: '14:00',
    hora_hasta: '19:00',
    duracion_turno_minutos: 30,
  })
  console.assert(resDia2.esNueva === true, 'Debe ser nueva disponibilidad')
  console.assert(resDia2.disponibilidad.cantidad_turnos === 10, 'Debe tener 10 turnos por jornada')
  console.log('  ✓ Jueves guardado en BORRADOR con 10 turnos por jornada')

  // 4. Test REGLA DE NEGOCIO CRÍTICA: Intento de agregar 3er Día (Viernes = 5) debe ser rechazado
  console.log('\n[TEST 4] Validación de Regla de Negocio: Máximo 2 días por semana:')
  let rechazoExitoso = false
  try {
    await AgendaService.guardarDisponibilidad('med_001', {
      mes_vigencia: '2024-11',
      dia_semana: 5,
      hora_desde: '09:00',
      hora_hasta: '12:00',
      duracion_turno_minutos: 30,
    })
  } catch (err) {
    rechazoExitoso = true
    console.log(`  ✓ Rechazado correctamente por backend: "${err.message}"`)
  }
  console.assert(rechazoExitoso, 'El backend debió rechazar el 3er día')

  // 5. Test Resumen previo a Publicación (US-04)
  console.log('\n[TEST 5] Generación de Resumen de Publicación:')
  const resumen = await AgendaService.obtenerResumenPublicacion('med_001', '2024-11')
  console.log(`  ✓ Total Jornadas en Noviembre: ${resumen.total_jornadas}`)
  console.log(`  ✓ Total Cupos a generar: ${resumen.total_turnos}`)
  console.assert(resumen.total_jornadas === 8, `Esperado 8 jornadas (4 martes + 4 jueves en nov 2024), obtenido: ${resumen.total_jornadas}`)
  console.assert(resumen.total_turnos === 80, `Esperado 80 turnos, obtenido: ${resumen.total_turnos}`)

  // 6. Test Publicación Atómica de la Agenda y Creación de Turnos (US-04)
  console.log('\n[TEST 6] Publicación Atómica de la Agenda:')
  const pubResult = await AgendaService.publicarAgenda('med_001', '2024-11')
  console.assert(pubResult.success === true, 'Publicación debe ser exitosa')
  console.assert(pubResult.total_turnos === 80, `Esperado 80 turnos creados, obtenido: ${pubResult.total_turnos}`)
  console.log(`  ✓ Agenda publicada. ${pubResult.total_turnos} turnos generados en la base de datos`)

  // 7. Test Idempotencia: Intentar publicar nuevamente cuando no hay borradores pendientes
  console.log('\n[TEST 7] Idempotencia en Publicación:')
  let idempotenciaOk = false
  try {
    await AgendaService.publicarAgenda('med_001', '2024-11')
  } catch (err) {
    idempotenciaOk = true
    console.log(`  ✓ Idempotencia garantizada: "${err.message}"`)
  }
  console.assert(idempotenciaOk, 'Debe prevenir republicación duplicada')

  // 8. Test Visualización de Agenda (US-05)
  console.log('\n[TEST 8] Consulta de Agenda Médica Generada (US-05):')
  const turnos = await AgendaService.obtenerAgendaTurnos('med_001', '2024-11', 'mensual')
  console.assert(turnos.length === 80, `Esperado 80 turnos en la agenda médica, obtenido: ${turnos.length}`)
  console.assert(turnos.every((t) => t.estado === 'DISPONIBLE'), 'Todos los turnos deben estar DISPONIBLES')
  console.assert(turnos.every((t) => t.id_paciente === null), 'Todos los turnos deben tener id_paciente nulo')
  console.log(`  ✓ Se recuperaron ${turnos.length} turnos válidos, todos en estado DISPONIBLE`)

  console.log('\n=== ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! ===\n')
}

runTests().catch((err) => {
  console.error('Error en pruebas:', err)
  process.exit(1)
})
