import { CalendarDays, Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useId, useRef, useState } from "react"
import type { Filters } from "@/shared/api/metrics"
import { useMetric } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button } from "@/shared/ui/controls"

export const initialFilters: Filters = {
  start_date: "2016-09-01",
  end_date: "2018-09-01",
  states: [],
  seller_ids: [],
  categories: [],
}
const presets = [
  { label: ru.allPeriod, start: "2016-09-01", end: "2018-09-01" },
  { label: ru.year2018, start: "2018-01-01", end: "2018-09-01" },
  { label: ru.year2017, start: "2017-01-01", end: "2018-01-01" },
]
const inclusive = (value: string) =>
  new Date(new Date(`${value}T00:00:00Z`).valueOf() - 86400000).toISOString().slice(0, 10)
const exclusive = (value: string) =>
  new Date(new Date(`${value}T00:00:00Z`).valueOf() + 86400000).toISOString().slice(0, 10)
export function FiltersBar({
  value,
  onChange,
}: {
  value: Filters
  onChange: (filters: Filters) => void
}) {
  const [start, setStart] = useState(value.start_date ?? "2016-09-01")
  const [end, setEnd] = useState(inclusive(value.end_date ?? "2018-09-01"))
  const details = useRef<HTMLDetailsElement>(null)
  const id = useId()
  const regions = useMetric("dashboard.states", { ...value, states: [] })
  const selected = presets.find((p) => p.start === value.start_date && p.end === value.end_date)
  const fmt = (date: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(date))
  const label = `${fmt(value.start_date ?? start)} – ${fmt(inclusive(value.end_date ?? exclusive(end)))}`
  return (
    <div className="filters-bar">
      <div className="preset-group">
        {presets.map((p) => (
          <Button
            key={p.label}
            aria-pressed={p.label === selected?.label}
            className={p.label === selected?.label ? "selected" : ""}
            onClick={() => onChange({ ...value, start_date: p.start, end_date: p.end })}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="filter-actions">
        <details
          className="filter-popover"
          ref={details}
          onToggle={(e) => {
            if (e.currentTarget.open) {
              setStart(value.start_date ?? "2016-09-01")
              setEnd(inclusive(value.end_date ?? "2018-09-01"))
            }
          }}
        >
          <summary>
            <CalendarDays size={16} />
            <span>{label}</span>
            <ChevronDown size={14} />
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onChange({ ...value, start_date: start, end_date: exclusive(end) })
              if (details.current) details.current.open = false
            }}
          >
            <strong>{ru.period}</strong>
            <label htmlFor={`${id}-from`}>
              {ru.from}
              <input
                id={`${id}-from`}
                type="date"
                required
                min="2016-09-01"
                max={end}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label htmlFor={`${id}-to`}>
              {ru.to}
              <input
                id={`${id}-to`}
                type="date"
                required
                min={start}
                max="2018-08-31"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <Button type="submit" className="primary">
              <Check size={15} />
              {ru.apply}
            </Button>
          </form>
        </details>
        <label className="state-filter">
          <SlidersHorizontal size={15} />
          <span className="sr-only">{ru.state}</span>
          <select
            aria-label={ru.state}
            value={value.states?.[0] ?? ""}
            onChange={(e) => onChange({ ...value, states: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">{ru.allStates}</option>
            {regions.data?.table.rows.map((row) => (
              <option key={String(row.state)} value={String(row.state)}>
                {String(row.state)}
              </option>
            ))}
          </select>
        </label>
        {(value.states?.length ?? 0) > 0 && (
          <Button onClick={() => onChange({ ...value, states: [] })} aria-label={ru.reset}>
            <RotateCcw size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}
