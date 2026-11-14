export default function AccesoDenegadoReporte() {
  return (
    <section role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
      <h1 className="text-xl font-bold">Permisos insuficientes</h1>
      <p className="mt-2">El reporte de stock de vacunas está disponible solo para Administración y Enfermería.</p>
    </section>
  )
}
