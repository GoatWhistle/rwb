import { ru } from "./i18n/ru"

export type Row = Record<string, unknown>
export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value)
export const money = (value: number, compact = false) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: compact ? 2 : 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value)
export const percent = (value: number, digits = 1) =>
  new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: digits }).format(value)
export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !value.trim()) return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
export const cell = (value: unknown) =>
  value === null || value === undefined
    ? ru.noValue
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value)
export const month = (value: unknown, full = false) =>
  new Intl.DateTimeFormat("ru-RU", {
    month: full ? "long" : "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${String(value).slice(0, 7)}-01T00:00:00Z`))
export const categoryName = (value: unknown) =>
  ru.categoryNames[String(value)] ?? cell(value).replaceAll("_", " ")
export function downloadCsv(rows: Row[], filename: string) {
  if (!rows.length) return
  const keys = Object.keys(rows[0] ?? {})
  const quote = (value: unknown) =>
    `"${cell(value)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`
  const contents = [
    keys.map(quote).join(";"),
    ...rows.map((row) => keys.map((key) => quote(row[key])).join(";")),
  ].join("\r\n")
  const href = URL.createObjectURL(
    new Blob([`\uFEFF${contents}`], { type: "text/csv;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}
