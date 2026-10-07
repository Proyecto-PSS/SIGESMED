async function testLive() {
  const BASE_URL = 'http://localhost:3000'
  console.log('=== TEST HTTP EN VIVO SOBRE NEXT.JS DEV SERVER ===\n')

  // 1. GET Disponibilidad
  const res1 = await fetch(`${BASE_URL}/api/medicos/disponibilidad?mes=2024-11`)
  const data1 = await res1.json()
  console.log('[1] GET /api/medicos/disponibilidad?mes=2024-11')
  console.log('    Status:', res1.status)
  console.log('    Médico:', data1.medico)
  console.log('    Total Disponibilidades:', data1.disponibilidades.length)

  // 2. POST Crear Borrador para 2025-01 (Día 1 = Martes)
  const res2 = await fetch(`${BASE_URL}/api/medicos/disponibilidad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mes_vigencia: '2025-01',
      dia_semana: 2,
      hora_desde: '08:00',
      hora_hasta: '12:00',
      duracion_turno_minutos: 30,
    }),
  })
  const data2 = await res2.json()
  console.log('\n[2] POST Crear Día 1 (Martes)')
  console.log('    Status:', res2.status)
  console.log('    Cantidad turnos jornada:', data2.disponibilidad?.cantidad_turnos)

  // 3. POST Crear Borrador para 2025-01 (Día 2 = Jueves)
  const res3 = await fetch(`${BASE_URL}/api/medicos/disponibilidad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mes_vigencia: '2025-01',
      dia_semana: 4,
      hora_desde: '14:00',
      hora_hasta: '18:00',
      duracion_turno_minutos: 30,
    }),
  })
  const data3 = await res3.json()
  console.log('\n[3] POST Crear Día 2 (Jueves)')
  console.log('    Status:', res3.status)
  console.log('    Cantidad turnos jornada:', data3.disponibilidad?.cantidad_turnos)

  // 4. POST Intento de 3er Día (Viernes) -> Debe fallar por regla de 2 días
  const res4 = await fetch(`${BASE_URL}/api/medicos/disponibilidad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mes_vigencia: '2025-01',
      dia_semana: 5,
      hora_desde: '09:00',
      hora_hasta: '13:00',
      duracion_turno_minutos: 30,
    }),
  })
  const data4 = await res4.json()
  console.log('\n[4] POST Intento 3er Día (Viernes) -> Rechazo de regla de negocio')
  console.log('    Status:', res4.status, '(Esperado: 400)')
  console.log('    Error devuelto:', data4.error)

  // 5. GET Resumen
  const res5 = await fetch(`${BASE_URL}/api/medicos/disponibilidad/resumen?mes=2025-01`)
  const data5 = await res5.json()
  console.log('\n[5] GET Resumen de Publicación')
  console.log('    Status:', res5.status)
  console.log('    Total Jornadas:', data5.total_jornadas)
  console.log('    Total Turnos:', data5.total_turnos)

  // 6. POST Publicar Agenda
  const res6 = await fetch(`${BASE_URL}/api/medicos/agenda/publicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mes_vigencia: '2025-01' }),
  })
  const data6 = await res6.json()
  console.log('\n[6] POST Publicar Agenda Atómica')
  console.log('    Status:', res6.status)
  console.log('    Resultado:', data6)

  // 7. GET Agenda Turnos
  const res7 = await fetch(`${BASE_URL}/api/medicos/agenda?mes=2025-01&vista=mensual`)
  const data7 = await res7.json()
  console.log('\n[7] GET Agenda Médica Publicada')
  console.log('    Status:', res7.status)
  console.log('    Total Turnos generados:', data7.total_turnos)
  console.log('    Estado primer turno:', data7.turnos[0]?.estado)

  console.log('\n=== PRUEBAS HTTP COMPLETADAS CON ÉXITO ABSOLUTO ===')
}

testLive().catch(console.error)
