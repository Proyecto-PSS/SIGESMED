import { prisma } from '@/lib/prisma'
import { nombreEspecialidadMedica } from '@/lib/utils/especialidades-medicas'
import {
  type TipoDiagnosticoValor,
  type CargaAtencionMedicaValidada,
  TIPOS_DIAGNOSTICO_VALIDOS,
  ETIQUETAS_TIPO_DIAGNOSTICO,
  OPCIONES_TIPO_DIAGNOSTICO,
  TEXTO_DNI_NO_ENCONTRADO,
  TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS,
  HistoriaClinicaError,
  esTipoDiagnosticoValido,
  validarCargaAtencionMedica,
  construirMensajeExitoAtencion,
  filtrarPacientesPorTermino,
  sanearDniBusqueda,
  esDniValido,
  validarDniBusqueda,
} from '@/lib/utils/historia-clinica-utils'

export {
  type TipoDiagnosticoValor,
  type CargaAtencionMedicaValidada,
  TIPOS_DIAGNOSTICO_VALIDOS,
  ETIQUETAS_TIPO_DIAGNOSTICO,
  OPCIONES_TIPO_DIAGNOSTICO,
  TEXTO_DNI_NO_ENCONTRADO,
  TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS,
  HistoriaClinicaError,
  esTipoDiagnosticoValido,
  validarCargaAtencionMedica,
  construirMensajeExitoAtencion,
  filtrarPacientesPorTermino,
  sanearDniBusqueda,
  esDniValido,
  validarDniBusqueda,
}

export interface PacienteFichaDTO {
  idPaciente: string
  nombre: string
  apellido: string
  dni: string
  email: string
  telefono: string | null
  obraSocial: string | null
  numeroAfiliado: string | null
  plan: string | null
  cantidadAtenciones: number
}

export interface AtencionMedicaDTO {
  idAtencion: string
  idPaciente: string
  idMedico: string
  diagnosticoPrincipal: string
  tipoDiagnostico: TipoDiagnosticoValor
  tipoDiagnosticoEtiqueta: string
  observacionesClinicas: string | null
  detalleTratamiento: string | null
  indicacionesFarmacologicas: string | null
  createdAt: string
  updatedAt: string
  medico: {
    idMedico: string
    nombre: string
    apellido: string
    nombreCompleto: string
    especialidad: string
    especialidadEtiqueta: string
    matricula: string
  }
}

export function formatearAtencionMedicaDTO(registro: {
  idAtencion: string
  idPaciente: string
  idMedico: string
  diagnosticoPrincipal: string
  tipoDiagnostico: TipoDiagnosticoValor
  observacionesClinicas: string | null
  detalleTratamiento: string | null
  indicacionesFarmacologicas: string | null
  createdAt: Date
  updatedAt: Date
  medico: {
    idMedico: string
    nombre: string
    apellido: string
    especialidad: string
    matricula: string
  }
}): AtencionMedicaDTO {
  return {
    idAtencion: registro.idAtencion,
    idPaciente: registro.idPaciente,
    idMedico: registro.idMedico,
    diagnosticoPrincipal: registro.diagnosticoPrincipal,
    tipoDiagnostico: registro.tipoDiagnostico,
    tipoDiagnosticoEtiqueta:
      ETIQUETAS_TIPO_DIAGNOSTICO[registro.tipoDiagnostico] ?? registro.tipoDiagnostico,
    observacionesClinicas: registro.observacionesClinicas,
    detalleTratamiento: registro.detalleTratamiento,
    indicacionesFarmacologicas: registro.indicacionesFarmacologicas,
    createdAt: registro.createdAt.toISOString(),
    updatedAt: registro.updatedAt.toISOString(),
    medico: {
      idMedico: registro.medico.idMedico,
      nombre: registro.medico.nombre,
      apellido: registro.medico.apellido,
      nombreCompleto: `${registro.medico.nombre} ${registro.medico.apellido}`.trim(),
      especialidad: registro.medico.especialidad,
      especialidadEtiqueta: nombreEspecialidadMedica(registro.medico.especialidad),
      matricula: registro.medico.matricula,
    },
  }
}

/**
 * Busca y lista los pacientes disponibles para que el médico consulte o cargue su ficha clínica.
 */
export async function buscarPacientesFichaClinica(
  busqueda?: string
): Promise<PacienteFichaDTO[]> {
  const pacientes = await prisma.paciente.findMany({
    include: {
      _count: {
        select: { atenciones: true },
      },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    take: 200,
  })

  const mapeados: PacienteFichaDTO[] = pacientes.map((p) => ({
    idPaciente: p.idPaciente,
    nombre: p.nombre,
    apellido: p.apellido,
    dni: p.dni,
    email: p.email,
    telefono: p.telefono,
    obraSocial: p.obraSocial,
    numeroAfiliado: p.numeroAfiliado,
    plan: p.plan,
    cantidadAtenciones: p._count.atenciones,
  }))

  return filtrarPacientesPorTermino(mapeados, busqueda)
}

/**
 * Busca un paciente registrado exclusivamente por su DNI saneado y validado (US-17, RF-17.1 & RF-17.2).
 * - Si el formato del DNI es inválido (no numérico o fuera de 7 a 8 dígitos), lanza 400 Bad Request antes de consultar la BD.
 * - Si el DNI tiene formato válido pero no existe ningún registro en la tabla Paciente, lanza 404 Not Found.
 */
export async function buscarPacientePorDni(dniInput: unknown): Promise<PacienteFichaDTO> {
  const dniLimpio = validarDniBusqueda(dniInput)

  const paciente = await prisma.paciente.findUnique({
    where: { dni: dniLimpio },
    include: {
      _count: {
        select: { atenciones: true },
      },
    },
  })

  if (!paciente) {
    throw new HistoriaClinicaError(TEXTO_DNI_NO_ENCONTRADO, 404)
  }

  return {
    idPaciente: paciente.idPaciente,
    nombre: paciente.nombre,
    apellido: paciente.apellido,
    dni: paciente.dni,
    email: paciente.email,
    telefono: paciente.telefono,
    obraSocial: paciente.obraSocial,
    numeroAfiliado: paciente.numeroAfiliado,
    plan: paciente.plan,
    cantidadAtenciones: paciente._count.atenciones,
  }
}

/**
 * Obtiene el detalle completo de la ficha clínica de un paciente para US-17:
 * datos filiatorios + historial de diagnósticos y tratamientos registrados previamente mediante US-38.
 * Si el paciente no tiene registros clínicos previos, abre la ficha con el indicador y mensaje explícito.
 */
export async function obtenerDetalleFichaPaciente(idPaciente: string): Promise<{
  paciente: PacienteFichaDTO
  atenciones: AtencionMedicaDTO[]
  sinRegistrosClinicos: boolean
  mensajeHistorialVacio: string | null
}> {
  const { paciente, atenciones } = await obtenerFichaClinicaPaciente(idPaciente)
  const sinRegistrosClinicos = atenciones.length === 0

  return {
    paciente,
    atenciones,
    sinRegistrosClinicos,
    mensajeHistorialVacio: sinRegistrosClinicos ? TEXTO_PACIENTE_SIN_REGISTROS_CLINICOS : null,
  }
}

/**
 * Obtiene la ficha clínica de un paciente junto con su historial de atenciones médicas
 * ordenado de la más reciente a la más antigua (RF-38.1, RF-38.5).
 */
export async function obtenerFichaClinicaPaciente(idPaciente: string): Promise<{
  paciente: PacienteFichaDTO
  atenciones: AtencionMedicaDTO[]
}> {
  const idLimpio = idPaciente?.trim()
  if (!idLimpio) {
    throw new HistoriaClinicaError('El identificador del paciente es obligatorio.', 400)
  }

  const paciente = await prisma.paciente.findUnique({
    where: { idPaciente: idLimpio },
    include: {
      atenciones: {
        orderBy: [{ createdAt: 'desc' }],
        include: {
          medico: true,
        },
      },
    },
  })

  if (!paciente) {
    throw new HistoriaClinicaError('No se encontró el paciente solicitado.', 404)
  }

  return {
    paciente: {
      idPaciente: paciente.idPaciente,
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      dni: paciente.dni,
      email: paciente.email,
      telefono: paciente.telefono,
      obraSocial: paciente.obraSocial,
      numeroAfiliado: paciente.numeroAfiliado,
      plan: paciente.plan,
      cantidadAtenciones: paciente.atenciones.length,
    },
    atenciones: paciente.atenciones.map((atencion) =>
      formatearAtencionMedicaDTO({
        ...atencion,
        tipoDiagnostico: atencion.tipoDiagnostico as TipoDiagnosticoValor,
      })
    ),
  }
}

/**
 * Registra una nueva atención médica en la historia clínica del paciente (RF-38.4).
 * La identidad del médico se toma exclusivamente de la sesión autenticada en servidor.
 */
export async function registrarAtencionClinica(params: {
  idMedicoAutenticado: string
  idPaciente: string
  payload: unknown
}): Promise<{
  message: string
  atencion: AtencionMedicaDTO
}> {
  const idMedico = params.idMedicoAutenticado?.trim()
  if (!idMedico) {
    throw new HistoriaClinicaError('No autorizado: se requiere sesión médica activa.', 401)
  }

  const idPaciente = params.idPaciente?.trim()
  if (!idPaciente) {
    throw new HistoriaClinicaError('El identificador del paciente es obligatorio.', 400)
  }

  const datosValidados = validarCargaAtencionMedica(params.payload)

  const [paciente, medico] = await Promise.all([
    prisma.paciente.findUnique({ where: { idPaciente } }),
    prisma.medico.findUnique({ where: { idMedico } }),
  ])

  if (!paciente) {
    throw new HistoriaClinicaError('No se encontró el paciente especificado.', 404)
  }

  if (!medico) {
    throw new HistoriaClinicaError('No se encontró el perfil del profesional médico.', 403)
  }

  const creada = await prisma.atencionMedica.create({
    data: {
      idPaciente: paciente.idPaciente,
      idMedico: medico.idMedico,
      diagnosticoPrincipal: datosValidados.diagnosticoPrincipal,
      tipoDiagnostico: datosValidados.tipoDiagnostico,
      observacionesClinicas: datosValidados.observacionesClinicas,
      detalleTratamiento: datosValidados.detalleTratamiento,
      indicacionesFarmacologicas: datosValidados.indicacionesFarmacologicas,
    },
    include: {
      medico: true,
    },
  })

  return {
    message: construirMensajeExitoAtencion(datosValidados),
    atencion: formatearAtencionMedicaDTO({
      ...creada,
      tipoDiagnostico: creada.tipoDiagnostico as TipoDiagnosticoValor,
    }),
  }
}

/**
 * Recupera exclusivamente las atenciones médicas registradas para el paciente autenticado en sesión (US-39).
 * Ordena cronológicamente desde la atención más reciente a la más antigua y es estrictamente de solo lectura.
 */
export async function obtenerHistorialClinicoPropioPaciente(
  idPacienteAutenticado: string
): Promise<AtencionMedicaDTO[]> {
  const idPaciente = idPacienteAutenticado?.trim()
  if (!idPaciente) {
    throw new HistoriaClinicaError(
      'No autorizado: sesión de paciente no encontrada.',
      401
    )
  }

  const paciente = await prisma.paciente.findUnique({
    where: { idPaciente },
    select: { idPaciente: true },
  })

  if (!paciente) {
    throw new HistoriaClinicaError(
      'No se encontró un registro de paciente asociado a la sesión actual.',
      404
    )
  }

  const atenciones = await prisma.atencionMedica.findMany({
    where: { idPaciente: paciente.idPaciente },
    include: {
      medico: true,
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return atenciones.map((atencion) =>
    formatearAtencionMedicaDTO({
      ...atencion,
      tipoDiagnostico: atencion.tipoDiagnostico as TipoDiagnosticoValor,
    })
  )
}
