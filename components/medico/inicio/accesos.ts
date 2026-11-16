// Tarjetas de la pantalla de inicio del médico (US-02). Editá acá textos, links e imágenes.
import type { Acceso } from '@/components/paciente/inicio/accesos'

export const ACCESOS_MEDICO: Acceso[] = [
  {
    href: '/dashboard/medico/agenda',
    bajada: 'Carga de agenda mensual',
    titulo: 'Agenda',
    descripcion: 'Definí tus días y horarios de atención, publicá tus turnos y consultá tu calendario.',
    boton: 'Gestionar mi agenda',
    imagen: '/images/paciente/turnos-calendario.jpg',
  },
  {
    href: '/dashboard/medico/fichas-clinicas',
    bajada: 'Atención / historial',
    titulo: 'Fichas clínicas de pacientes',
    descripcion: 'Buscá pacientes por DNI y registrá diagnósticos y tratamientos.',
    boton: 'Gestionar fichas clínicas',
    imagen: '/images/paciente/historial.jpeg',
  },
]
