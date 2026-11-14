// Estilo de los formularios de Clerk (<SignIn />) alineado con la landing.
// Clerk necesita los colores en hex (no acepta variables CSS para calcular tonos).
export const aparienciaClerk = {
  variables: {
    colorPrimary: '#2b7a87',
    colorPrimaryForeground: '#ffffff',
    colorForeground: '#1b2f36',
    colorMutedForeground: '#5b6b70',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#1b2f36',
    colorBorder: '#d9dcd6',
    colorDanger: '#b3261e',
    fontFamily: 'var(--font-body), system-ui, sans-serif',
    borderRadius: '4px',
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: {
      width: '100%',
      maxWidth: '26rem',
      boxShadow: 'none',
      border: '1px solid #e4e4dd',
    },
    headerTitle: {
      fontFamily: 'var(--font-display), Georgia, serif',
      fontSize: '1.6rem',
      fontWeight: 700,
    },
    formButtonPrimary: {
      fontSize: '0.95rem',
      fontWeight: 500,
      textTransform: 'none',
      boxShadow: 'none',
    },
    footerActionLink: { color: '#2b7a87', fontWeight: 600 },
  },
} as const
