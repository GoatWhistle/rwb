import dashboard from "./dashboard-data.json" with { type: "json" }

export type Row = Record<string, string | number | null>
export interface MockFilters {
  start_date?: string | null
  end_date?: string | null
  states?: string[]
  seller_ids?: string[]
  categories?: string[]
}

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexId(random: () => number, length = 32) {
  let out = ""
  for (let i = 0; i < length; i++) out += Math.floor(random() * 16).toString(16)
  return out
}

export const TOTAL_REVENUE = 13221498.11

const monthlyBase: [string, number, number][] = [
  ["2016-09-01", 4, 134.97],
  ["2016-10-01", 324, 40325.11],
  ["2016-11-01", 0, 0],
  ["2016-12-01", 1, 10.9],
  ["2017-01-01", 800, 111798.36],
  ["2017-02-01", 1780, 234223.4],
  ["2017-03-01", 2682, 359198.85],
  ["2017-04-01", 2404, 340669.68],
  ["2017-05-01", 3700, 489338.25],
  ["2017-06-01", 3245, 421923.37],
  ["2017-07-01", 4026, 481604.52],
  ["2017-08-01", 4331, 554699.7],
  ["2017-09-01", 4285, 607399.67],
  ["2017-10-01", 4631, 648247.65],
  ["2017-11-01", 7544, 987765.37],
  ["2017-12-01", 5673, 726033.19],
  ["2018-01-01", 7269, 924645.0],
  ["2018-02-01", 6728, 826437.13],
  ["2018-03-01", 7211, 953356.25],
  ["2018-04-01", 6939, 973534.09],
  ["2018-05-01", 6873, 977544.69],
  ["2018-06-01", 6167, 856077.86],
  ["2018-07-01", 6292, 867953.46],
  ["2018-08-01", 6512, 0],
]
const known = monthlyBase.reduce((sum, [, , revenue]) => sum + revenue, 0)
const lastMonth = monthlyBase.at(-1)
if (lastMonth) lastMonth[2] = Math.round((TOTAL_REVENUE - known) * 100) / 100

export const monthly: Row[] = monthlyBase.map(([month, orders_cnt, revenue]) => ({
  month,
  orders_cnt,
  revenue,
}))

const totalOrders = monthlyBase.reduce((sum, [, orders]) => sum + orders, 0)
const deliveredTotal = dashboard.kpi.delivered

const inPeriod = (date: string, filters: MockFilters) =>
  (!filters.start_date || date >= filters.start_date) &&
  (!filters.end_date || date < filters.end_date)

export function periodShare(filters: MockFilters) {
  const orders = monthlyBase
    .filter(([month]) => inPeriod(month, filters))
    .reduce((sum, [, count]) => sum + count, 0)
  return orders / totalOrders
}

export function stateShare(filters: MockFilters) {
  if (!filters.states?.length) return 1
  const delivered = dashboard.states
    .filter((row) => filters.states?.includes(row.state))
    .reduce((sum, row) => sum + row.delivered, 0)
  return delivered / deliveredTotal
}

export const scale = (filters: MockFilters) => periodShare(filters) * stateShare(filters)
const round2 = (value: number) => Math.round(value * 100) / 100

export function monthlyFor(filters: MockFilters): Row[] {
  const share = stateShare(filters)
  const start = filters.start_date?.slice(0, 7)
  const end = filters.end_date?.slice(0, 7)
  return monthly
    .filter((row) => {
      const month = String(row.month).slice(0, 7)
      return (!start || month >= start) && (!end || month < end)
    })
    .map((row) => ({
      month: row.month ?? null,
      orders_cnt: Math.round(Number(row.orders_cnt) * share),
      revenue: round2(Number(row.revenue) * share),
    }))
}

const sellerBase: [string, string, string, number, number][] = [
  ["4869f7a5dfa277a7dca6462dcf3aed2b", "guariba", "SP", 1124, 226987.93],
  ["53243585a1d6dc2643021fd1853d8905", "lauro de freitas", "BA", 348, 217940.44],
  ["4a3ca9315b744ce9f8e9374361493884", "ibitinga", "SP", 1772, 196882.12],
  ["fa1c13f2614d7b5c4749cbc52fecda94", "sumare", "SP", 574, 190917.14],
  ["7c67e1448b00f6e969d365cea6b010ab", "itaquaquecetuba", "SP", 975, 186570.05],
  ["7e93a43ef30c4f03f38b393420bc753a", "barueri", "SP", 332, 165981.49],
  ["da8622b14eb17ae2831f4ac5b9dab84a", "piracicaba", "SP", 1311, 159816.87],
  ["7a67c85e85bb2ce8582c35f2203ad736", "sao paulo", "SP", 1158, 139658.69],
  ["1025f0e2d44d7041d6cf58b6550e0bfa", "sao paulo", "SP", 913, 138208.56],
  ["955fee9216a65b617aa5c0531780ce60", "sao paulo", "SP", 1278, 131836.71],
]

export function sellersFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  return sellerBase.map(([seller_id, city, state, orders, revenue]) => ({
    seller_id,
    city,
    state,
    orders_cnt: Math.max(1, Math.round(orders * factor)),
    units: Math.max(1, Math.round(orders * 1.14 * factor)),
    revenue: round2(revenue * factor),
  }))
}

const categoryTop: [string, number][] = [
  ["beleza_saude", 1233131.72],
  ["relogios_presentes", 1166176.98],
  ["cama_mesa_banho", 1023434.76],
  ["esporte_lazer", 954852.55],
  ["informatica_acessorios", 888724.61],
  ["moveis_decoracao", 711927.69],
  ["utilidades_domesticas", 615628.69],
  ["cool_stuff", 610204.1],
  ["automotivo", 578966.65],
  ["ferramentas_jardim", 482256.48],
  ["brinquedos", 471286.48],
  ["bebes", 401599.94],
  ["perfumaria", 394726.03],
  ["telefonia", 316820.35],
]
const categoryTail = [
  "moveis_escritorio",
  "papelaria",
  "pcs",
  "pet_shop",
  "instrumentos_musicais",
  "eletroportateis",
  "eletronicos",
  "consoles_games",
  "fashion_bolsas_e_acessorios",
  "construcao_ferramentas_seguranca",
  "eletrodomesticos_2",
  "malas_acessorios",
  "climatizacao",
  "eletrodomesticos",
  "casa_construcao",
  "moveis_sala",
  "construcao_ferramentas_construcao",
  "agro_industria_e_comercio",
  "(без категории)",
  "market_place",
  "livros_tecnicos",
  "telefonia_fixa",
  "livros_interesse_geral",
  "construcao_ferramentas_iluminacao",
  "moveis_cozinha_area_de_servico_jantar_e_jardim",
  "industria_comercio_e_negocios",
  "alimentos",
  "sinalizacao_e_seguranca",
  "audio",
  "construcao_ferramentas_jardim",
  "artigos_de_natal",
  "fashion_calcados",
  "bebidas",
  "moveis_quarto",
  "alimentos_bebidas",
  "cine_foto",
  "artes",
  "la_cuisine",
  "construcao_ferramentas_ferramentas",
  "fashion_roupa_masculina",
  "dvds_blu_ray",
  "artigos_de_festas",
  "portateis_casa_forno_e_cafe",
  "moveis_colchao_e_estofado",
  "livros_importados",
  "tablets_impressao_imagem",
  "fashion_underwear_e_moda_praia",
  "musica",
  "fashion_esporte",
  "casa_conforto",
  "artes_e_artesanato",
  "flores",
  "fraldas_higiene",
  "casa_conforto_2",
  "cds_dvds_musicais",
  "fashion_roupa_feminina",
  "portateis_cozinha_e_preparadores_de_alimentos",
  "seguros_e_servicos",
  "fashion_roupa_infanto_juvenil",
  "pc_gamer",
]
const tailBudget = TOTAL_REVENUE - categoryTop.reduce((sum, [, value]) => sum + value, 0)
const tailWeights = categoryTail.map((_, index) => 0.9 ** index)
const tailWeightSum = tailWeights.reduce((sum, value) => sum + value, 0)
const categoryRows: [string, number][] = [
  ...categoryTop,
  ...categoryTail.map((name, index): [string, number] => [
    name,
    round2((tailBudget * (tailWeights[index] ?? 0)) / tailWeightSum),
  ]),
]
const categoryDrift = round2(
  TOTAL_REVENUE - categoryRows.reduce((sum, [, value]) => sum + value, 0),
)
const lastCategory = categoryRows[categoryTop.length]
if (lastCategory) lastCategory[1] = round2(lastCategory[1] + categoryDrift)

export function categoriesFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  const selected = filters.categories?.length
    ? categoryRows.filter(([name]) => filters.categories?.includes(name))
    : categoryRows
  const total = selected.reduce((sum, [, value]) => sum + value, 0) || 1
  return selected.map(([category, revenue]) => ({
    category,
    revenue: round2(revenue * factor),
    revenue_pct: round2((100 * revenue) / total),
  }))
}

export function avgCheckFor(filters: MockFilters): Row[] {
  const drift = filters.states?.length ? (stateShare(filters) > 0.3 ? -4.2 : 11.6) : 0
  return [
    { avg_check: round2(159.88 + drift), avg_lines_per_order: 1.14, avg_units_per_order: 1.14 },
  ]
}

export function customersFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  const customers_total = Math.round(96096 * factor)
  const returned = Math.round(2997 * factor ** 1.15)
  return [
    {
      customers_total,
      returned,
      returned_pct: customers_total ? round2((100 * returned) / customers_total) : 0,
    },
  ]
}

export function kpiFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  const counts = new Set(["orders", "delivered", "on_promise_day", "stuck", "seller_pairs"])
  const row: Row = {}
  for (const [key, value] of Object.entries(dashboard.kpi))
    row[key] = counts.has(key) ? Math.round(value * factor) : value
  return [row]
}

export function deliveryMonthlyFor(filters: MockFilters): Row[] {
  const share = stateShare(filters)
  return dashboard.monthly
    .filter((row) => inPeriod(`${row.month}-01`, filters))
    .map((row) => ({ ...row, delivered: Math.round(row.delivered * share) }))
}

export function statesFor(filters: MockFilters): Row[] {
  const share = periodShare(filters)
  return dashboard.states
    .filter((row) => !filters.states?.length || filters.states.includes(row.state))
    .map((row) => ({ ...row, delivered: Math.round(row.delivered * share) }))
}

export function latenessFor(filters: MockFilters): Row[] {
  const factor = scale(filters)
  return dashboard.lateness.map((row) => ({ ...row, reviews: Math.round(row.reviews * factor) }))
}

export function sellerDeliveryFor(filters: MockFilters): Row[] {
  return dashboard.sellers.filter(
    (row) => !filters.states?.length || filters.states.includes(row.state),
  )
}

export const checks = dashboard.checks

export function lateOrders(count: number): Row[] {
  const random = rng(20180801)
  const states = ["RJ", "BA", "MA", "CE", "AL", "PA", "SE", "ES"]
  return Array.from({ length: count }, (_, index) => {
    const promised = 20 + Math.floor(random() * 15)
    const late = 8 + Math.floor(random() * 30)
    return {
      order_id: hexId(random),
      state: states[Math.floor(random() * states.length)] ?? "RJ",
      purchased_at: `2018-0${2 + (index % 5)}-${String(1 + Math.floor(random() * 27)).padStart(2, "0")}`,
      promised_days: promised,
      actual_days: promised + late,
      review_score: random() < 0.72 ? 1 : 2,
    }
  })
}
