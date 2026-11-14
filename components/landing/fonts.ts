import { Fraunces, Public_Sans } from 'next/font/google'

// Tipografías de la landing, expuestas como variables CSS (--font-display / --font-body).
export const fontDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const fontBody = Public_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})
