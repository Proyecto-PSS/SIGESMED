export default function HistoriaClinicaLoading() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900" aria-busy="true" aria-label="Cargando historia clínica">
      <header className="border-t-4 border-black bg-white">
        <div className="h-14 border-b border-slate-200 px-6 py-5">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-48 animate-pulse border-b-2 border-slate-300" />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="hidden space-y-5 md:block">
            <div className="grid grid-cols-5 gap-4 border-b border-slate-100 pb-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="h-3 animate-pulse rounded bg-slate-200" />
              ))}
            </div>
            {Array.from({ length: 4 }, (_, row) => (
              <div key={row} className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }, (_, column) => (
                  <div key={column} className="h-4 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-4 md:hidden">
            {Array.from({ length: 3 }, (_, row) => (
              <div key={row} className="space-y-3 border-b border-slate-100 pb-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
