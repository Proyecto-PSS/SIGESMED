import { SignIn } from '@clerk/nextjs'
import AuthLayout from '@/components/auth/AuthLayout'
import { aparienciaClerk } from '@/components/auth/clerk-apariencia'

export default function SignInPage() {
  return (
    <AuthLayout
      titulo="Bienvenido a tu portal"
      texto="Ingresá para reservar turnos, consultar tus citas y gestionar tu atención en un solo lugar."
    >
      <SignIn appearance={aparienciaClerk} />
    </AuthLayout>
  )
}
