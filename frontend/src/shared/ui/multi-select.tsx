import { Search } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { useAutoFocus } from "./popover"

export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span className="check-box" data-checked={checked}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" pathLength={1} />
      </svg>
    </span>
  )
}

export function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  searchLabel,
}: {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  allLabel: string
  searchLabel: string
}) {
  const id = useId()
  const search = useAutoFocus<HTMLInputElement>()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const visible = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  )
  const items = [null, ...visible]
  const toggle = (option: string | null) => {
    if (option === null) return onChange([])
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])
  }
  const current = Math.min(active, items.length - 1)
  return (
    <div className="multi-select">
      <label className="multi-select-search">
        <Search size={15} aria-hidden="true" />
        <input
          ref={search}
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={`${id}-${current}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            const last = items.length - 1
            const moves: Record<string, number> = {
              ArrowDown: Math.min(current + 1, last),
              ArrowUp: Math.max(current - 1, 0),
              Home: 0,
              End: last,
            }
            if (e.key in moves) {
              e.preventDefault()
              setActive(moves[e.key] ?? 0)
              document.getElementById(`${id}-${moves[e.key]}`)?.scrollIntoView({ block: "nearest" })
            } else if (e.key === "Enter") {
              e.preventDefault()
              toggle(items[current] ?? null)
            }
          }}
        />
      </label>
      <div className="listbox" role="listbox" id={`${id}-list`} aria-multiselectable="true">
        {items.map((option, index) => {
          const checked = option === null ? value.length === 0 : value.includes(option)
          return (
            <div
              key={option ?? "__all"}
              id={`${id}-${index}`}
              role="option"
              aria-selected={checked}
              data-active={index === current}
              className="listbox-option"
              onPointerMove={() => setActive(index)}
              onPointerDown={(e) => e.preventDefault()}
              tabIndex={-1}
              onClick={() => toggle(option)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  toggle(option)
                }
              }}
            >
              <CheckMark checked={checked} />
              <span>{option ?? allLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
