import { ClerkProvider } from '@clerk/nextjs';
// No existe es-AR; es-UY usa voseo ("Ingresá", "tenés"), igual que en Argentina.
import { esUY } from '@clerk/localizations'
import type { Metadata } from 'next'
import Footer from '@/components/landing/Footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'SIGESMED - Sistema de Gestión de Salud Médica',
  description: 'Plataforma clínica integral para gestión de turnos, vacunatorio e historias clínicas.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="bg-[#090e17] text-slate-100 min-h-screen">
        <ClerkProvider localization={esUY}>
          {children}
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  )
}