// Tarjetas de la pantalla de inicio del paciente. Editá acá textos, links e imágenes.
// Las fotos van en public/images/paciente/.

export interface Acceso {
  href: string
  bajada: string
  titulo: string
  descripcion: string
  boton: string
  imagen: string
  /** Sección todavía no disponible: la tarjeta se muestra sin link. */
  proximamente?: boolean
}

export const ACCESOS: Acceso[] = [
  {
    href: '/dashboard/paciente/reservar-turno',
    bajada: 'Atención médica',
    titulo: 'Turnos',
    descripcion: 'Reservá tu consulta según la disponibilidad de cada profesional.',
    boton: 'Solicitar nuevo turno',
    imagen: '/images/paciente/turnos-calendario.jpg',
  },
  {
    href: '/dashboard/paciente/medicos',
    bajada: 'Médicos y especialidades',
    titulo: 'Profesionales',
    descripcion: 'Consultá nuestra cartilla médica.',
    boton: 'Ver especialistas',
    imagen: '/images/paciente/estetoscopio.webp',
  },
  {
    href: '/dashboard/paciente/mis-turnos-vacunacion',
    bajada: 'Vacunatorio',
    titulo: 'Vacunación',
    descripcion: 'Consultá y gestioná tus turnos de vacunación.',
    boton: 'Ver mis turnos de vacunación',
    imagen: '/images/paciente/turnos-calendario.jpg',
  },
  {
    href: '/dashboard/paciente/historia-clinica',
    bajada: 'Consultas anteriores',
    titulo: 'Historial de Turnos',
    descripcion: 'Revisá todas tus consultas anteriores: reservadas, asistidas, ausentes y canceladas.',
    boton: 'Ver historial de turnos',
    imagen: '/images/paciente/turnos-calendario.jpg',
  },
  {
    href: '/dashboard/paciente/historial-clinico',
    bajada: 'Mi ficha médica',
    titulo: 'Historial Clínico',
    descripcion: 'Consultá los diagnósticos, observaciones y tratamientos registrados por tus médicos.',
    boton: 'Explorar historial clínico',
    imagen: '/images/paciente/historial.jpeg',
  },
]
