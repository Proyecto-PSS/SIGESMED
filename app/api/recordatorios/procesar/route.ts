// Endpoint interno y protegido para el procesamiento manual o programado de recordatorios de turnos (US-15).
import { NextResponse } from 'next/server'
import { RecordatoriosService } from '@/lib/services/recordatorios-service'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RequestBody {
  idTurno?: string
  forzar?: boolean
  limite?: number
}

function verificarAutorizacionServicio(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  const secretConfigurado = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET

  // Si hay un secret configurado en las variables de entorno, verificar coincidencia estricta
  if (secretConfigurado) {
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (bearerToken === secretConfigurado || cronHeader === secretConfigurado) {
      return true
    }
  }

  // En entorno de desarrollo o pruebas sin CRON_SECRET explícito, permitir un token de desarrollo documentado
  if (process.env.NODE_ENV !== 'production') {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cronHeader
    if (token === 'sigesmed-cron-secret-dev') {
      return true
    }
  }

  return false
}

export async function POST(request: Request) {
  try {
    let body: RequestBody = {}
    try {
      body = await request.json()
    } catch {
      // Body vacío permitido para ejecuciones de lote generales
    }

    const esServicio = verificarAutorizacionServicio(request)

    // Si no es una llamada entre servicios autenticada, verificar sesión de usuario
    if (!esServicio) {
      const usuario = await getCurrentUser()
      if (!usuario) {
        return NextResponse.json(
          { success: false, error: 'No autorizado: se requiere token de servicio o sesión activa.' },
          { status: 401 }
        )
      }

      // Si no es ADMIN, solo puede disparar pruebas para sus propios turnos
      if (usuario.rol !== 'ADMIN') {
        if (!body.idTurno) {
          return NextResponse.json(
            { success: false, error: 'Solo un administrador o servicio programado puede ejecutar el procesamiento en lote.' },
            { status: 403 }
          )
        }

        const turno = await prisma.turno.findUnique({
          where: { idTurno: body.idTurno },
          select: { idPaciente: true },
        })

        if (!turno || turno.idPaciente !== usuario.id) {
          return NextResponse.json(
            { success: false, error: 'No autorizado para disparar recordatorios de turnos ajenos.' },
            { status: 403 }
          )
        }
      }
    }

    // Ejecutar procesamiento del lote o turno específico
    const resultado = await RecordatoriosService.procesarLoteRecordatorios({
      limite: body.limite,
      forzarIdTurno: body.idTurno,
    })

    return NextResponse.json({
      success: true,
      mensaje: 'Procesamiento de recordatorios completado.',
      resultado,
    })
  } catch (error) {
    console.error('[API-RECORDATORIOS] Error al procesar recordatorios:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno al procesar recordatorios.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idTurno = searchParams.get('idTurno')

    if (!idTurno) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el parámetro idTurno.' },
        { status: 400 }
      )
    }

    const esServicio = verificarAutorizacionServicio(request)
    if (!esServicio) {
      const usuario = await getCurrentUser()
      if (!usuario) {
        return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
      }

      if (usuario.rol !== 'ADMIN') {
        const turno = await prisma.turno.findUnique({
          where: { idTurno },
          select: { idPaciente: true },
        })
        if (!turno || turno.idPaciente !== usuario.id) {
          return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 403 })
        }
      }
    }

    const recordatorio = await RecordatoriosService.obtenerRecordatorioTurno(idTurno)
    if (!recordatorio) {
      return NextResponse.json(
        { success: false, error: 'No se encontró recordatorio para el turno indicado.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, recordatorio })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno.' },
      { status: 500 }
    )
  }
}
