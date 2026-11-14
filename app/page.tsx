import LandingPage from '@/components/landing/LandingPage'

// Landing pública. Los usuarios logueados son redirigidos a su dashboard desde proxy.ts.
export default function Home() {
  return <LandingPage />
}
