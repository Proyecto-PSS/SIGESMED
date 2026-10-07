import type { Metadata } from 'next'
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
      <body className="bg-[#090e17] text-slate-100 min-h-screen">{children}</body>
    </html>
  )
}
