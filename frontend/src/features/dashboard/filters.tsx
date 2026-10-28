import { CalendarDays, Check, ChevronDown, MapPin, RotateCcw } from "lucide-react"
import { useId, useState } from "react"
import type { Filters } from "@/shared/api/metrics"
import { useMetric } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button } from "@/shared/ui/controls"
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
  const periodActive =
    value.start_date !== initialFilters.start_date || value.end_date !== initialFilters.end_date
  const statesActive = (value.states?.length ?? 0) > 0
  return (
    <div className="filters-bar">
      <div className="filter-actions">
        <Popover
          label={ru.period}
          className={`filter-popover selector ${periodActive ? "is-active" : ""}`}
          trigger={
            <>
              <CalendarDays size={16} />
              <span>{selected?.label ?? label}</span>
              <ChevronDown size={14} className="popover-chevron" />
            </>
          }
        >
          {(close) => (
            <>
              <div className="period-presets">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={selected?.label === p.label}
                    onClick={() => {
                      onChange({
                        ...value,
                        start_date: p.start,
                        end_date: p.end,
                      })
                      close()
                    }}
                  >
                    {p.label}
                    {selected?.label === p.label && <Check size={14} />}
                  </button>
                ))}
              </div>
              <DateForm
                id={id}
                initialStart={value.start_date ?? "2016-09-01"}
                initialEnd={inclusive(value.end_date ?? "2018-09-01")}
                onSubmit={(from, to) => {
                  onChange({
                    ...value,
                    start_date: from,
                    end_date: exclusive(to),
                  })
                  close()
                }}
              />
            </>
          )}
        </Popover>
        <Popover
          label={ru.state}
          className={`state-filter selector ${statesActive ? "is-active" : ""}`}
          trigger={
            <>
              <MapPin size={16} />
              <span>{stateLabel}</span>
              <ChevronDown size={14} className="popover-chevron" />
            </>
          }
        >
          {(close) => (
            <>
              <MultiSelect
                options={states}
                value={value.states ?? []}
                onChange={(next) => onChange({ ...value, states: next })}
                allLabel={ru.allStates}
                searchLabel={ru.stateSearch}
              />
              <div className="sheet-done">
                <Button className="primary" onClick={close}>
                  {ru.done}
                </Button>
              </div>
            </>
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
