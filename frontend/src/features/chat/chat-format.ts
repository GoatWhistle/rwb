import { cell, numeric } from "@/shared/format"

const moneyFormat = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
})
const plain = (digits: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits })

export function formatCell(name: string, value: unknown): string {
  const n = numeric(value)
  if (n === null || /(_id|^id|zip|prefix)$/.test(name)) return cell(value)
  if (/(_pct|pct_)/.test(name)) return `${plain(2).format(n)} %`
  if (/(share|otd|rate)/.test(name) && Math.abs(n) <= 1) return `${plain(2).format(n * 100)} %`
  if (/(revenue|price|amount|paid|total|freight|check|value)/.test(name))
    return moneyFormat.format(n)
  return plain(Number.isInteger(n) ? 0 : 2).format(n)
}

const compactFormat = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatTick(name: string, value: number): string {
  if (/(_pct|pct_)/.test(name)) return `${plain(0).format(value)} %`
  if (/(share|otd|rate)/.test(name) && Math.abs(value) <= 1)
    return `${plain(0).format(value * 100)} %`
  if (Math.abs(value) >= 10000) return compactFormat.format(value)
  return plain(Number.isInteger(value) ? 0 : 1).format(value)
}
