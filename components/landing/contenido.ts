// Textos y enlaces de la landing. Editá acá el contenido sin tocar los componentes.

export const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/sign-in', label: 'Mi perfil' },
] as const

export const HERO = {
  titulo: 'Excelencia en la Gestión Médica',
  subtitulo:
    'Reservá tus turnos, vacunate y gestioná tu atención médica desde un solo lugar.',
  cta: { href: '/sign-in', label: 'Ir al portal' },
  // Archivo en public/images/landing/
  imagen: '/images/landing/hero-inicio.jpeg',
} as const

// Columnas del pie de página. Los ítems sin `href` se muestran como texto.
type ItemFooter = { label: string; href?: string }

export const FOOTER_COLUMNAS: { titulo: string; items: ItemFooter[] }[] = [
  {
    titulo: 'Sobre nosotros',
    items: [{ label: 'Nuestra visión' }, { label: 'Nuestra misión' }, { label: 'Nuestra historia' }],
  },
  {
    titulo: 'Servicios',
    items: [
      { label: 'Gestión Médica', href: '/#servicios' },
      { label: 'Sistemas de Pacientes', href: '/#servicios' },
      { label: 'Consultoría Clínica', href: '/#servicios' },
    ],
  },
  {
    // Datos tomados del mockup: reemplazar por los reales.
    titulo: 'Contacto',
    items: [
      { label: '+34 912 345 678', href: 'tel:+34912345678' },
      { label: 'contacto@sigesmed.es', href: 'mailto:contacto@sigesmed.es' },
      { label: 'Bahia Blanca, Argentina' },
    ],
  },
]

export const SERVICIOS = [
  {
    titulo: 'Turnos online',
    descripcion: 'Reservá con el profesional y el horario que prefieras, y consultá tu historial de citas.',
  },
  {
    titulo: 'Vacunatorio',
    descripcion: 'Pedí tu turno de vacunación de forma rápida y sencilla.',
  },
  {
    titulo: 'Pagos y coberturas',
    descripcion: 'Consultas particulares con pago online o atención con tu obra social.',
  },
] as const
