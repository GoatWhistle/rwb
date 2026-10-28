import { CalendarDays, Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useId, useState } from "react"
import type { Filters } from "@/shared/api/metrics"
import { useMetric } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button, Segmented } from "@/shared/ui/controls"
import { MultiSelect } from "@/shared/ui/multi-select"
import { Popover, useAutoFocus } from "@/shared/ui/popover"

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
  const label = `${fmt(value.start_date ?? "2016-09-01")} – ${fmt(inclusive(value.end_date ?? "2018-09-01"))}`
  const states = (regions.data?.table.rows ?? []).map((row) => String(row.state))
  const picked = value.states ?? []
  const stateLabel =
    picked.length === 0
      ? ru.allStates
      : picked.length === 1
        ? picked[0]
        : `${ru.state}: ${picked.length}`
  return (
    <div className="filters-bar">
      <Segmented
        label={ru.period}
        options={presets.map((p) => ({ value: p.label, label: p.label }))}
        value={selected?.label}
        onChange={(name) => {
          const p = presets.find((item) => item.label === name)
          if (p) onChange({ ...value, start_date: p.start, end_date: p.end })
        }}
      />
      <div className="filter-actions">
        <Popover
          label={ru.period}
          className="filter-popover"
          trigger={
            <>
              <CalendarDays size={16} />
              <span>{label}</span>
              <ChevronDown size={14} className="popover-chevron" />
            </>
          }
        >
          {(close) => (
            <DateForm
              id={id}
              initialStart={value.start_date ?? "2016-09-01"}
              initialEnd={inclusive(value.end_date ?? "2018-09-01")}
              onSubmit={(from, to) => {
                onChange({ ...value, start_date: from, end_date: exclusive(to) })
                close()
              }}
            />
          )}
        </Popover>
        <Popover
          label={ru.state}
          className="state-filter"
          trigger={
            <>
              <SlidersHorizontal size={15} />
              <span>{stateLabel}</span>
              <ChevronDown size={14} className="popover-chevron" />
            </>
          }
        >
          {() => (
            <MultiSelect
              options={states}
              value={value.states ?? []}
              onChange={(next) => onChange({ ...value, states: next })}
              allLabel={ru.allStates}
              searchLabel={ru.stateSearch}
            />
          )}
        </Popover>
        {(value.states?.length ?? 0) > 0 && (
          <Button
            className="icon-button"
            onClick={() => onChange({ ...value, states: [] })}
            aria-label={ru.reset}
            title={ru.reset}
          >
            <RotateCcw size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}
function DateForm({
  id,
  initialStart,
  initialEnd,
  onSubmit,
}: {
  id: string
  initialStart: string
  initialEnd: string
  onSubmit: (start: string, end: string) => void
}) {
  const first = useAutoFocus<HTMLInputElement>()
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  return (
    <form
      className="date-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(start, end)
      }}
    >
      <strong>{ru.period}</strong>
      <label htmlFor={`${id}-from`}>
        {ru.from}
        <input
          id={`${id}-from`}
          className="input"
          type="date"
          required
          ref={first}
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
          className="input"
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
  )
}
