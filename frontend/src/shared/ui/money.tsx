import { DollarSign } from "lucide-react"

export function Money({ value, compact = false }: { value: number; compact?: boolean }) {
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: compact ? 2 : 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value)
  return (
    <span className="money-value">
      <span>{formatted}</span>
      <span className="real-sign" aria-hidden="true">
        <span>R</span>
        <DollarSign strokeWidth={1.8} />
      </span>
      <span className="sr-only">BRL</span>
    </span>
  )
}
