// Endpoint liviano para verificación de conectividad y estado Online/Offline (US-20).
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { ok: true, status: 'online', timestamp: Date.now() },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
