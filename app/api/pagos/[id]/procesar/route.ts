import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPatient } from '@/lib/auth'
import { PagosService } from '@/lib/services/pagos-service'

function detectarMarcaTarjeta(numero: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'CABAL' | 'NARANJA' | 'TARJETA' {
  const clean = numero.replace(/\D/g, '')
  if (/^4/.test(clean)) return 'VISA'
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'MASTERCARD'
  if (/^3[47]/.test(clean)) return 'AMEX'
  if (/^(6042|589657)/.test(clean)) return 'CABAL'
  if (/^58956[12]/.test(clean)) return 'NARANJA'
  return 'TARJETA'
}

function validarLuhn(numero: string): boolean {
  const clean = numero.replace(/\D/g, '')
  if (clean.length < 13 || clean.length > 19) return false
  let sum = 0
  let shouldDouble = false
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10)
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

function validarVencimiento(vencimiento: string): { valido: boolean; error?: string } {
  if (!vencimiento || typeof vencimiento !== 'string') {
    return { valido: false, error: 'La fecha de vencimiento es requerida.' }
  }
  const match = vencimiento.trim().match(/^(0[1-9]|1[0-2])\/?(\d{2}|\d{4})$/)
  if (!match) {
    return { valido: false, error: 'El formato de vencimiento debe ser MM/AA (ej. 08/28).' }
  }
  const mes = parseInt(match[1], 10)
  let anio = parseInt(match[2], 10)
  if (anio < 100) anio += 2000

  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  if (anio < anioActual || (anio === anioActual && mes < mesActual)) {
    return { valido: false, error: 'La tarjeta se encuentra vencida.' }
  }
  if (anio > anioActual + 20) {
    return { valido: false, error: 'El año de vencimiento supera el rango permitido.' }
  }
  return { valido: true }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paciente = await getCurrentPatient()
    const { id: idPago } = await params

    if (!idPago) {
      return NextResponse.json(
        { error: 'El identificador del pago es obligatorio.' },
        { status: 400 }
      )
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    let { resultado, motivoRechazo, codigoError, transaccionExternaId, tarjeta } = body

    // Si el cliente envía datos de tarjeta, validamos los campos
    if (tarjeta) {
      // 1. Validar titular
      if (!tarjeta.titular || typeof tarjeta.titular !== 'string' || tarjeta.titular.trim().length < 3) {
        return NextResponse.json(
          { error: 'El nombre y apellido del titular es obligatorio y debe tener al menos 3 caracteres.' },
          { status: 400 }
        )
      }

      // 2. Validar DNI si está presente
      if (tarjeta.dni) {
        const cleanDni = String(tarjeta.dni).replace(/\D/g, '')
        if (cleanDni.length < 7 || cleanDni.length > 9) {
          return NextResponse.json(
            { error: 'El número de DNI del titular debe tener entre 7 y 9 dígitos.' },
            { status: 400 }
          )
        }
      }

      // 3. Validar número de tarjeta con Luhn
      const cleanNumero = String(tarjeta.numero || '').replace(/\D/g, '')
      if (cleanNumero.length < 13 || cleanNumero.length > 19) {
        return NextResponse.json(
          { error: 'El número de tarjeta debe tener entre 13 y 19 dígitos.' },
          { status: 400 }
        )
      }

      const luhnValido = validarLuhn(cleanNumero)
      if (!luhnValido) {
        return NextResponse.json(
          { error: 'El número de tarjeta ingresado no es válido (falló verificación de dígito verificador Luhn).' },
          { status: 400 }
        )
      }

      // 4. Validar fecha de vencimiento
      const resVencimiento = validarVencimiento(tarjeta.vencimiento)
      if (!resVencimiento.valido) {
        return NextResponse.json(
          { error: resVencimiento.error || 'La fecha de vencimiento es inválida o la tarjeta se encuentra vencida.' },
          { status: 400 }
        )
      }

      // 5. Validar CVV
      const marca = detectarMarcaTarjeta(cleanNumero)
      const cleanCvv = String(tarjeta.cvv || '').replace(/\D/g, '')
      const longEsperada = marca === 'AMEX' ? 4 : 3
      if (cleanCvv.length < 3 || cleanCvv.length > 4) {
        return NextResponse.json(
          { error: `El código de seguridad (CVV) debe contener ${longEsperada} dígitos numéricos.` },
          { status: 400 }
        )
      }

      // Determinar resultado y comprobante
      const ultimos4 = cleanNumero.slice(-4)

      // Reglas de prueba para tarjetas específicas
      if (ultimos4 === '4002' || ultimos4 === '0002') {
        resultado = 'RECHAZADO'
        motivoRechazo = 'Operación denegada por la entidad emisora: fondos insuficientes en la tarjeta.'
      } else if (ultimos4 === '5999' || ultimos4 === '9999') {
        resultado = 'ERROR'
        codigoError = 'FALLO_COMUNICACION_RED_BANCARIA'
      } else {
        resultado = 'APROBADO'
        transaccionExternaId = `TX-${marca}-${ultimos4}-${Date.now().toString().slice(-6)}`
      }
    }

    if (!resultado || !['APROBADO', 'RECHAZADO', 'ERROR'].includes(resultado)) {
      return NextResponse.json(
        { error: 'El resultado debe ser APROBADO, RECHAZADO o ERROR, o bien se debe proveer una tarjeta válida.' },
        { status: 400 }
      )
    }

    const pagoActualizado = await PagosService.procesarResultadoPago({
      idPago,
      idPaciente: paciente.idPaciente,
      resultado,
      transaccionExternaId,
      motivoRechazo,
      codigoError,
    })

    return NextResponse.json({ pago: pagoActualizado }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || error.status || 500
    const code = error.code || 'INTERNAL_ERROR'
    return NextResponse.json(
      { error: error.message || 'Error al procesar el pago.', code },
      { status }
    )
  }
}

