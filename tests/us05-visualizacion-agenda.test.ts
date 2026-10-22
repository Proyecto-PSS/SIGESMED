import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma.ts'
import {
  AgendaService,
  calcularTurnosPosibles,
  obtenerFechasDelMesParaDia,
  getMesActual,
} from '../lib/services/agenda-service.ts'

/**
 * US-05 — Visualización de agenda
 * "Pruebas de integración verificando consistencia de horarios en base de
 *  datos vs UI"
 *
 * A diferencia de otros tests/*.test.ts de este repo (que simulan la lógica
 * en memoria), este test escribe y lee datos REALES en la base Neon/Postgres
 * a través de AgendaService (la misma clase que usa el endpoint
 * GET /api/medicos/agenda), y luego vuelve a consultar la base con Prisma
 * directamente para comprobar que lo que la "UI" (la respuesta del servicio)
 * muestra coincide exactamente con lo que quedó persistido.
 */

function test(nombre: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => run())
    .then(() => {
      process.stdout.write(`✓ ${nombre}\n`)
    })
}

// --- Datos de prueba aislados, para no chocar con datos reales del equipo ---
const ID_MEDICO_TEST = 'test-us05-medico'
const EMAIL_MEDICO_TEST = 'test-us05-medico@sigesmed.test'
const MATRICULA_TEST = 'MN-TEST-US05'

// Usamos un mes 2 meses adelante del actual: nunca es "mes pasado" y ninguna
// de sus fechas cae dentro de la ventana de 48hs que bloquea la escritura.
function mesFuturoSeguro(mesesAdelante: number): string {
  const [year, month] = getMesActual().split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1 + mesesAdelante, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const MES_TEST = mesFuturoSeguro(2)
const DIA_SEMANA_TEST = 3 // Miércoles
const HORA_DESDE = '09:00'
const HORA_HASTA = '11:00'
const DURACION = 30 as const

async function limpiarDatosDeTest() {
  // Orden importa por las relaciones Restrict: primero turnos, luego
  // disponibilidades, y el médico de test al final.
  await prisma.turno.deleteMany({ where: { idMedico: ID_MEDICO_TEST } })
  await prisma.disponibilidadMedica.deleteMany({ where: { idMedico: ID_MEDICO_TEST } })
}

async function runAllTests() {
  console.log('--- US-05: Visualización de agenda (integración contra la base real) ---\n')

  // Setup: médico de prueba dedicado + limpieza de corridas anteriores.
  await prisma.medico.upsert({
    where: { idMedico: ID_MEDICO_TEST },
    create: {
      idMedico: ID_MEDICO_TEST,
      nombre: 'Test',
      apellido: 'US05',
      especialidad: 'CLINICA_MEDICA',
      matricula: MATRICULA_TEST,
      email: EMAIL_MEDICO_TEST,
    },
    update: {},
  })
  await limpiarDatosDeTest()

  try {
    let turnosEsperados = 0

    await test('RF-05: guarda una disponibilidad y la persiste en Postgres', async () => {
      const resultado = await AgendaService.guardarDisponibilidad(ID_MEDICO_TEST, {
        mes_vigencia: MES_TEST,
        dia_semana: DIA_SEMANA_TEST,
        hora_desde: HORA_DESDE,
        hora_hasta: HORA_HASTA,
        duracion_turno_minutos: DURACION,
      })

      const { total } = calcularTurnosPosibles(HORA_DESDE, HORA_HASTA, DURACION)
      const fechasDelMes = obtenerFechasDelMesParaDia(MES_TEST, DIA_SEMANA_TEST)
      turnosEsperados = total * fechasDelMes.length

      assert.equal(resultado.esNueva, true, 'Debe ser una disponibilidad nueva')
      assert.equal(resultado.turnosGenerados, turnosEsperados)
    })

    await test('RF-05: la disponibilidad que devuelve el servicio coincide con la fila real en BD', async () => {
      const filaReal = await prisma.disponibilidadMedica.findFirst({
        where: { idMedico: ID_MEDICO_TEST, mesVigencia: new Date(`${MES_TEST}-01T00:00:00.000Z`) },
      })
      assert.ok(filaReal, 'La disponibilidad debe existir en la base de datos')
      assert.equal(filaReal!.horaDesde, HORA_DESDE)
      assert.equal(filaReal!.horaHasta, HORA_HASTA)
      assert.equal(filaReal!.duracionTurnoMinutos, DURACION)
      assert.equal(filaReal!.diaSemana, DIA_SEMANA_TEST)
    })

    await test('US-05: obtenerAgendaTurnos (vista mensual) refleja exactamente lo persistido en BD', async () => {
      const turnosUI = await AgendaService.obtenerAgendaTurnos(ID_MEDICO_TEST, MES_TEST, 'mensual')
      const turnosBD = await prisma.turno.findMany({ where: { idMedico: ID_MEDICO_TEST } })

      assert.equal(turnosUI.length, turnosEsperados, `Esperaba ${turnosEsperados} turnos`)
      assert.equal(turnosUI.length, turnosBD.length, 'La cantidad en BD y la que devuelve la UI deben coincidir')
      assert.ok(turnosUI.every((t) => t.estado === 'DISPONIBLE'))
      assert.ok(turnosUI.every((t) => t.id_paciente === null))

      // Consistencia horario a horario: cada turno que "ve" la UI tiene que
      // tener una fila idéntica (fecha + hora) en la base.
      const clavesBD = new Set(
        turnosBD.map((t) => `${t.fecha.toISOString().slice(0, 10)}_${t.hora}`)
      )
      for (const turno of turnosUI) {
        const [fecha, horaConSegundos] = turno.fecha_hora.split('T')
        const hora = horaConSegundos.slice(0, 5)
        assert.ok(
          clavesBD.has(`${fecha}_${hora}`),
          `El turno ${fecha} ${hora} que muestra la UI no tiene fila correspondiente en BD`
        )
      }
    })

    await test('US-05: vista semanal filtra correctamente contra la BD', async () => {
      const fechasDelMes = obtenerFechasDelMesParaDia(MES_TEST, DIA_SEMANA_TEST)
      const fechaReferencia = fechasDelMes[0] // primer miércoles del mes de prueba

      const turnosSemana = await AgendaService.obtenerAgendaTurnos(
        ID_MEDICO_TEST,
        MES_TEST,
        'semanal',
        fechaReferencia
      )

      // Reconstruimos el rango lunes-domingo de forma independiente para
      // validar contra la BD sin depender de la lógica interna del servicio.
      const [y, m, d] = fechaReferencia.split('-').map(Number)
      const ref = new Date(Date.UTC(y, m - 1, d))
      const diaJS = ref.getUTCDay()
      const diffALunes = diaJS === 0 ? -6 : 1 - diaJS
      const lunes = new Date(Date.UTC(y, m - 1, d + diffALunes))
      const lunesSiguiente = new Date(lunes)
      lunesSiguiente.setUTCDate(lunes.getUTCDate() + 7)

      const turnosBDSemana = await prisma.turno.findMany({
        where: { idMedico: ID_MEDICO_TEST, fecha: { gte: lunes, lt: lunesSiguiente } },
      })

      assert.equal(turnosSemana.length, turnosBDSemana.length)
      assert.ok(turnosSemana.length > 0, 'La semana de referencia debe tener al menos un turno')
      assert.ok(turnosSemana.length < turnosEsperados, 'La vista semanal debe ser un subconjunto de la mensual')
    })

    console.log('\n=== TODAS LAS PRUEBAS DE US-05 PASARON EXITOSAMENTE (contra la base real) ===\n')
  } finally {
    // Limpieza final: no dejamos datos de test en la base compartida del equipo.
    await limpiarDatosDeTest()
    await prisma.medico.deleteMany({ where: { idMedico: ID_MEDICO_TEST } })
    await prisma.$disconnect()
  }
}

runAllTests().catch((error) => {
  console.error('\n❌ Error en las pruebas de US-05:', error)
  prisma.$disconnect().finally(() => process.exit(1))
})
