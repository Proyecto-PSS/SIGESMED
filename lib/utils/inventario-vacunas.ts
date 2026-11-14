// Lógica pura del inventario de vacunas (US-31 a US-33): categorías, nivel de stock,
// vencimientos y filtros. No accede a la base de datos, así se puede testear aislada.

export const UMBRAL_ALERTA_PREDETERMINADO = 10
export const DIAS_PROXIMO_A_VENCER = 90

const MS_POR_DIA = 24 * 60 * 60 * 1000

// ---------- Categorías ----------

export const CATEGORIAS_VACUNA = {
  CALENDARIO_NACIONAL: 'Calendario nacional',
  ESTACIONAL: 'Estacional',
  INFANTIL: 'Infantil',
  REFUERZO: 'Refuerzo',
  OTRA: 'Otra',
} as const

export type CategoriaVacuna = keyof typeof CATEGORIAS_VACUNA

export function esCategoriaVacuna(valor: unknown): valor is CategoriaVacuna {
  return typeof valor === 'string' && Object.hasOwn(CATEGORIAS_VACUNA, valor)
}

export function nombreCategoriaVacuna(categoria: string): string {
  return esCategoriaVacuna(categoria) ? CATEGORIAS_VACUNA[categoria] : categoria
}

export const PRESENTACIONES_VACUNA = [
  'Monodosis',
  'Multidosis',
  'Vial liofilizado',
  'Ampolla',
  'Jeringa prellenada',
  'Gotero',
] as const

// ---------- Nivel de stock ----------

export type NivelStock = 'CRITICO' | 'BAJO' | 'NORMAL'

/**
 * Crítico: la mitad del umbral o menos. Bajo: por debajo del umbral. Normal: el resto.
 * Con el umbral de 10: 0 a 5 dosis crítico, 6 a 9 bajo, 10 o más normal.
 */
export function nivelStock(stock: number, umbral: number): NivelStock {
  if (stock <= Math.floor(umbral / 2)) return 'CRITICO'
  if (stock < umbral) return 'BAJO'
  return 'NORMAL'
}

/** Porcentaje del stock respecto del doble del umbral (para la barra de nivel), entre 0 y 100. */
export function porcentajeNivel(stock: number, umbral: number): number {
  const referencia = Math.max(umbral * 2, 1)
  return Math.min(100, Math.round((stock / referencia) * 100))
}

// ---------- Lotes y vencimientos ----------

export interface LoteInventario {
  numeroLote: string
  stock: number
  vencimiento: string | null
}

/** Lote a mostrar: el que vence primero entre los que tienen dosis; si ninguno tiene, el primero. */
export function loteVigente(lotes: LoteInventario[]): LoteInventario | null {
  const conStock = lotes.filter((l) => l.stock > 0)
  const candidatos = conStock.length > 0 ? conStock : lotes
  if (candidatos.length === 0) return null
  return [...candidatos].sort(compararVencimiento)[0]
}

function compararVencimiento(a: LoteInventario, b: LoteInventario): number {
  if (a.vencimiento === b.vencimiento) return 0
  if (a.vencimiento === null) return 1
  if (b.vencimiento === null) return -1
  return a.vencimiento < b.vencimiento ? -1 : 1
}

/** Días que faltan para la fecha (YYYY-MM-DD); negativo si ya pasó. */
export function diasHastaVencimiento(vencimiento: string, hoy: string): number {
  const fin = Date.parse(`${vencimiento.slice(0, 10)}T00:00:00.000Z`)
  const inicio = Date.parse(`${hoy}T00:00:00.000Z`)
  return Math.round((fin - inicio) / MS_POR_DIA)
}

/** Algún lote con dosis vence dentro de los próximos 90 días (o ya venció). */
export function proximoAVencer(lotes: LoteInventario[], hoy: string): boolean {
  return lotes.some(
    (l) => l.stock > 0 && l.vencimiento !== null && diasHastaVencimiento(l.vencimiento, hoy) <= DIAS_PROXIMO_A_VENCER
  )
}

// ---------- Filtros ----------

export const FILTROS_INVENTARIO = {
  TODOS: 'Todos',
  CRITICO_BAJO: 'Stock crítico / bajo',
  NORMAL: 'Stock normal',
  PROXIMO_A_VENCER: 'Próximo a vencer',
} as const

export type FiltroInventario = keyof typeof FILTROS_INVENTARIO

export interface VacunaFiltrable {
  nombre: string
  stock: number
  umbralAlerta: number
  lotes: LoteInventario[]
}

export function cumpleFiltro(vacuna: VacunaFiltrable, filtro: FiltroInventario, hoy: string): boolean {
  const nivel = nivelStock(vacuna.stock, vacuna.umbralAlerta)
  switch (filtro) {
    case 'CRITICO_BAJO':
      return nivel !== 'NORMAL'
    case 'NORMAL':
      return nivel === 'NORMAL'
    case 'PROXIMO_A_VENCER':
      return proximoAVencer(vacuna.lotes, hoy)
    default:
      return true
  }
}

/** Búsqueda sin distinguir mayúsculas ni acentos, por nombre de vacuna o número de lote. */
export function coincideBusqueda(vacuna: VacunaFiltrable, termino: string): boolean {
  const buscado = normalizarTexto(termino)
  if (!buscado) return true
  return (
    normalizarTexto(vacuna.nombre).includes(buscado) ||
    vacuna.lotes.some((l) => normalizarTexto(l.numeroLote).includes(buscado))
  )
}

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Cantidad de vacunas que entran en cada filtro (para los contadores de las etiquetas). */
export function contarPorFiltro<T extends VacunaFiltrable>(vacunas: T[], hoy: string): Record<FiltroInventario, number> {
  const filtros = Object.keys(FILTROS_INVENTARIO) as FiltroInventario[]
  return Object.fromEntries(
    filtros.map((filtro) => [filtro, vacunas.filter((v) => cumpleFiltro(v, filtro, hoy)).length])
  ) as Record<FiltroInventario, number>
}
